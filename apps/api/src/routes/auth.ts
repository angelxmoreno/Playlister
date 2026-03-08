import { Hono } from "hono";
import { createId } from "@paralleldrive/cuid2";
import { hash, verify } from "@node-rs/argon2";
import { eq, and } from "drizzle-orm";
import {
  generateState,
  generateCodeVerifier,
  Google,
  Spotify,
  OAuth2Client,
  OAuth2RequestError,
  ArcticFetchError,
} from "arctic";
import { lucia } from "../auth/lucia.js";
import { getDb, users, sessions, oauthState, connectedServices } from "@playlist-vault/db";
import { authMiddleware } from "../middleware/auth.js";

const auth = new Hono();
const db = getDb();

// ─── Email/Password Auth ───────────────────────────────────────────────────

auth.post("/register", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing.length > 0) {
      return c.json({ error: "Email already registered" }, 409);
    }

    const passwordHash = await hash(password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    const userId = createId();
    await db.insert(users).values({ id: userId, email, passwordHash });

    const session = await lucia.createSession(userId, {});
    return c.json({ sessionId: session.id, userId });
  } catch (err) {
    console.error("Register error:", err);
    return c.json({ error: "Registration failed" }, 500);
  }
});

auth.post("/login", async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const valid = await verify(user.passwordHash, password);
    if (!valid) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    const session = await lucia.createSession(user.id, {});
    return c.json({ sessionId: session.id, userId: user.id });
  } catch (err) {
    console.error("Login error:", err);
    return c.json({ error: "Login failed" }, 500);
  }
});

auth.post("/logout", authMiddleware, async (c) => {
  const session = c.get("session");
  await lucia.invalidateSession(session.id);
  return c.json({ success: true });
});

// ─── OAuth Helpers ─────────────────────────────────────────────────────────

async function storeOAuthState(
  state: string,
  provider: string,
  userId: string | null,
  codeVerifier?: string
) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await db.insert(oauthState).values({
    state,
    provider,
    userId,
    codeVerifier: codeVerifier ?? null,
    expiresAt,
  });
}

async function validateAndConsumeState(state: string, provider: string) {
  const [row] = await db
    .select()
    .from(oauthState)
    .where(and(eq(oauthState.state, state), eq(oauthState.provider, provider)))
    .limit(1);

  if (!row || row.expiresAt < new Date()) {
    return null;
  }

  await db.delete(oauthState).where(eq(oauthState.state, state));
  return row;
}

async function upsertConnectedService(
  userId: string,
  provider: string,
  accessToken: string,
  refreshToken: string | null,
  expiresAt: Date | null
) {
  const id = createId();
  await db
    .insert(connectedServices)
    .values({ id, userId, provider, accessToken, refreshToken, expiresAt })
    .onConflictDoUpdate({
      target: [connectedServices.userId, connectedServices.provider],
      set: { accessToken, refreshToken, expiresAt },
    });
}

const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:5173";

// ─── Spotify OAuth ─────────────────────────────────────────────────────────

function getSpotify() {
  return new Spotify(
    process.env.SPOTIFY_CLIENT_ID!,
    process.env.SPOTIFY_CLIENT_SECRET!,
    process.env.SPOTIFY_REDIRECT_URI!
  );
}

auth.get("/spotify", async (c) => {
  try {
    const spotify = getSpotify();
    const state = generateState();
    await storeOAuthState(state, "spotify", null);
    const url = spotify.createAuthorizationURL(state, [
      "playlist-read-private",
      "playlist-read-collaborative",
    ]);
    return c.redirect(url.toString());
  } catch (err) {
    console.error("Spotify auth error:", err);
    return c.json({ error: "Failed to initiate Spotify auth" }, 500);
  }
});

