import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";

type BookingDetails = {
  booking: {
    id: number;
    checkIn: string;
    checkOut: string;
    prepaymentDeadline: string;
    isCancelled: boolean;
    cancelledAt: string | null;
    isCheckedOut: boolean;
    checkedOutAt: string | null;
    client: {
      id: number;
      lastName: string;
      firstName: string;
      middleName: string;
      passport: string;
      phone: string;
      email: string;
    };
    room: {
      roomNumber: number;
      cost: string;
      floor: number;
      capacity: number;
      type: { id: number; name: string };
    };
    building: {
      id: number;
      floors: number;
      hotelClass: { stars: number; name: string };
      address: { city: string; street: string; house: string };
    };
    createdBy: {
      employeeId: number;
      lastName: string;
      firstName: string;
      middleName: string;
    };
  };
  additionalServices: Array<{
    providedAt: string;
    service: { id: number; name: string };
    cost: string;
    providedBy: { lastName: string; firstName: string; middleName: string };
  }>;
};

export function BookingCancelPage() {
  const [bookingId, setBookingId] = useState<string>("");
  const [passport, setPassport] = useState<string>("");
  const [searchError, setSearchError] = useState<string | null>(null);

  const [results, setResults] = useState<BookingDetails[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const selected = results[selectedIndex] ?? null;

  const [loading, setLoading] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);

  const canSearch = useMemo(() => {
    const bId = Number(bookingId);
    const bOk = Number.isFinite(bId) && bId > 0;
    const pOk = /^[0-9]{10}$/.test(passport.trim());
    return bOk || pOk;
  }, [bookingId, passport]);

  async function onSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);
    setActionError(null);
    setDoneMsg(null);
    setConfirmChecked(false);
    setResults([]);
    setSelectedIndex(0);

    const bId = bookingId.trim() ? Number(bookingId) : undefined;
    const p = passport.trim() ? passport.trim() : undefined;

    if (!bId && !p) {
      setSearchError("Укажите booking id или паспорт.");
      return;
    }

    const payload: any = {};
    if (bId) payload.bookingId = bId;
    if (p) payload.passport = p;

    setLoading(true);
    try {
      const data = await apiFetch<{ bookings: BookingDetails[] }>("/api/bookings/lookup", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setResults(data.bookings ?? []);
      if ((data.bookings ?? []).length === 0) setSearchError("Не найдено активных броней по заданным данным.");
    } catch (err: any) {
      setSearchError(err?.message ?? "Ошибка поиска брони");
    } finally {
      setLoading(false);
    }
  }

  async function onConfirmCancel() {
    if (!selected) return;
    if (!confirmChecked) {
      setActionError("Подтвердите отмену чекбоксом.");
      return;
    }
    setActionError(null);
    setDoneMsg(null);
    setLoading(true);
    try {
      await apiFetch(`/api/bookings/${selected.booking.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      } as any);
      setDoneMsg(`Бронь #${selected.booking.id} отменена.`);
      setConfirmChecked(false);
      // Keep results but refresh action state by clearing selection.
      setResults([]);
      setSelectedIndex(0);
    } catch (err: any) {
      setActionError(err?.message ?? "Не удалось отменить бронь");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setConfirmChecked(false);
    setActionError(null);
    setDoneMsg(null);
  }, [selectedIndex]);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Отменить бронь</div>
      
      <form onSubmit={onSearch} style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field">
          <div className="label">ИД брони</div>
          <input className="input" value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="Например: 1" />
        </div>
        <div className="field">
          <div className="label">Паспорт гостя (10 цифр)</div>
          <input className="input" value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="1234567890" inputMode="numeric" />
        </div>
        <div style={{ gridColumn: "1 / -1", display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
          <button className="btn btnPrimary" disabled={loading || !canSearch} type="submit">
            {loading ? "Поиск..." : "Найти бронь"}
          </button>
        </div>
        {searchError ? (
          <div className="errorText" style={{ gridColumn: "1 / -1" }}>
            {searchError}
          </div>
        ) : null}
      </form>

      {results.length > 0 ? (
        <div style={{ marginTop: 16 }}>
          {results.length > 1 ? (
            <div className="field" style={{ maxWidth: 520 }}>
              <div className="label">Выбор брони</div>
              <select className="input" value={selectedIndex} onChange={(e) => setSelectedIndex(Number(e.target.value))}>
                {results.map((r, idx) => (
                  <option key={r.booking.id} value={idx}>
                    #{r.booking.id} • {r.booking.client.lastName} {r.booking.client.firstName} • {r.booking.room.roomNumber}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {selected ? (
            <>
              <div style={{ marginTop: 14, padding: 14, border: "1px solid var(--border)", borderRadius: 14, background: "rgba(255,255,255,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontWeight: 950, fontSize: 16 }}>{`Бронь #${selected.booking.id}`}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                      Заезд: {selected.booking.checkIn} • Выезд: {selected.booking.checkOut} • Предоплата до: {selected.booking.prepaymentDeadline}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="label">Статус</div>
                    <div style={{ fontWeight: 900, fontSize: 13 }}>{selected.booking.isCancelled ? "Отменена" : selected.booking.isCheckedOut ? "Выселена" : "Активна"}</div>
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div className="label">Постоялец</div>
                    <div style={{ fontWeight: 850 }}>
                      {selected.booking.client.lastName} {selected.booking.client.firstName} {selected.booking.client.middleName}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Паспорт: {selected.booking.client.passport}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>Телефон: {selected.booking.client.phone}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>Email: {selected.booking.client.email}</div>
                  </div>
                  <div>
                    <div className="label">Номер</div>
                    <div style={{ fontWeight: 850 }}>
                      #{selected.booking.room.roomNumber} • {selected.booking.room.type.name}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                      Этаж: {selected.booking.room.floor} • Вместимость: {selected.booking.room.capacity}
                    </div>
                    <div style={{ color: "var(--muted)", fontSize: 12 }}>Стоимость: {selected.booking.room.cost}</div>
                    <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                      Адрес: {selected.booking.building.address.city}, {selected.booking.building.address.street} {selected.booking.building.address.house}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 14 }}>
                  <div className="label">Оказанные доп. услуги</div>
                  {selected.additionalServices.length === 0 ? (
                    <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>Услуг не оказывалось.</div>
                  ) : (
                    <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                      {selected.additionalServices.map((s) => (
                        <div key={`${s.service.id}-${s.providedAt}`} style={{ padding: 12, borderRadius: 14, border: "1px solid var(--border)", background: "rgba(255,255,255,0.03)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                            <div style={{ fontWeight: 850 }}>{s.service.name}</div>
                            <div style={{ color: "var(--muted)", fontSize: 12 }}>{s.cost}</div>
                          </div>
                          <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                            {s.providedAt} • Оказал: {s.providedBy.lastName} {s.providedBy.firstName} {s.providedBy.middleName}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ marginTop: 14, padding: 14, border: "1px solid rgba(255,77,115,0.35)", borderRadius: 14, background: "rgba(255,77,115,0.06)" }}>
                <div style={{ fontWeight: 900 }}>Подтверждение отмены</div>
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
                  После отмены бронь станет недоступна для дальнейших операций.
                </div>

                <label style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={confirmChecked} onChange={(e) => setConfirmChecked(e.target.checked)} />
                  <span style={{ fontWeight: 800 }}>{`Да, отменить бронь #${selected.booking.id}`}</span>
                </label>

                {actionError ? (
                  <div className="errorText" style={{ marginTop: 10 }}>
                    {actionError}
                  </div>
                ) : null}
                {doneMsg ? (
                  <div style={{ color: "#20c997", fontSize: 13, marginTop: 10, fontWeight: 800 }}>{doneMsg}</div>
                ) : null}

                <button className="btn btnDanger" style={{ width: "100%", marginTop: 12 }} onClick={onConfirmCancel} disabled={loading || !confirmChecked}>
                  {loading ? "Отмена..." : "Отменить бронь"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

