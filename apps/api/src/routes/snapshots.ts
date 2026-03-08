import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getDb, playlists, tracks, snapshots } from "@playlist-vault/db";
import { authMiddleware } from "../middleware/auth.js";

const router = new Hono();
const db = getDb();

router.use("*", authMiddleware);

router.post("/playlists/:id/snapshots", async (c) => {
  const user = c.get("user");
  const playlistId = c.req.param("id");
  const { name } = await c.req.json();

  if (!name) {
    return c.json({ error: "Snapshot name is required" }, 400);
  }

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, user.id)))
    .limit(1);

  if (!playlist) {
    return c.json({ error: "Playlist not found" }, 404);
  }

  const currentTracks = await db
    .select()
    .from(tracks)
    .where(eq(tracks.playlistId, playlistId))
    .orderBy(tracks.position);

  const snapshotId = createId();
  await db.insert(snapshots).values({
    id: snapshotId,
    playlistId,
    name,
    trackData: currentTracks,
    trackCount: currentTracks.length,
  });

  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.id, snapshotId))
    .limit(1);

  return c.json(snapshot, 201);
});

router.get("/playlists/:id/snapshots", async (c) => {
  const user = c.get("user");
  const playlistId = c.req.param("id");

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, playlistId), eq(playlists.userId, user.id)))
    .limit(1);

  if (!playlist) {
    return c.json({ error: "Playlist not found" }, 404);
  }

  const playlistSnapshots = await db
    .select({
      id: snapshots.id,
      playlistId: snapshots.playlistId,
      name: snapshots.name,
      trackCount: snapshots.trackCount,
      createdAt: snapshots.createdAt,
    })
    .from(snapshots)
    .where(eq(snapshots.playlistId, playlistId))
    .orderBy(snapshots.createdAt);

  return c.json(playlistSnapshots);
});

router.get("/snapshots/:id", async (c) => {
  const user = c.get("user");
  const snapshotId = c.req.param("id");

  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) {
    return c.json({ error: "Snapshot not found" }, 404);
  }

  // Verify ownership through playlist
  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, snapshot.playlistId), eq(playlists.userId, user.id)))
    .limit(1);

  if (!playlist) {
    return c.json({ error: "Snapshot not found" }, 404);
  }

  return c.json(snapshot);
});

router.delete("/snapshots/:id", async (c) => {
  const user = c.get("user");
  const snapshotId = c.req.param("id");

  const [snapshot] = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) {
    return c.json({ error: "Snapshot not found" }, 404);
  }

  const [playlist] = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.id, snapshot.playlistId), eq(playlists.userId, user.id)))
    .limit(1);

  if (!playlist) {
    return c.json({ error: "Snapshot not found" }, 404);
  }

  await db.delete(snapshots).where(eq(snapshots.id, snapshotId));
  return c.json({ success: true });
});

export default router;
