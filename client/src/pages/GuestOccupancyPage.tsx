import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type OccupancyResponse = {
  floors: Record<string, Array<{
    roomNumber: number;
    bookingId: number;
    fio: string;
    roomTypeName: string;
  }>>;
};

export function GuestOccupancyPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [floors, setFloors] = useState<OccupancyResponse["floors"]>({});

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiFetch<OccupancyResponse>("/api/bookings/occupancy", { method: "GET" })
      .then((data) => setFloors(data.floors ?? {}))
      .catch((e: any) => setErr(e?.message ?? "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, []);

  const floorKeys = useMemo(() => Object.keys(floors).map((k) => Number(k)).sort((a, b) => a - b), [floors]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Проживают</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>Текущие заселённые номера по этажам</div>

      {err ? (
        <div className="errorText" style={{ marginTop: 12 }}>
          {err}
        </div>
      ) : null}

      {loading ? <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>Загрузка...</div> : null}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
        {floorKeys.length === 0 && !loading ? (
          <div style={{ color: "var(--muted)", fontSize: 13 }}>Нет активных заселений на сегодня.</div>
        ) : null}

        {floorKeys.map((f) => (
          <div key={f} style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 14, alignItems: "flex-start" }}>
            <div style={{ fontSize: 14, fontWeight: 950, color: "var(--text)" }}>{`Этаж ${f}`}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {(floors[String(f)] ?? []).map((r) => (
                <div
                  key={r.bookingId}
                  style={{
                    width: 170,
                    padding: 12,
                    borderRadius: 16,
                    border: "1px solid var(--border)",
                    background: "rgba(255,255,255,0.04)",
                    boxShadow: "none",
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 950 }}>{`#${r.roomNumber}`}</div>
                  <div style={{ marginTop: 6, fontSize: 13, fontWeight: 850, lineHeight: 1.25 }}>{r.fio}</div>
                  <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>{r.roomTypeName}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

