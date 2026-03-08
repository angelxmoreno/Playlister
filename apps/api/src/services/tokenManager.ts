import { eq, and } from "drizzle-orm";
import { Spotify, Google, OAuth2Client } from "arctic";
import { getDb, connectedServices } from "@playlist-vault/db";

const db = getDb();
const REFRESH_BUFFER_MS = 5 * 60 * 1000; // 5 minutes

export async function getValidAccessToken(userId: string, provider: string): Promise<string> {
  const [service] = await db
    .select()
    .from(connectedServices)
    .where(
      and(
        eq(connectedServices.userId, userId),
        eq(connectedServices.provider, provider)
      )
    )
    .limit(1);

  if (!service) {
    throw new Error(`No connected service for provider: ${provider}`);
  }

  const needsRefresh =
    service.expiresAt &&
    service.expiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (!needsRefresh || !service.refreshToken) {
    return service.accessToken;
  }

  const newTokens = await refreshToken(provider, service.refreshToken);

  await db
    .update(connectedServices)
    .set({
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken ?? service.refreshToken,
      expiresAt: newTokens.expiresAt,
    })
    .where(
      and(
        eq(connectedServices.userId, userId),
        eq(connectedServices.provider, provider)
      )
    );

  return newTokens.accessToken;
}

async function refreshToken(
  provider: string,
  refreshTokenValue: string
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date | null }> {
  if (provider === "spotify") {
    const spotify = new Spotify(
      process.env.SPOTIFY_CLIENT_ID!,
      process.env.SPOTIFY_CLIENT_SECRET!,
      process.env.SPOTIFY_REDIRECT_URI!
    );
    const tokens = await spotify.refreshAccessToken(refreshTokenValue);
    return {
      accessToken: tokens.accessToken(),
      refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
      expiresAt: tokens.accessTokenExpiresAt() ?? null,
    };
  }

  if (provider === "youtube") {
    const google = new Google(
      process.env.GOOGLE_CLIENT_ID!,
      process.env.GOOGLE_CLIENT_SECRET!,
      process.env.GOOGLE_REDIRECT_URI!
    );
    const tokens = await google.refreshAccessToken(refreshTokenValue);
    return {
      accessToken: tokens.accessToken(),
      refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
      expiresAt: tokens.accessTokenExpiresAt() ?? null,
    };
  }

  if (provider === "soundcloud") {
    const client = new OAuth2Client(
      process.env.SOUNDCLOUD_CLIENT_ID!,
      process.env.SOUNDCLOUD_CLIENT_SECRET!,
      process.env.SOUNDCLOUD_REDIRECT_URI!
    );
    const tokens = await client.refreshAccessToken(
      "https://api.soundcloud.com/oauth2/token",
      refreshTokenValue,
      []
    );
    return {
      accessToken: tokens.accessToken(),
      refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
      expiresAt: tokens.accessTokenExpiresAt() ?? null,
    };
  }

  if (provider === "pandora") {
    const client = new OAuth2Client(
      process.env.PANDORA_CLIENT_ID!,
      process.env.PANDORA_CLIENT_SECRET!,
      process.env.PANDORA_REDIRECT_URI!
    );
    const tokens = await client.refreshAccessToken(
      "https://www.pandora.com/oauth/v1/token",
      refreshTokenValue,
      []
    );
    return {
      accessToken: tokens.accessToken(),
      refreshToken: tokens.hasRefreshToken() ? tokens.refreshToken() : null,
      expiresAt: tokens.accessTokenExpiresAt() ?? null,
    };
  }

  throw new Error(`Unknown provider: ${provider}`);
}
