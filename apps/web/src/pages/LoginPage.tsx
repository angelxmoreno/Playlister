import { useState, useEffect, FormEvent } from "react";
import { useNavigate, Link } from "react-router";
import { useAuth, isAuthenticated } from "../hooks/useAuth.js";
import { setSessionId } from "../lib/api.js";

export default function LoginPage() {
  const navigate = useNavigate();
  const { register, login, isLoading, error, setError } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Handle OAuth callback — session ID passed as query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get("session");
    if (sessionParam) {
      setSessionId(sessionParam);
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  // Already logged in
  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/dashboard", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const success =
      mode === "register"
        ? await register(email, password)
        : await login(email, password);
    if (success) {
      navigate("/dashboard", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 w-full max-w-md flex flex-col gap-6">
        <Link to="/" className="text-indigo-400 font-bold text-xl self-center">
          PlaylistVault
        </Link>

        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "login" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              mode === "register" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
            }`}
            onClick={() => setMode("register")}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-sm text-gray-400">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {isLoading
              ? "Please wait..."
              : mode === "login"
              ? "Log in"
              : "Create account"}
          </button>
        </form>

        <div className="relative flex items-center gap-3">
          <div className="flex-1 h-px bg-gray-800" />
          <span className="text-gray-600 text-sm">or continue with</span>
          <div className="flex-1 h-px bg-gray-800" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <a
            href={`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/auth/spotify`}
            className="flex items-center justify-center gap-2 bg-[#1DB954] hover:opacity-90 text-black font-medium py-2 rounded-lg transition-opacity text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            Spotify
          </a>
          <a
            href={`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/auth/youtube`}
            className="flex items-center justify-center gap-2 bg-[#FF0000] hover:opacity-90 text-white font-medium py-2 rounded-lg transition-opacity text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
            YouTube
          </a>
          <a
            href={`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/auth/soundcloud`}
            className="flex items-center justify-center gap-2 bg-[#FF5500] hover:opacity-90 text-white font-medium py-2 rounded-lg transition-opacity text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M11.56 8.87V17h8.76c1.001 0 1.81-.809 1.81-1.81 0-.907-.668-1.659-1.541-1.798.031-.17.047-.345.047-.524 0-1.67-1.354-3.023-3.023-3.023-.506 0-.98.133-1.393.361C15.868 9.024 14.772 8.25 13.5 8.25c-.707 0-1.357.232-1.882.62h-.058zm-1.56 8.13H1.5A1.5 1.5 0 0 1 0 15.518V8.5C0 7.672.672 7 1.5 7 2.328 7 3 7.672 3 8.5V9c0-.552.448-1 1-1s1 .448 1 1v-.5C5 7.672 5.672 7 6.5 7 7.328 7 8 7.672 8 8.5v.5c0-.552.448-1 1-1s1 .448 1 1V17z" />
            </svg>
            SoundCloud
          </a>
          <a
            href={`${import.meta.env.VITE_API_URL ?? "http://localhost:3001"}/auth/pandora`}
            className="flex items-center justify-center gap-2 bg-[#3668FF] hover:opacity-90 text-white font-medium py-2 rounded-lg transition-opacity text-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M0 12C0 5.373 5.373 0 12 0s12 5.373 12 12-5.373 12-12 12S0 18.627 0 12zm8.5-5.5v11h3V6.5H8.5zm4 0v11h3V6.5h-3zm4 3v8h3v-8h-3z" />
            </svg>
            Pandora
          </a>
        </div>
      </div>
    </div>
  );
}
