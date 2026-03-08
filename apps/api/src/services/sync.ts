import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { getDb, playlists, tracks, connectedServices } from "@playlist-vault/db";
import { getValidAccessToken } from "./tokenManager.js";

const db = getDb();
const ONE_HOUR_MS = 60 * 60 * 1000;

// ─── Spotify Sync ────────────────────────────────────────────────────────────

export async function syncSpotify(userId: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId, "spotify");

  // Fetch all playlists (paginate)
  let url: string | null = "https://api.spotify.com/v1/me/playlists?limit=50";
  const spotifyPlaylists: SpotifyPlaylist[] = [];

  while (url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json() as SpotifyPlaylistsResponse;
    spotifyPlaylists.push(...data.items);
    url = data.next;
  }

  for (const sp of spotifyPlaylists) {
    // Upsert playlist
    const playlistId = createId();
    const [existingPlaylist] = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.provider, "spotify"),
          eq(playlists.externalId, sp.id)
        )
      )
      .limit(1);

    const dbPlaylistId = existingPlaylist?.id ?? playlistId;

    await db
      .insert(playlists)
      .values({
        id: playlistId,
        userId,
        provider: "spotify",
        externalId: sp.id,
        name: sp.name,
        description: sp.description ?? null,
        thumbnailUrl: sp.images?.[0]?.url ?? null,
        trackCount: sp.tracks.total,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [playlists.userId, playlists.provider, playlists.externalId],
        set: {
          name: sp.name,
          description: sp.description ?? null,
          thumbnailUrl: sp.images?.[0]?.url ?? null,
          trackCount: sp.tracks.total,
          syncedAt: new Date(),
        },
      });

    // Fetch tracks
    let tracksUrl: string | null = `https://api.spotify.com/v1/playlists/${sp.id}/tracks?limit=100`;
    const spotifyTracks: SpotifyTrackItem[] = [];

    while (tracksUrl) {
      const res = await fetch(tracksUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json() as SpotifyTracksResponse;
      spotifyTracks.push(...data.items.filter((i) => i.track !== null));
      tracksUrl = data.next;
    }

    // Delete existing tracks and re-insert
    await db.delete(tracks).where(eq(tracks.playlistId, dbPlaylistId));

    for (let i = 0; i < spotifyTracks.length; i++) {
      const item = spotifyTracks[i];
      if (!item.track) continue;
      await db.insert(tracks).values({
        id: createId(),
        playlistId: dbPlaylistId,
        provider: "spotify",
        externalId: item.track.id,
        title: item.track.name,
        artist: item.track.artists?.map((a) => a.name).join(", ") ?? null,
        album: item.track.album?.name ?? null,
        durationMs: item.track.duration_ms ?? null,
        position: i,
        thumbnailUrl: item.track.album?.images?.[0]?.url ?? null,
      });
    }
  }
}

// ─── YouTube Sync ────────────────────────────────────────────────────────────

