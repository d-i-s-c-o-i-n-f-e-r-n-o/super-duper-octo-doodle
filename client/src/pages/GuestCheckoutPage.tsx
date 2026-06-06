import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type EligibleResponse = {
  eligible: Array<{
    bookingId: number;
    checkOut: string;
    roomNumber: number;
    roomTypeName: string;
    fio: string;
    roomCost: string;
    servicesTotalCost: string;
  }>;
};

export function GuestCheckoutPage() {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<EligibleResponse["eligible"]>([]);

  const [confirm, setConfirm] = useState<{ bookingId: number } | null>(null);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const data = await apiFetch<EligibleResponse>("/api/bookings/checkout/eligible", { method: "GET" });
      setItems(data.eligible ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function doCheckout(bookingId: number) {
    setActionError(null);
    setDoneMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/api/bookings/${bookingId}/checkout`, {
        method: "POST",
        body: JSON.stringify({}),
      } as any);
      setConfirm(null);
      setConfirmChecked(false);
      await load();
      setDoneMsg("Выселение выполнено.");
    } catch (e: any) {
      setActionError(e?.message ?? "Не удалось выселить");
    } finally {
      setLoading(false);
    }
  }

  const grouped = useMemo(() => {
    const map: Record<number, EligibleResponse["eligible"]> = {};
    for (const it of items) {
      // "roomNumber" contains floor? we don't have floor; we can infer from roomNumber if you want later.
      const key = 0;
      if (!map[key]) map[key] = [];
      map[key].push(it);
    }
    return map;
  }, [items]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Выселить</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
        Выберите гостя для выселения (проживание не истекло или сегодня последний день)
      </div>

      {err ? (
        <div className="errorText" style={{ marginTop: 12 }}>
          {err}
        </div>
      ) : null}
      {doneMsg ? <div style={{ color: "#20c997", fontSize: 13, marginTop: 10, fontWeight: 800 }}>{doneMsg}</div> : null}

      {loading ? <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 13 }}>Загрузка...</div> : null}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.length === 0 && !loading ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Нет подходящих гостей на сегодня.</div> : null}

        {items.map((it) => (
          <div
            key={it.bookingId}
            style={{
              padding: 14,
              borderRadius: 16,
              border: "1px solid var(--border)",
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ fontWeight: 950 }}>{`#${it.roomNumber} • ${it.roomTypeName}`}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                  Гость: {it.fio} • Booking #{it.bookingId}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Запланированный выезд: {it.checkOut}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div className="label">Стоимость услуг</div>
                <div style={{ fontWeight: 950 }}>{it.servicesTotalCost}</div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Комната: {it.roomCost}</div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btnDanger"
                disabled={loading}
                style={{ width: "100%" }}
                onClick={() => {
                  setConfirm({ bookingId: it.bookingId });
                  setConfirmChecked(false);
                  setActionError(null);
                }}
              >
                Выселить
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirm ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 50,
          }}
        >
          <div className="card" style={{ width: "min(620px, 100%)", padding: 18 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Подтвердите выселение</div>
            <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
              Booking #{confirm.bookingId}
            </div>

            {actionError ? <div className="errorText" style={{ marginTop: 10 }}>{actionError}</div> : null}

            <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, cursor: "pointer" }}>
              <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
              <span style={{ fontWeight: 800 }}>Да, выселить этого гостя</span>
            </label>

            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setConfirm(null)} disabled={loading}>
                Отмена
              </button>
              <button
                className="btn btnDanger"
                style={{ flex: 1 }}
                disabled={loading || !confirmChecked}
                onClick={() => doCheckout(confirm.bookingId)}
              >
                {loading ? "Выполняю..." : "Выселить"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

