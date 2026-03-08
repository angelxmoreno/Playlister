const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

function getSessionId(): string | null {
  return localStorage.getItem("sessionId");
}

export function setSessionId(id: string): void {
  localStorage.setItem("sessionId", id);
}

export function clearSessionId(): void {
  localStorage.removeItem("sessionId");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const sessionId = getSessionId();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(sessionId ? { Authorization: `Bearer ${sessionId}` } : {}),
    ...(options.headers ?? {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error((error as { error?: string }).error ?? "Request failed");
  }

  return res.json() as Promise<T>;
}

export const api = {
  // Auth
  register: (email: string, password: string) =>
    request<{ sessionId: string; userId: string }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ sessionId: string; userId: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request<{ success: boolean }>("/auth/logout", { method: "POST" }),

  disconnectService: (provider: string) =>
    request<{ success: boolean }>(`/auth/services/${provider}`, {
      method: "DELETE",
    }),

  // Playlists
  getPlaylists: () => request<Playlist[]>("/playlists"),

  syncAll: () => request<{ results: Record<string, string> }>("/playlists/sync", { method: "POST" }),

  syncProvider: (provider: string) =>
    request<{ success: boolean }>(`/playlists/sync/${provider}`, { method: "POST" }),

  getPlaylist: (id: string) => request<PlaylistWithTracks>(`/playlists/${id}`),

  // Snapshots
  createSnapshot: (playlistId: string, name: string) =>
    request<Snapshot>(`/playlists/${playlistId}/snapshots`, {
      method: "POST",
      body: JSON.stringify({ name }),
    }),

  getSnapshots: (playlistId: string) =>
    request<SnapshotSummary[]>(`/playlists/${playlistId}/snapshots`),

  getSnapshot: (id: string) => request<Snapshot>(`/snapshots/${id}`),

  deleteSnapshot: (id: string) =>
    request<{ success: boolean }>(`/snapshots/${id}`, { method: "DELETE" }),
};

export interface Playlist {
  id: string;
  userId: string;
  provider: string;
  externalId: string;
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  trackCount: number | null;
  syncedAt: string | null;
  createdAt: string | null;
}

export interface Track {
  id: string;
  playlistId: string;
  provider: string;
  externalId: string;
  title: string;
  artist: string | null;
  album: string | null;
  durationMs: number | null;
  position: number;
  thumbnailUrl: string | null;
  createdAt: string | null;
}

export interface PlaylistWithTracks extends Playlist {
  tracks: Track[];
}

export interface SnapshotSummary {
  id: string;
  playlistId: string;
  name: string;
  trackCount: number;
  createdAt: string | null;
}

export interface Snapshot extends SnapshotSummary {
  trackData: Track[];
}
