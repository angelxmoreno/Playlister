import { useState, useCallback } from "react";
import { api, setSessionId, clearSessionId } from "../lib/api.js";

export function useAuth() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const register = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { sessionId } = await api.register(email, password);
      setSessionId(sessionId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const { sessionId } = await api.login(email, password);
      setSessionId(sessionId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      clearSessionId();
    }
  }, []);

  return { register, login, logout, isLoading, error, setError };
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("sessionId");
}
