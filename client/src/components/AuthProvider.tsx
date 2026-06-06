import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { clearAccessToken, getAccessToken, setAccessToken } from "../lib/authStorage";

export type MeResponse = {
  accountId: number;
  accountType: "network_admin" | "hotel_staff";
  staff?: { employeeId: number; buildingId: number; positionId: number; positionName: string };
  permissions: string[];
};

type AuthContextValue = {
  me: MeResponse | null;
  loading: boolean;
  hasPermission: (code: string) => boolean;
  login: (accessToken: string) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  async function refreshMe() {
    const token = getAccessToken();
    if (!token) {
      setMe(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<MeResponse>("/api/auth/me", { method: "GET", auth: true });
      setMe(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshMe().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    return {
      me,
      loading,
      hasPermission: (code: string) => {
        if (!me) return false;
        if (me.permissions.includes("*")) return true;
        return me.permissions.includes(code);
      },
      login: (accessToken: string) => {
        setAccessToken(accessToken);
      },
      logout: () => {
        clearAccessToken();
        setMe(null);
      },
      refreshMe,
    };
  }, [me, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