auth.get("/spotify/callback", async (c) => {
  try {
    const { code, state } = c.req.query();
    const stateRow = await validateAndConsumeState(state, "spotify");
    if (!stateRow) return c.json({ error: "Invalid or expired state" }, 400);

    const spotify = getSpotify();
    const tokens = await spotify.validateAuthorizationCode(code);
    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
    const expiresAt = tokens.accessTokenExpiresAt();

    // Fetch Spotify user to get/create local user
    const profileRes = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      console.error("Spotify /me failed:", profileRes.status, await profileRes.text());
      return c.json({ error: "Failed to fetch Spotify profile" }, 502);
    }
    const profile = await profileRes.json() as { email?: string; id: string };

    let userId = stateRow.userId;
    if (!userId) {
      const email = profile.email ?? `spotify_${profile.id}@placeholder.local`;
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        userId = existing.id;
      } else {
        userId = createId();
        const dummyHash = await hash(createId(), { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
        await db.insert(users).values({ id: userId, email, passwordHash: dummyHash });
      }
    }

    await upsertConnectedService(userId, "spotify", accessToken, refreshToken, expiresAt);

    const session = await lucia.createSession(userId, {});
    return c.redirect(`${FRONTEND_URL}/dashboard?session=${session.id}`);
  } catch (err) {
    if (err instanceof OAuth2RequestError || err instanceof ArcticFetchError) {
      return c.json({ error: err.message }, 400);
    }
    console.error("Spotify callback error:", err);
    return c.json({ error: "OAuth callback failed" }, 500);
  }
});

// ─── YouTube / Google OAuth ─────────────────────────────────────────────────

function getGoogle() {
  return new Google(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    process.env.GOOGLE_REDIRECT_URI!
  );
}

auth.get("/youtube", async (c) => {
  try {
    const google = getGoogle();
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    await storeOAuthState(state, "youtube", null, codeVerifier);
    const url = google.createAuthorizationURL(state, codeVerifier, [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/youtube.readonly",
    ]);
    url.searchParams.set("access_type", "offline");
    return c.redirect(url.toString());
  } catch (err) {
    console.error("YouTube auth error:", err);
    return c.json({ error: "Failed to initiate YouTube auth" }, 500);
  }
});

auth.get("/youtube/callback", async (c) => {
  try {
    const { code, state } = c.req.query();
    const stateRow = await validateAndConsumeState(state, "youtube");
    if (!stateRow || !stateRow.codeVerifier) {
      return c.json({ error: "Invalid or expired state" }, 400);
    }

    const google = getGoogle();
    const tokens = await google.validateAuthorizationCode(code, stateRow.codeVerifier);
    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
    const expiresAt = tokens.accessTokenExpiresAt();

    const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!profileRes.ok) {
      console.error("YouTube /userinfo failed:", profileRes.status, await profileRes.text());
      return c.json({ error: "Failed to fetch Google profile" }, 502);
    }
    const profile = await profileRes.json() as { email?: string; sub: string };

    let userId = stateRow.userId;
    if (!userId) {
      const email = profile.email ?? `google_${profile.sub}@placeholder.local`;
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        userId = existing.id;
      } else {
        userId = createId();
        const dummyHash = await hash(createId(), { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
        await db.insert(users).values({ id: userId, email, passwordHash: dummyHash });
      }
    }

    await upsertConnectedService(userId, "youtube", accessToken, refreshToken, expiresAt);

    const session = await lucia.createSession(userId, {});
    return c.redirect(`${FRONTEND_URL}/dashboard?session=${session.id}`);
  } catch (err) {
    if (err instanceof OAuth2RequestError || err instanceof ArcticFetchError) {
      return c.json({ error: err.message }, 400);
    }
    console.error("YouTube callback error:", err);
    return c.json({ error: "OAuth callback failed" }, 500);
  }
});

// ─── SoundCloud OAuth ───────────────────────────────────────────────────────

function getSoundCloud() {
  return new OAuth2Client(
    process.env.SOUNDCLOUD_CLIENT_ID!,
    process.env.SOUNDCLOUD_CLIENT_SECRET!,
    process.env.SOUNDCLOUD_REDIRECT_URI!
  );
}

auth.get("/soundcloud", async (c) => {
  try {
    const client = getSoundCloud();
    const state = generateState();
    await storeOAuthState(state, "soundcloud", null);
    const url = client.createAuthorizationURL(
      "https://api.soundcloud.com/connect",
      state,
      []
    );
    return c.redirect(url.toString());
  } catch (err) {
    console.error("SoundCloud auth error:", err);
    return c.json({ error: "Failed to initiate SoundCloud auth" }, 500);
  }
});

