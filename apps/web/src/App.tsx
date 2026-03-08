import { Routes, Route, Navigate } from "react-router";
import { isAuthenticated } from "./hooks/useAuth.js";
import LandingPage from "./pages/LandingPage.js";
import LoginPage from "./pages/LoginPage.js";
import DashboardLayout from "./pages/dashboard/DashboardLayout.js";
import PlaylistsPage from "./pages/dashboard/PlaylistsPage.js";
import PlaylistDetailPage from "./pages/dashboard/PlaylistDetailPage.js";
import ServicesPage from "./pages/dashboard/ServicesPage.js";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard/playlists" replace />} />
        <Route path="playlists" element={<PlaylistsPage />} />
        <Route path="playlists/:id" element={<PlaylistDetailPage />} />
        <Route path="services" element={<ServicesPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
