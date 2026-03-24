"use client";

import { useEffect, useState, useCallback } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  organization: string | null;
  authProvider: "openai_auth";
  sessionMode: "web_cookie" | "electron_local";
  openaiConnected: boolean;
  openaiConnection: {
    status: "valid" | "invalid" | "degraded";
    lastErrorMessage: string | null;
    capabilities: {
      basic: boolean;
      json: boolean;
      streaming: boolean;
      toolCalling: boolean;
      liteModel: boolean;
    };
  } | null;
}

interface UseUserReturn {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (user?.sessionMode === "electron_local") {
      return;
    }
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/auth/login";
  }, [user?.sessionMode]);

  return { user, loading, logout, refresh };
}