auth.get("/soundcloud/callback", async (c) => {
  try {
    const { code, state } = c.req.query();
    const stateRow = await validateAndConsumeState(state, "soundcloud");
    if (!stateRow) return c.json({ error: "Invalid or expired state" }, 400);

    const client = getSoundCloud();
    const tokens = await client.validateAuthorizationCode(
      "https://api.soundcloud.com/oauth2/token",
      code
    );
    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
    let expiresAt: Date | null = null;
    try { expiresAt = tokens.accessTokenExpiresAt(); } catch { /* SoundCloud omits expires_in */ }

    const profileRes = await fetch("https://api.soundcloud.com/me", {
      headers: { Authorization: `OAuth ${accessToken}` },
    });
    if (!profileRes.ok) {
      console.error("SoundCloud /me failed:", profileRes.status, await profileRes.text());
      return c.json({ error: "Failed to fetch SoundCloud profile" }, 502);
    }
    const profile = await profileRes.json() as { id: number; username: string };

    let userId = stateRow.userId;
    if (!userId) {
      const email = `soundcloud_${profile.id}@placeholder.local`;
      const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (existing) {
        userId = existing.id;
      } else {
        userId = createId();
        const dummyHash = await hash(createId(), { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
        await db.insert(users).values({ id: userId, email, passwordHash: dummyHash });
      }
    }

    await upsertConnectedService(userId, "soundcloud", accessToken, refreshToken, expiresAt);

    const session = await lucia.createSession(userId, {});
    return c.redirect(`${FRONTEND_URL}/dashboard?session=${session.id}`);
  } catch (err) {
    if (err instanceof OAuth2RequestError || err instanceof ArcticFetchError) {
      return c.json({ error: err.message }, 400);
    }
    console.error("SoundCloud callback error:", err);
    return c.json({ error: "OAuth callback failed" }, 500);
  }
});

// ─── Pandora OAuth ──────────────────────────────────────────────────────────

function getPandora() {
  return new OAuth2Client(
    process.env.PANDORA_CLIENT_ID!,
    process.env.PANDORA_CLIENT_SECRET!,
    process.env.PANDORA_REDIRECT_URI!
  );
}

auth.get("/pandora", async (c) => {
  try {
    const client = getPandora();
    const state = generateState();
    await storeOAuthState(state, "pandora", null);
    const url = client.createAuthorizationURL(
      "https://www.pandora.com/oauth/v1/authorize",
      state,
      []
    );
    return c.redirect(url.toString());
  } catch (err) {
    console.error("Pandora auth error:", err);
    return c.json({ error: "Failed to initiate Pandora auth" }, 500);
  }
});

auth.get("/pandora/callback", async (c) => {
  try {
    const { code, state } = c.req.query();
    const stateRow = await validateAndConsumeState(state, "pandora");
    if (!stateRow) return c.json({ error: "Invalid or expired state" }, 400);

    const client = getPandora();
    const tokens = await client.validateAuthorizationCode(
      "https://www.pandora.com/oauth/v1/token",
      code
    );
    const accessToken = tokens.accessToken();
    const refreshToken = tokens.hasRefreshToken() ? tokens.refreshToken() : null;
    let expiresAt: Date | null = null;
    try { expiresAt = tokens.accessTokenExpiresAt(); } catch { /* Pandora may omit expires_in */ }

    let userId = stateRow.userId;
    if (!userId) {
      const email = `pandora_${createId()}@placeholder.local`;
      userId = createId();
      const dummyHash = await hash(createId(), { memoryCost: 19456, timeCost: 2, outputLen: 32, parallelism: 1 });
      await db.insert(users).values({ id: userId, email, passwordHash: dummyHash });
    }

    await upsertConnectedService(userId, "pandora", accessToken, refreshToken, expiresAt);

    const session = await lucia.createSession(userId, {});
    return c.redirect(`${FRONTEND_URL}/dashboard?session=${session.id}`);
  } catch (err) {
    if (err instanceof OAuth2RequestError || err instanceof ArcticFetchError) {
      return c.json({ error: err.message }, 400);
    }
    console.error("Pandora callback error:", err);
    return c.json({ error: "OAuth callback failed" }, 500);
  }
});

// ─── Disconnect Service ─────────────────────────────────────────────────────

auth.delete("/services/:provider", authMiddleware, async (c) => {
  const user = c.get("user");
  const provider = c.req.param("provider");

  await db
    .delete(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, user.id),
        eq(connectedServices.provider, provider)
      )
    );

  return c.json({ success: true });
});

export default auth;
