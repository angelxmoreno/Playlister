import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

interface ConnectedService {
  id: string;
  provider: string;
  createdAt: string | null;
}

const SERVICE_CONFIG: Record<
  string,
  { label: string; color: string; description: string }
> = {
  spotify: {
    label: "Spotify",
    color: "#1DB954",
    description: "Access your Spotify playlists and library.",
  },
  youtube: {
    label: "YouTube Music",
    color: "#FF0000",
    description: "Sync YouTube playlists via your Google account.",
  },
  soundcloud: {
    label: "SoundCloud",
    color: "#FF5500",
    description: "Connect your SoundCloud playlists and sets.",
  },
  pandora: {
    label: "Pandora",
    color: "#3668FF",
    description: "Import your Pandora stations and playlists.",
  },
};

export default function ServicesPage() {
  const [connected, setConnected] = useState<ConnectedService[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  // Load connected services by attempting to get playlists per provider
  // In a real app you'd have a /auth/services endpoint; for now derive from playlists
  async function loadServices() {
    setIsLoading(true);
    try {
      const playlists = await api.getPlaylists();
      const providers = [...new Set(playlists.map((p) => p.provider))];
      setConnected(
        providers.map((p) => ({ id: p, provider: p, createdAt: null }))
      );
    } catch {
      // Not connected to anything yet is fine
      setConnected([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDisconnect(provider: string) {
    setDisconnecting(provider);
    setError(null);
    try {
      await api.disconnectService(provider);
      setConnected((prev) => prev.filter((s) => s.provider !== provider));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  }

  const connectedProviders = new Set(connected.map((s) => s.provider));

  return (
    <div className="p-8 flex flex-col gap-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Connected Services</h1>
      <p className="text-gray-400 text-sm">
        Connect your music streaming accounts to start syncing playlists.
      </p>

      {error && (
        <p className="text-red-400 bg-red-900/20 border border-red-800 rounded-lg px-4 py-3 text-sm">
          {error}
        </p>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <svg className="w-8 h-8 animate-spin text-indigo-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(SERVICE_CONFIG).map(([key, config]) => {
            const isConnected = connectedProviders.has(key);
            return (
              <div
                key={key}
                className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4"
              >
                <div
                  className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: config.color }}
                >
                  {config.label[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium">{config.label}</p>
                  <p className="text-sm text-gray-500">{config.description}</p>
                </div>
                {isConnected ? (
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-green-400 bg-green-900/30 border border-green-800 px-2 py-1 rounded-full">
                      Connected
                    </span>
                    <button
                      onClick={() => handleDisconnect(key)}
                      disabled={disconnecting === key}
                      className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {disconnecting === key ? "..." : "Disconnect"}
                    </button>
                  </div>
                ) : (
                  <a
                    href={`${API_URL}/auth/${key}`}
                    className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors shrink-0"
                  >
                    Connect
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