export async function syncYouTube(userId: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId, "youtube");

  // Check if synced recently (quota guard)
  const recentPlaylists = await db
    .select()
    .from(playlists)
    .where(and(eq(playlists.userId, userId), eq(playlists.provider, "youtube")))
    .limit(1);

  if (
    recentPlaylists.length > 0 &&
    recentPlaylists[0].syncedAt &&
    Date.now() - recentPlaylists[0].syncedAt.getTime() < ONE_HOUR_MS
  ) {
    return; // Skip to avoid burning quota
  }

  let pageToken: string | undefined;
  const ytPlaylists: YouTubePlaylist[] = [];

  do {
    const params = new URLSearchParams({
      part: "snippet,contentDetails",
      mine: "true",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(
      `https://www.googleapis.com/youtube/v3/playlists?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = await res.json() as YouTubePlaylistsResponse;
    ytPlaylists.push(...data.items);
    pageToken = data.nextPageToken;
  } while (pageToken);

  for (const yp of ytPlaylists) {
    const playlistId = createId();
    const [existingPlaylist] = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.provider, "youtube"),
          eq(playlists.externalId, yp.id)
        )
      )
      .limit(1);

    const dbPlaylistId = existingPlaylist?.id ?? playlistId;

    await db
      .insert(playlists)
      .values({
        id: playlistId,
        userId,
        provider: "youtube",
        externalId: yp.id,
        name: yp.snippet.title,
        description: yp.snippet.description ?? null,
        thumbnailUrl: yp.snippet.thumbnails?.default?.url ?? null,
        trackCount: yp.contentDetails.itemCount,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [playlists.userId, playlists.provider, playlists.externalId],
        set: {
          name: yp.snippet.title,
          description: yp.snippet.description ?? null,
          thumbnailUrl: yp.snippet.thumbnails?.default?.url ?? null,
          trackCount: yp.contentDetails.itemCount,
          syncedAt: new Date(),
        },
      });

    // Fetch playlist items
    let itemPageToken: string | undefined;
    const ytItems: YouTubePlaylistItem[] = [];

    do {
      const params = new URLSearchParams({
        part: "snippet",
        playlistId: yp.id,
        maxResults: "50",
        ...(itemPageToken ? { pageToken: itemPageToken } : {}),
      });
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${params}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = await res.json() as YouTubePlaylistItemsResponse;
      ytItems.push(...data.items);
      itemPageToken = data.nextPageToken;
    } while (itemPageToken);

    await db.delete(tracks).where(eq(tracks.playlistId, dbPlaylistId));

    for (let i = 0; i < ytItems.length; i++) {
      const item = ytItems[i];
      await db.insert(tracks).values({
        id: createId(),
        playlistId: dbPlaylistId,
        provider: "youtube",
        externalId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        artist: item.snippet.videoOwnerChannelTitle ?? null,
        album: null,
        durationMs: null,
        position: i,
        thumbnailUrl: item.snippet.thumbnails?.default?.url ?? null,
      });
    }
  }
}

// ─── SoundCloud Sync ─────────────────────────────────────────────────────────

export async function syncSoundCloud(userId: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId, "soundcloud");

  const res = await fetch("https://api.soundcloud.com/me/playlists", {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const scPlaylists = await res.json() as SoundCloudPlaylist[];

  for (const sp of scPlaylists) {
    const playlistId = createId();
    const [existingPlaylist] = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.provider, "soundcloud"),
          eq(playlists.externalId, String(sp.id))
        )
      )
      .limit(1);

    const dbPlaylistId = existingPlaylist?.id ?? playlistId;

    await db
      .insert(playlists)
      .values({
        id: playlistId,
        userId,
        provider: "soundcloud",
        externalId: String(sp.id),
        name: sp.title,
        description: sp.description ?? null,
        thumbnailUrl: sp.artwork_url ?? null,
        trackCount: sp.track_count ?? 0,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [playlists.userId, playlists.provider, playlists.externalId],
        set: {
          name: sp.title,
          description: sp.description ?? null,
          thumbnailUrl: sp.artwork_url ?? null,
          trackCount: sp.track_count ?? 0,
          syncedAt: new Date(),
        },
      });

    await db.delete(tracks).where(eq(tracks.playlistId, dbPlaylistId));

    const trackItems = sp.tracks ?? [];
    for (let i = 0; i < trackItems.length; i++) {
      const t = trackItems[i];
      await db.insert(tracks).values({
        id: createId(),
        playlistId: dbPlaylistId,
        provider: "soundcloud",
        externalId: String(t.id),
        title: t.title,
        artist: t.user?.username ?? null,
        album: null,
        durationMs: t.duration ?? null,
        position: i,
        thumbnailUrl: t.artwork_url ?? null,
      });
    }
  }
}

// ─── Pandora Sync ─────────────────────────────────────────────────────────

export async function syncPandora(userId: string): Promise<void> {
  const accessToken = await getValidAccessToken(userId, "pandora");

  const query = `
    query GetUserCollections {
      me {
        playlists {
          items {
            pandoraId
            name
            description
            trackCount
            art { url }
            tracks {
              items {
                pandoraId
                songTitle
                artistName
                albumTitle
                duration
                art { url }
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch("https://ce.pandora.com/api/v1/graphql/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json() as PandoraResponse;
  const pandoraPlaylists = data?.data?.me?.playlists?.items ?? [];

  for (const pp of pandoraPlaylists) {
    const playlistId = createId();
    const [existingPlaylist] = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, userId),
          eq(playlists.provider, "pandora"),
          eq(playlists.externalId, pp.pandoraId)
        )
      )
      .limit(1);

    const dbPlaylistId = existingPlaylist?.id ?? playlistId;

    await db
      .insert(playlists)
      .values({
        id: playlistId,
        userId,
        provider: "pandora",
        externalId: pp.pandoraId,
        name: pp.name,
        description: pp.description ?? null,
        thumbnailUrl: pp.art?.url ?? null,
        trackCount: pp.trackCount ?? 0,
        syncedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [playlists.userId, playlists.provider, playlists.externalId],
        set: {
          name: pp.name,
          description: pp.description ?? null,
          thumbnailUrl: pp.art?.url ?? null,
          trackCount: pp.trackCount ?? 0,
          syncedAt: new Date(),
        },
      });

    await db.delete(tracks).where(eq(tracks.playlistId, dbPlaylistId));

    const trackItems = pp.tracks?.items ?? [];
    for (let i = 0; i < trackItems.length; i++) {
      const t = trackItems[i];
      await db.insert(tracks).values({
        id: createId(),
        playlistId: dbPlaylistId,
        provider: "pandora",
        externalId: t.pandoraId,
        title: t.songTitle,
        artist: t.artistName ?? null,
        album: t.albumTitle ?? null,
        durationMs: t.duration ?? null,
        position: i,
        thumbnailUrl: t.art?.url ?? null,
      });
    }
  }
}

// ─── Type Definitions ─────────────────────────────────────────────────────────

interface SpotifyPlaylist {
  id: string;
  name: string;
  description?: string;
  images?: { url: string }[];
  tracks: { total: number };
}

interface SpotifyPlaylistsResponse {
  items: SpotifyPlaylist[];
  next: string | null;
}

interface SpotifyTrackItem {
  track: {
    id: string;
    name: string;
    artists?: { name: string }[];
    album?: { name: string; images?: { url: string }[] };
    duration_ms?: number;
  } | null;
}

interface SpotifyTracksResponse {
  items: SpotifyTrackItem[];
  next: string | null;
}

interface YouTubePlaylist {
  id: string;
  snippet: {
    title: string;
    description?: string;
    thumbnails?: { default?: { url: string } };
  };
  contentDetails: { itemCount: number };
}

interface YouTubePlaylistsResponse {
  items: YouTubePlaylist[];
  nextPageToken?: string;
}

interface YouTubePlaylistItem {
  snippet: {
    title: string;
    videoOwnerChannelTitle?: string;
    thumbnails?: { default?: { url: string } };
    resourceId: { videoId: string };
  };
}

interface YouTubePlaylistItemsResponse {
  items: YouTubePlaylistItem[];
  nextPageToken?: string;
}

interface SoundCloudPlaylist {
  id: number;
  title: string;
  description?: string;
  artwork_url?: string;
  track_count?: number;
  tracks?: SoundCloudTrack[];
}

interface SoundCloudTrack {
  id: number;
  title: string;
  duration?: number;
  artwork_url?: string;
  user?: { username: string };
}

interface PandoraResponse {
  data?: {
    me?: {
      playlists?: {
        items?: PandoraPlaylist[];
      };
    };
  };
}

interface PandoraPlaylist {
  pandoraId: string;
  name: string;
  description?: string;
  trackCount?: number;
  art?: { url: string };
  tracks?: { items: PandoraTrack[] };
}

interface PandoraTrack {
  pandoraId: string;
  songTitle: string;
  artistName?: string;
  albumTitle?: string;
  duration?: number;
  art?: { url: string };
}
