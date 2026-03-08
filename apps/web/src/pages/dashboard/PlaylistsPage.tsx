import { useState, useEffect } from "react";
import { Link } from "react-router";
import { api, Playlist } from "../../lib/api.js";
import ProviderBadge from "../../components/ProviderBadge.js";

const PROVIDERS = ["all", "spotify", "youtube", "soundcloud", "pandora"];

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  return (
    <Link
      to={`/dashboard/playlists/${playlist.id}`}
      className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:border-indigo-600 transition-colors group"
    >
      <div className="aspect-square bg-gray-800 relative">
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
      <div className="p-3 flex flex-col gap-1">
        <p className="font-medium text-sm truncate group-hover:text-indigo-400 transition-colors">
          {playlist.name}
        </p>
        <div className="flex items-center justify-between">
          <ProviderBadge provider={playlist.provider} />
          <span className="text-xs text-gray-500">{playlist.trackCount ?? 0} tracks</span>
        </div>
      </div>
    </Link>
  );
}

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [filter, setFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPlaylists();
  }, []);

  async function loadPlaylists() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getPlaylists();
      setPlaylists(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load playlists");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSyncAll() {
    setIsSyncing(true);
    try {
      await api.syncAll();
      await loadPlaylists();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIsSyncing(false);
    }
  }

  const filtered =
    filter === "all" ? playlists : playlists.filter((p) => p.provider === filter);

  return (
    <div className="p-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Playlists</h1>
        <button
          onClick={handleSyncAll}
          disabled={isSyncing}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
        >
          {isSyncing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Syncing...
            </>
          ) : (
            "Sync All"
          )}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 border-b border-gray-800 pb-2">
        {PROVIDERS.map((p) => (
          <button
            key={p}
            onClick={() => setFilter(p)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
              filter === p
                ? "bg-indigo-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {error && (
        <p className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-gray-500">
          <p className="text-lg">No playlists found.</p>
          <p className="text-sm">
            Connect a service from the{" "}
            <Link to="/dashboard/services" className="text-indigo-400 hover:underline">
              Services page
            </Link>{" "}
            and hit Sync All.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filtered.map((p) => (
            <PlaylistCard key={p.id} playlist={p} />
          ))}
        </div>
      )}
    </div>
  );
}
