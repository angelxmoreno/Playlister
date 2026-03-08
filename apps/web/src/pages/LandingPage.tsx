import { Link } from "react-router";

const FEATURES = [
  {
    title: "Connect All Your Services",
    description: "Link Spotify, YouTube Music, SoundCloud, and Pandora in one place.",
    icon: "🔗",
  },
  {
    title: "Unified Playlist View",
    description: "Browse all your playlists across every service in a single dashboard.",
    icon: "🎵",
  },
  {
    title: "Snapshot & Archive",
    description: "Take point-in-time snapshots of any playlist so your music is never lost.",
    icon: "📸",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <span className="text-xl font-bold text-indigo-400">PlaylistVault</span>
        <div className="flex gap-4">
          <Link
            to="/login"
            className="text-sm text-gray-300 hover:text-white transition-colors"
          >
            Log in
          </Link>
          <Link
            to="/login"
            className="text-sm bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg transition-colors"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-8 py-24 gap-6">
        <h1 className="text-5xl font-extrabold tracking-tight max-w-2xl">
          Your Music, <span className="text-indigo-400">Preserved Forever</span>
        </h1>
        <p className="text-lg text-gray-400 max-w-xl">
          PlaylistVault connects to all your music streaming accounts and lets
          you view, manage, and archive your playlists in one secure place.
        </p>
        <Link
          to="/login"
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl text-lg transition-colors"
        >
          Start for free
        </Link>
      </section>

      {/* Features */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto px-8 pb-24">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="bg-gray-900 rounded-2xl p-6 flex flex-col gap-3 border border-gray-800"
          >
            <span className="text-3xl">{f.icon}</span>
            <h3 className="font-semibold text-lg">{f.title}</h3>
            <p className="text-gray-400 text-sm">{f.description}</p>
          </div>
        ))}
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm pb-8">
        PlaylistVault &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
}
