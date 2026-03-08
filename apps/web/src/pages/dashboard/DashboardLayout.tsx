import { NavLink, Outlet, useNavigate } from "react-router";
import { useAuth } from "../../hooks/useAuth.js";

const PROVIDER_ICONS: Record<string, { color: string; label: string }> = {
  spotify: { color: "#1DB954", label: "Spotify" },
  youtube: { color: "#FF0000", label: "YouTube" },
  soundcloud: { color: "#FF5500", label: "SoundCloud" },
  pandora: { color: "#3668FF", label: "Pandora" },
};

export default function DashboardLayout() {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 text-white"
        : "text-gray-400 hover:text-white hover:bg-gray-800"
    }`;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 border-r border-gray-800 flex flex-col p-4 gap-6 shrink-0">
        <span className="text-lg font-bold text-indigo-400 px-3 pt-2">
          PlaylistVault
        </span>

        <nav className="flex flex-col gap-1">
          <NavLink to="/dashboard/playlists" className={navLinkClass}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
            Playlists
          </NavLink>
          <NavLink to="/dashboard/services" className={navLinkClass}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Services
          </NavLink>
        </nav>

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex gap-2 px-3">
            {Object.entries(PROVIDER_ICONS).map(([key, { color, label }]) => (
              <div
                key={key}
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
                title={label}
              />
            ))}
          </div>
          <button
            onClick={handleLogout}
            className="text-left px-3 py-2 text-sm text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
