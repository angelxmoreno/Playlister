import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { getDb, playlists, tracks, connectedServices } from "@playlist-vault/db";
import { authMiddleware } from "../middleware/auth.js";
import { syncSpotify, syncYouTube, syncSoundCloud, syncPandora } from "../services/sync.js";

const router = new Hono();
const db = getDb();

router.use("*", authMiddleware);

router.get("/", async (c) => {
  const user = c.get("user");
  const userPlaylists = await db
    .select()
    .from(playlists)
    .where(eq(playlists.userId, user.id));
  return c.json(userPlaylists);
});

router.post("/sync", async (c) => {
  const user = c.get("user");
  const services = await db
    .select()
    .from(connectedServices)
    .where(eq(connectedServices.userId, user.id));

  const results: Record<string, string> = {};

  for (const service of services) {
    try {
      await runSync(user.id, service.provider);
      results[service.provider] = "success";
    } catch (err) {
      console.error(`Sync failed for ${service.provider}:`, err);
      results[service.provider] = "error";
    }
  }

  return c.json({ results });
});

router.post("/sync/:provider", async (c) => {
  const user = c.get("user");
  const provider = c.req.param("provider");

  try {
    await runSync(user.id, provider);
    return c.json({ success: true });
  } catch (err) {
    console.error(`Sync failed for ${provider}:`, err);
    return c.json({ error: "Sync failed" }, 500);
  }
});

router.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, id), eq(playlists.userId, user.id)))
    .limit(1);

  if (!playlist) {
    return c.json({ error: "Playlist not found" }, 404);
  }

  const playlistTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.playlistId, id))
    .orderBy(tracks.position);

  return c.json({ ...playlist, tracks: playlistTracks });
});

async function runSync(userId: string, provider: string): Promise<void> {
  switch (provider) {
    case "spotify":
      await syncSpotify(userId);
      break;
    case "youtube":
      await syncYouTube(userId);
      break;
    case "soundcloud":
      await syncSoundCloud(userId);
      break;
    case "pandora":
      await syncPandora(userId);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export default router;
