import { useState, useEffect, FormEvent } from "react";
import { useParams, Link } from "react-router";
import { api, PlaylistWithTracks, SnapshotSummary, Track } from "../../lib/api.js";
import ProviderBadge from "../../components/ProviderBadge.js";

function formatDuration(ms: number | null): string {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function TrackRow({ track }: { track: Track }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2 hover:bg-gray-800 rounded-lg group">
      <span className="text-gray-600 text-sm w-6 text-right shrink-0">
        {track.position + 1}
      </span>
      {track.thumbnailUrl && (
        <img
          src={track.thumbnailUrl}
          alt={track.title}
          className="w-9 h-9 rounded object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{track.title}</p>
        <p className="text-xs text-gray-500 truncate">
          {[track.artist, track.album].filter(Boolean).join(" · ")}
        </p>
      </div>
      <span className="text-xs text-gray-600 shrink-0">
        {formatDuration(track.durationMs)}
      </span>
    </div>
  );
}

function SnapshotItem({
  snapshot,
  onDelete,
  onView,
}: {
  snapshot: SnapshotSummary;
  onDelete: (id: string) => void;
  onView: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between bg-gray-800 rounded-lg px-4 py-3">
      <div>
        <p className="text-sm font-medium">{snapshot.name}</p>
        <p className="text-xs text-gray-500">
          {snapshot.trackCount} tracks &middot;{" "}
          {snapshot.createdAt
            ? new Date(snapshot.createdAt).toLocaleDateString()
            : "—"}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onView(snapshot.id)}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View
        </button>
        <button
          onClick={() => onDelete(snapshot.id)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [playlist, setPlaylist] = useState<PlaylistWithTracks | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snapshotName, setSnapshotName] = useState("");
  const [isCreatingSnapshot, setIsCreatingSnapshot] = useState(false);
  const [viewingSnapshotTracks, setViewingSnapshotTracks] = useState<Track[] | null>(null);
  const [viewingSnapshotName, setViewingSnapshotName] = useState<string>("");

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  async function loadData(playlistId: string) {
    setIsLoading(true);
    setError(null);
    try {
      const [playlistData, snapshotData] = await Promise.all([
        api.getPlaylist(playlistId),
        api.getSnapshots(playlistId),
      ]);
      setPlaylist(playlistData);
      setSnapshots(snapshotData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlist");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateSnapshot(e: FormEvent) {
    e.preventDefault();
    if (!id || !snapshotName.trim()) return;
    setIsCreatingSnapshot(true);
    try {
      const snapshot = await api.createSnapshot(id, snapshotName.trim());
      setSnapshots((prev) => [
        ...prev,
        {
          id: snapshot.id,
          playlistId: snapshot.playlistId,
          name: snapshot.name,
          trackCount: snapshot.trackCount,
          createdAt: snapshot.createdAt,
        },
      ]);
      setSnapshotName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create snapshot");
    } finally {
      setIsCreatingSnapshot(false);
    }
  }

  async function handleDeleteSnapshot(snapshotId: string) {
    try {
      await api.deleteSnapshot(snapshotId);
      setSnapshots((prev) => prev.filter((s) => s.id !== snapshotId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete snapshot");
    }
  }

  async function handleViewSnapshot(snapshotId: string) {
    try {
      const snapshot = await api.getSnapshot(snapshotId);
      setViewingSnapshotTracks(snapshot.trackData);
      setViewingSnapshotName(snapshot.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load snapshot");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error || !playlist) {
    return (
      <div className="p-8">
        <p className="text-red-400">{error ?? "Playlist not found"}</p>
        <Link to="/dashboard/playlists" className="text-indigo-400 hover:underline text-sm mt-2 inline-block">
          Back to playlists
        </Link>
      </div>
    );
  }

  const displayTracks = viewingSnapshotTracks ?? playlist.tracks;
  const displayTitle = viewingSnapshotTracks
    ? `Snapshot: ${viewingSnapshotName}`
    : playlist.name;

  return (
    <div className="p-8 flex flex-col gap-8 max-w-4xl">
      {/* Header */}
      <div className="flex gap-6">
        <div className="w-32 h-32 bg-gray-800 rounded-xl overflow-hidden shrink-0">
          {playlist.thumbnailUrl ? (
            <img
              src={playlist.thumbnailUrl}
              alt={playlist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-4xl">
              🎵
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2 justify-end">
          <ProviderBadge provider={playlist.provider} size="md" />
          <h1 className="text-3xl font-bold">{playlist.name}</h1>
          {playlist.description && (
            <p className="text-gray-400 text-sm">{playlist.description}</p>
          )}
          <div className="flex gap-4 text-sm text-gray-500">
            <span>{playlist.trackCount ?? 0} tracks</span>
            {playlist.syncedAt && (
              <span>
                Synced {new Date(playlist.syncedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {/* Track list */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">{displayTitle}</h2>
          {viewingSnapshotTracks && (
            <button
              onClick={() => setViewingSnapshotTracks(null)}
              className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Back to current tracks
            </button>
          )}
        </div>
        {displayTracks.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">No tracks found. Try syncing.</p>
        ) : (
          displayTracks.map((track) => <TrackRow key={track.id} track={track} />)
        )}
      </div>

      {/* Snapshot section */}
      <div className="flex flex-col gap-4 border-t border-gray-800 pt-6">
        <h2 className="text-lg font-semibold">Snapshots</h2>

        <form onSubmit={handleCreateSnapshot} className="flex gap-3">
          <input
            type="text"
            value={snapshotName}
            onChange={(e) => setSnapshotName(e.target.value)}
            placeholder="Snapshot name..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isCreatingSnapshot || !snapshotName.trim()}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            {isCreatingSnapshot ? "Saving..." : "Take Snapshot"}
          </button>
        </form>

        {snapshots.length === 0 ? (
          <p className="text-gray-500 text-sm">No snapshots yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {snapshots.map((s) => (
              <SnapshotItem
                key={s.id}
                snapshot={s}
                onDelete={handleDeleteSnapshot}
                onView={handleViewSnapshot}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
