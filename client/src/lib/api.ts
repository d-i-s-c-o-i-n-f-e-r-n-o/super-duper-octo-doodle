import { getAccessToken } from "./authStorage";

export type ApiError = { message: string };

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:4000";

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const token = options.auth === false ? null : getAccessToken();

  const { auth: _authOpt, ...init } = options;

  const headers = new Headers(options.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && options.body) headers.set("Content-Type", "application/json");

  const res = await fetch(url, {
    ...init,
    headers,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as any) : null;

  if (!res.ok) {
    const message = (data && data.message) || `Request failed (${res.status})`;
    throw { message } satisfies ApiError;
  }

  return data as T;
}

