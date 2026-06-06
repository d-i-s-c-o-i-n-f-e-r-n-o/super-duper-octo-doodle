import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

export function LoginPage() {
  const navigate = useNavigate();
  const { login, refreshMe } = useAuth();

  const [email, setEmail] = useState("admin@hotel.local");
  const [password, setPassword] = useState("Admin12345!");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiFetch<{ accessToken: string; accountType: string; accountId: number }>("/api/auth/login", {
        method: "POST",
        auth: false,
        body: JSON.stringify({ email, password }),
      });
      login(data.accessToken);
      await refreshMe();
      navigate("/app");
    } catch (err: any) {
      setError(err?.message ?? "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ paddingTop: 48 }}>
      <div className="card" style={{ maxWidth: 520, margin: "0 auto", padding: 24 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 850, marginBottom: 6 }}>Вход</div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Авторизация сотрудника или сетевого администратора.</div>
          </div>
          <div style={{ opacity: 0.9, textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "var(--muted)" }}>Безопасность</div>
            <div style={{ fontWeight: 800 }}>Rate limit + RBAC</div>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <div className="label">Email</div>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          </div>

          <div className="field">
            <div className="label">Пароль</div>
            <input
              className="input"
              value={password}
              type="password"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <div className="errorText">{error}</div>}

          <button className="btn btnPrimary" disabled={loading} type="submit" style={{ marginTop: 6 }}>
            {loading ? "Проверка..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
}

