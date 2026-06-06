import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type UpcomingBookingRow = {
  booking_id: number;
  booking_building_id: number;
  check_in: string;
  check_out: string;
  room_number: number;
  room_floor: number;
  room_type_name: string;
  client_last_name: string;
  client_first_name: string;
  client_middle_name: string;
};
type BookingViewResponse = {
  booking: {
    id: number;
    isCancelled?: boolean;
    cancelledAt?: string | null;
    is_cancelled?: boolean;
    cancelled_at?: string | null;
  };
};


//function parseYmdToLocalDate(ymd: string): Date {
  // Keep "day" semantics stable by using local midnight.
  //const [y, m, d] = ymd.split("-").map((x) => Number(x));
  //return new Date(y, m - 1, d, 0, 0, 0, 0);
//}

function parseYmdToLocalDate(ymd: string): Date {
  const datePart = String(ymd).slice(0, 10); // "YYYY-MM-DD"
  const [y, m, d] = datePart.split("-").map((x) => Number(x));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function addDays(ymd: string, days: number): string {
  const dt = parseYmdToLocalDate(ymd);
  dt.setDate(dt.getDate() + days);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function diffDays(aYmd: string, bYmd: string): number {
  const a = parseYmdToLocalDate(aYmd);
  const b = parseYmdToLocalDate(bYmd);
  const ms = b.getTime() - a.getTime();
  return Math.round(ms / (24 * 60 * 60 * 1000));
}

export function HomePage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [rows, setRows] = useState<UpcomingBookingRow[]>([]);
  const [selectedFloor, setSelectedFloor] = useState<"all" | number>("all"); //Этаж

  useEffect(() => {
    setLoading(true);
    setErr(null);
    apiFetch<{ start: string; end: string; bookings: UpcomingBookingRow[] }>("/api/bookings/upcoming?days=7", {
      method: "GET",
    })
    .then(async (data) => {
      setStart(data.start);
      setEnd(data.end);
    
      // Для каждого элемента data.bookings запрашиваем полный view, чтобы узнать точное состояние отмены,
      // т.к. в списке upcoming поле отмены отсутствует.
      const bookings: UpcomingBookingRow[] = data.bookings ?? [];
    
      const detailed = await Promise.all(
        bookings.map(async (b) => {
          try {
            const full = await apiFetch<BookingViewResponse>(`/api/bookings/${b.booking_id}`, { method: "GET" });
            const bk = full?.booking as BookingViewResponse["booking"] | undefined;
            const isCancelled =
              !!bk && (bk.isCancelled === true || !!bk.cancelledAt || (bk as any).is_cancelled === true || !!(bk as any).cancelled_at);

            return { row: b, cancelled: Boolean(isCancelled) };
          } catch {
            // при ошибке считаем бронь активной, чтобы не ошибочно скрыть её
            return { row: b, cancelled: false };
          }
        }),
      );
    
      setRows(detailed.filter((d) => !d.cancelled).map((d) => d.row));
    })
    
      .catch((e: any) => setErr(e?.message ?? "Ошибка загрузки диаграммы"))
      .finally(() => setLoading(false));
  }, []);

  const days = useMemo(() => {
    if (!start) return [];
    return Array.from({ length: 7 }).map((_, i) => addDays(start, i));
  }, [start]);

  const floors = useMemo(() => {
    const setFloors = new Set<number>();
    for (const r of rows) setFloors.add(r.room_floor);
    return Array.from(setFloors).sort((a, b) => a - b);
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (selectedFloor === "all") return rows;
    return rows.filter((r) => r.room_floor === selectedFloor);
  }, [rows, selectedFloor]);

  const rooms = useMemo(() => {
    const map = new Map<string, { key: string; buildingId: number; room_floor: number; room_number: number; room_type_name: string }>();
    for (const r of filteredRows) {
      const key = `${r.booking_building_id}:${r.room_number}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          buildingId: r.booking_building_id,
          room_floor: r.room_floor,
          room_number: r.room_number,
          room_type_name: r.room_type_name,
        });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => a.buildingId - b.buildingId || a.room_floor - b.room_floor || a.room_number - b.room_number,
    );
  }, [filteredRows, selectedFloor]);
  //}, [rows]);

  const bookingsByRoom = useMemo(() => {
    const map: Record<string, UpcomingBookingRow[]> = {};
    for (const r of rows) {
      const key = `${r.booking_building_id}:${r.room_number}`;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return map;
  }, [filteredRows]);
  //}, [rows]);

  const dayCount = 7;
  //const colWidth = 28;

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Главная</div>
          <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
            Диаграмма Ганта: брони на ближайшие 7 дней {start && end ? `(${start} - ${end})` : ""}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          {loading ? <div style={{ color: "var(--muted)", fontSize: 12 }}>Загрузка...</div> : null}
          {err ? <div style={{ color: "#ff5b7b", fontSize: 12, marginTop: 4 }}>{err}</div> : null}
        </div>
      </div>

    <div style={{marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <div style={{ fontSize: 13, color: "var(--muted)" }}>
        Фильтр по этажу:
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center"}}>
        <select
          value={selectedFloor === "all" ? "all" : String(selectedFloor)}
          onChange={(e) => {
            const v = e.target.value;
            setSelectedFloor(v === "all" ? "all" : Number(v));
          }}
          style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--card)", color: "var(--text)"}}
        >
           <div style={{ color: "var(--text)" }}>
          <option value="all">Все этажи</option>
          {floors.map((f) => (
            <option key={f} value={String(f)}>
              Этаж {f}
            </option>
          ))}
          </div> 
        </select>
      </div>
    </div>

    <div style={{ marginTop: 14, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "stretch", width: "100%" /*minWidth: colWidth * dayCount + 180 */}}>
          <div style={{ width: 160, paddingTop: 6, color: "var(--muted)", fontSize: 12, fontWeight: 800 }}>
            Номер
          </div>
          <div style={{ flex:1,display: "grid", gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` as any, gap: 2 }}>
            {days.map((d) => (
              <div key={d} style={{ fontSize: 12, color: "var(--muted)", fontWeight: 700, textAlign: "center" }}>
                {d.slice(5)}
              </div>
            ))}
          </div>
        </div>

        {rooms.length === 0 && !loading ? (
          <div style={{ marginTop: 18, color: "var(--muted)", fontSize: 13 }}>Нет активных броней на диапазоне.</div>
        ) : null}

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          {rooms.map((room) => {
            const roomBookings = bookingsByRoom[room.key] ?? [];
            return (
              <div key={room.key} style={{ display: "flex", alignItems: "stretch", width: "100%" /*minWidth: colWidth * dayCount + 180 */}}>
                <div style={{ width: 160 }}>
                  <div style={{ fontWeight: 900 }}>{`К${room.buildingId} • #${room.room_number}`}</div>
                  <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                    Этаж {room.room_floor} • {room.room_type_name}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      position: "relative",
                      display: "grid",
                      gridTemplateColumns: `repeat(${dayCount}, minmax(0, 1fr))` as any,
                      gap: 2,
                      padding: 6,
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      minHeight: 42,
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    {roomBookings.map((b) => {
                      const effectiveStart = b.check_in > start ? b.check_in : start;
                      const effectiveEnd = b.check_out < end ? b.check_out : end;
                      const startOffset = diffDays(start, effectiveStart);
                      const endOffset = diffDays(start, effectiveEnd);
                      const left = startOffset;
                      const right = endOffset;
                      const span = Math.max(1, right - left + 1);
                      const fio = `${b.client_last_name} ${b.client_first_name} ${b.client_middle_name}`.trim();
                      return (
                        <div
                          key={b.booking_id}
                          role="button"
                          tabIndex={0}
                          onClick={async () => {
                            try {
                              window.location.href = `/app/booking/view?id=${b.booking_id}`;
                              await apiFetch(`/api/bookings/${b.booking_id}`, { method: "GET" });
                              
                            } catch (e) {
                              // ignore
                            }
                          }}                          
                          
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              (e.target as HTMLElement).click();
                            }
                          }}
                          style={{
                            gridColumn: `${left + 1} / ${left + 1 + span}`,
                            alignSelf: "stretch",
                            background: "rgba(var(--accent-rgb), 0.18)",
                            border: "1px solid rgba(var(--accent-rgb), 0.35)",
                            borderRadius: 10,
                            padding: "7px 8px",
                            display: "flex",
                            flexDirection: "column",
                            justifyContent: "center",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            textOverflow: "ellipsis",
                            height: "100%",
                          }}
                          title={`Бронь #${b.booking_id}\n${fio}\n${b.check_in} - ${b.check_out}`}
                        >
                          <div style={{ fontSize: 12, fontWeight: 900 }}>{fio}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{`#${b.booking_id}`}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

