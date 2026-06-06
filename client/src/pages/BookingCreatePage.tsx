import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

type Room = {
  room_number: number;
  floor: number;
  cost: string;
  room_type_id: number;
  room_type_name: string;
  capacity: number;
};

type ClientLookup = {
  client_id: number;
  last_name: string;
  first_name: string;
  middle_name: string;
  passport: string;
  phone: string;
  email: string;
};

function addDaysStr(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function BookingCreatePage() {
  const { hasPermission } = useAuth();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  const [passport, setPassport] = useState("");
  const [clientLookupLoading, setClientLookupLoading] = useState(false);
  const [clientLookup, setClientLookup] = useState<ClientLookup | null>(null);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [roomNumber, setRoomNumber] = useState<number | "">("");
  const [checkIn, setCheckIn] = useState(addDaysStr(1));
  const [checkOut, setCheckOut] = useState(addDaysStr(3));
  const [prepaymentDeadline, setPrepaymentDeadline] = useState(addDaysStr(1));

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdBookingId, setCreatedBookingId] = useState<number | null>(null);

  const canViewRooms = hasPermission("booking:view");
  const canCreateClient = hasPermission("clients:create");
  const canCreateBooking = hasPermission("booking:create");

  useEffect(() => {
    if (!canViewRooms) return;
    setRoomsLoading(true);
    apiFetch<{ rooms: Room[] }>("/api/meta/me/rooms", { method: "GET" })
      .then((data) => setRooms(data.rooms))
      .catch(() => setRooms([]))
      .finally(() => setRoomsLoading(false));
  }, [canViewRooms]);

  const passportOk = useMemo(() => /^[0-9]{10}$/.test(passport.trim()), [passport]);
  const needsManualClient = !clientLookup;

  function validateBeforeSubmit() {
    if (!passportOk) return "Паспорт должен содержать 10 цифр без пробелов.";
    if (!roomNumber) return "Выберите номер комнаты.";
    if (!checkIn || !checkOut || !prepaymentDeadline) return "Заполните даты.";
    if (checkOut < checkIn) return "Дата выезда должна быть позже даты заезда.";
    if (prepaymentDeadline < todayStr() || prepaymentDeadline > checkOut) return "Срок предоплаты должен быть между сегодня и датой выезда.";

    if (needsManualClient) {
      if (!canCreateClient) return "У вас нет прав на создание гостя.";
      if (!lastName.trim() || !firstName.trim() || !phone.trim() || !email.trim()) return "Заполните данные гостя.";
      if (!/^\+[0-9]{11,12}$/.test(phone.trim())) return "Телефон должен быть в формате +XXXXXXXXXXX.";
    }
    if (!canCreateBooking) return "У вас нет прав для создания брони.";
    return null;
  }

  async function lookupClient() {
    setSubmitError(null);
    const p = passport.trim();
    if (!/^[0-9]{10}$/.test(p)) {
      setClientLookup(null);
      return;
    }
    setClientLookupLoading(true);
    try {
      const data = await apiFetch<{ client: ClientLookup | null }>(
        `/api/clients/lookup?passport=${encodeURIComponent(p)}`,
        { method: "GET" },
      );
      setClientLookup(data.client);
      if (data.client) {
        setLastName(data.client.last_name);
        setFirstName(data.client.first_name);
        setMiddleName(data.client.middle_name);
        setPhone(data.client.phone);
        setEmail(data.client.email);
      }
    } catch (e: any) {
      setSubmitError(e?.message ?? "Ошибка поиска гостя");
    } finally {
      setClientLookupLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setCreatedBookingId(null);

    const err = validateBeforeSubmit();
    if (err) {
      setSubmitError(err);
      return;
    }

    setSubmitting(true);
    try {
      const payload: any = {
        passport: passport.trim(),
        roomNumber: roomNumber as number,
        checkIn,
        checkOut,
        prepaymentDeadline,
      };
      if (needsManualClient) {
        payload.client = {
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          phone: phone.trim(),
          email: email.trim(),
        };
      }

      const data = await apiFetch<{ ok: boolean; bookingId: number }>("/api/bookings/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setCreatedBookingId(data.bookingId);
    } catch (e: any) {
      setSubmitError(e?.message ?? "Не удалось создать бронь");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14 }}>
          <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 6 }}>Оформление брони</div>
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Паспорт гостя (10 цифр, без пробелов)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              className="input"
              value={passport}
              onChange={(e) => {
                setPassport(e.target.value);
                setClientLookup(null);
              }}
              onBlur={() => lookupClient()}
              placeholder="Например: 1234567890"
              inputMode="numeric"
            />
            <button className="btn" type="button" onClick={() => lookupClient()} disabled={!passportOk || clientLookupLoading}>
              {clientLookupLoading ? "Поиск..." : "Автопоиск"}
            </button>
          </div>
          {passport && !passportOk && <div className="errorText">Формат паспорта не подходит.</div>}
        </div>

        <div className="field">
          <div className="label">Номер комнаты</div>
          <select className="input"
            value={roomNumber}
            onChange={(e) => setRoomNumber(e.target.value ? Number(e.target.value) : "")}
            style={{ background: "var(--card)", color: "var(--text)"}}>
            <option value="">— выберите —</option>
            {roomsLoading ? <option>Загрузка...</option> : null}
            {rooms.map((r) => (
              <option key={r.room_number} value={r.room_number}>
                #{r.room_number} • {r.room_type_name} • {r.capacity} мест
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="label">Срок предоплаты (до даты)</div>
          <input className="input" type="date" value={prepaymentDeadline} onChange={(e) => setPrepaymentDeadline(e.target.value)} min={todayStr()} />
        </div>

        <div className="field">
          <div className="label">Заезд</div>
          <input className="input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        </div>
        <div className="field">
          <div className="label">Выезд</div>
          <input className="input" type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
            <div className="label" style={{ marginBottom: -4 }}>
              Данные гостя
            </div>
            {clientLookup ? (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Подставлено из базы (read-only)</div>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 12 }}>Заполните вручную</div>
            )}
          </div>
        </div>

        <div className="field">
          <div className="label">Фамилия</div>
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={Boolean(clientLookup)} />
        </div>
        <div className="field">
          <div className="label">Имя</div>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={Boolean(clientLookup)} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Отчество</div>
          <input className="input" value={middleName} onChange={(e) => setMiddleName(e.target.value)} disabled={Boolean(clientLookup)} />
        </div>
        <div className="field">
          <div className="label">Телефон (+...)</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={Boolean(clientLookup)} />
        </div>
        <div className="field">
          <div className="label">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} disabled={Boolean(clientLookup)} />
        </div>

        <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, marginTop: 6 }}>
          <button className="btn btnPrimary" type="submit" disabled={submitting}>
            {submitting ? "Создание..." : "Создать бронь"}
          </button>

          <div style={{ textAlign: "right" }}>
            {createdBookingId ? (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Успешно создана бронь: <b>#{createdBookingId}</b>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                Бронь будет доступна для просмотра по ID.
              </div>
            )}
          </div>
        </div>

        {submitError && (
          <div className="errorText" style={{ gridColumn: "1 / -1" }}>
            {submitError}
          </div>
        )}
      </form>
    </div>
  );
}

