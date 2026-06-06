import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

type ServiceOption = { service_id: number; name: string; cost: string };

type BookingViewResponse = {
  booking: {
    id: number;
    checkIn: string;
    checkOut: string;
    prepaymentDeadline: string;
    isCancelled: boolean;
    cancelledAt: string | null;
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

export function BookingViewPage() {
  const { hasPermission } = useAuth();

  const canView = hasPermission("booking:view");
  const canCancel = hasPermission("booking:cancel");
  const canAddServices = hasPermission("booking:service:add");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [bookingId, setBookingId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [data, setData] = useState<BookingViewResponse | null>(null);

  const [services, setServices] = useState<ServiceOption[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  const [serviceId, setServiceId] = useState<number | "">("");
  const [providedAt, setProvidedAt] = useState<string>(today);
  const [addingService, setAddingService] = useState(false);

  useEffect(() => {
    if (!canView) return;
    setServicesLoading(true);
    apiFetch<{ services: ServiceOption[] }>("/api/meta/me/services", { method: "GET" })
      .then((r) => setServices(r.services))
      .catch(() => setServices([]))
      .finally(() => setServicesLoading(false));
  }, [canView]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const idStr = params.get("id") ?? params.get("booking_id");
    const id = idStr ? Number(idStr) : NaN;
    if (Number.isFinite(id) && id > 0) {
      setBookingId(String(id));
      loadBooking(id);
      // Опционально: нормализовать URL в истории, чтобы всегда был ?id=...
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("id", String(id));
        url.searchParams.delete("booking_id");
        window.history.replaceState({}, "", url.toString());
      } catch {}
    }
  }, []);
  
  

  async function loadBooking(id: number) {
    setErr(null);
    setLoading(true);
    try {
      const res = await apiFetch<BookingViewResponse>(`/api/bookings/${id}`, { method: "GET" });
      setData(res);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось загрузить бронь");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmitLookup(e: React.FormEvent) {
    e.preventDefault();
    const id = Number(bookingId);
    if (!Number.isFinite(id) || id <= 0) {
      setErr("Укажите корректный ID брони.");
      return;
    }
    await loadBooking(id);
  }

  async function onCancel() {
    if (!data) return;
    setErr(null);
    setLoading(true);
    try {
      await apiFetch(`/api/bookings/${data.booking.id}/cancel`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await loadBooking(data.booking.id);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось отменить бронь");
    } finally {
      setLoading(false);
    }
  }

  async function onAddService(e: React.FormEvent) {
    e.preventDefault();
    if (!data) return;
    if (!serviceId) {
      setErr("Выберите услугу.");
      return;
    }
    if (!providedAt) {
      setErr("Укажите дату оказания.");
      return;
    }
    setErr(null);
    setAddingService(true);
    try {
      await apiFetch(`/api/bookings/${data.booking.id}/services`, {
        method: "POST",
        body: JSON.stringify({ serviceId, providedAt }),
      });
      await loadBooking(data.booking.id);
      setServiceId("");
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось добавить услугу");
    } finally {
      setAddingService(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 10 }}>Просмотр информации о брони</div>

      <form onSubmit={onSubmitLookup} style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div className="field" style={{ minWidth: 240 }}>
          <div className="label">ID брони</div>
          <input className="input" value={bookingId} onChange={(e) => setBookingId(e.target.value)} placeholder="Например: 1" />
        </div>
        <button className="btn btnPrimary" disabled={loading || !canView} type="submit">
          {loading ? "Загрузка..." : "Найти"}
        </button>
      </form>

      {err && <div className="errorText" style={{ marginTop: 12 }}>{err}</div>}

      {data ? (
        <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: 14 }}>
          <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.04)", boxShadow: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900 }}>Бронь #{data.booking.id}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  {data.booking.isCancelled ? "Отменена" : "Активна"} {data.booking.cancelledAt ? `• ${data.booking.cancelledAt}` : ""}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Предоплата до</div>
                <div style={{ fontWeight: 800 }}>{data.booking.prepaymentDeadline}</div>
              </div>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div className="label">Постоялец</div>
                <div style={{ fontWeight: 850 }}>
                  {data.booking.client.lastName} {data.booking.client.firstName} {data.booking.client.middleName}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>Паспорт: {data.booking.client.passport}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Тел: {data.booking.client.phone}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Email: {data.booking.client.email}</div>
              </div>
              <div>
                <div className="label">Корпус и номер</div>
                <div style={{ fontWeight: 850 }}>
                  #{data.booking.room.roomNumber} • {data.booking.room.type.name}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 4 }}>
                  Адрес: {data.booking.building.address.city}, {data.booking.building.address.street} {data.booking.building.address.house}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>
                  Этаж: {data.booking.room.floor} • Вместимость: {data.booking.room.capacity}
                </div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Стоимость: {data.booking.room.cost}</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div className="label">Дополнительные услуги</div>
              {data.additionalServices.length === 0 ? (
                <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>Услуг не оказано.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
                  {data.additionalServices.map((s) => (
                    <div
                      key={`${s.service.id}-${s.providedAt}-${s.providedBy.lastName}`}
                      style={{
                        padding: 12,
                        borderRadius: 14,
                        border: "1px solid var(--border)",
                        background: "rgba(255,255,255,0.04)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ fontWeight: 850 }}>
                          {s.service.name}{" "}
                          <span style={{ color: "var(--muted)", fontWeight: 600 }}>• {s.cost}</span>
                        </div>
                        <div style={{ color: "var(--muted)", fontSize: 12 }}>{s.providedAt}</div>
                      </div>
                      <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 6 }}>
                        Оказал: {s.providedBy.lastName} {s.providedBy.firstName} {s.providedBy.middleName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 14, background: "rgba(255,255,255,0.04)", boxShadow: "none" }}>
            <div className="label">Действия</div>

            {canCancel ? (
              <div style={{ marginTop: 10 }}>
                <button
                  className="btn btnDanger"
                  style={{ width: "100%" }}
                  onClick={onCancel}
                  disabled={loading || data.booking.isCancelled}
                >
                  {data.booking.isCancelled ? "Бронь отменена" : "Отменить бронь"}
                </button>
              </div>
            ) : (
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>Отмена недоступна вашей должности.</div>
            )}

            <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--border)" }} />

            {canAddServices ? (
              <div>
                <div style={{ fontWeight: 850, marginBottom: 8 }}>Добавить услугу</div>
                <form onSubmit={onAddService} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="field">
                    <div className="label">Услуга</div>
                    <select className="input"
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value ? Number(e.target.value) : "")}
                      style={{background: "var(--card)", color: "var(--text)"}}>
                      <option value="">— выберите —</option>
                      {servicesLoading ? <option>Загрузка...</option> : null}
                      {services.map((s) => (
                        <option key={s.service_id} value={s.service_id}>
                          {s.name} • {s.cost}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <div className="label">Дата оказания</div>
                    <input className="input" type="date" value={providedAt} onChange={(e) => setProvidedAt(e.target.value)} />
                  </div>
                  <button className="btn btnPrimary" type="submit" disabled={addingService || loading}>
                    {addingService ? "Добавление..." : "Добавить"}
                  </button>
                </form>
              </div>
            ) : (
              <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 13 }}>
                Добавление услуг недоступно вашей должности.
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 16, color: "var(--muted)", fontSize: 13 }}>Введите ID брони и нажмите “Найти”.</div>
      )}
    </div>
  );
}

