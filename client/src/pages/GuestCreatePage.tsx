import React, { useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

export function GuestCreatePage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("clients:create");

  const [passport, setPassport] = useState("");
  const passportOk = useMemo(() => /^[0-9]{10}$/.test(passport.trim()), [passport]);

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okId, setOkId] = useState<number | null>(null);

  async function lookup() {
    setErr(null);
    const p = passport.trim();
    if (!passportOk) return;
    setLookupLoading(true);
    try {
      const data = await apiFetch<{ client: any | null }>(`/api/clients/lookup?passport=${encodeURIComponent(p)}`, { method: "GET" });
      if (data.client) {
        setLastName(data.client.last_name);
        setFirstName(data.client.first_name);
        setMiddleName(data.client.middle_name);
        setPhone(data.client.phone);
        setEmail(data.client.email);
      }
    } catch (e: any) {
      setErr(e?.message ?? "Ошибка поиска");
    } finally {
      setLookupLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkId(null);

    if (!canCreate) {
      setErr("У вас нет прав для создания гостя.");
      return;
    }
    if (!passportOk) {
      setErr("Паспорт должен содержать 10 цифр.");
      return;
    }
    if (!lastName.trim() || !firstName.trim() || !phone.trim() || !email.trim()) {
      setErr("Заполните обязательные поля.");
      return;
    }
    if (!/^\+[0-9]{11,12}$/.test(phone.trim())) {
      setErr("Телефон должен быть в формате +XXXXXXXXXXXX.");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ client: { client_id: number } }>(`/api/clients/`, {
        method: "POST",
        body: JSON.stringify({
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          passport: passport.trim(),
          phone: phone.trim(),
          email: email.trim(),
        }),
      });
      setOkId(data.client.client_id);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось сохранить гостя");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Добавление гостя</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
        Запись гостя в базе выполняется вручную. При совпадении паспорта данные обновятся.
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Паспорт (10 цифр, без пробелов)</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input className="input" value={passport} onChange={(e) => setPassport(e.target.value)} onBlur={() => lookup()} placeholder="1234567890" />
            <button type="button" className="btn" onClick={() => lookup()} disabled={!passportOk || lookupLoading}>
              {lookupLoading ? "Поиск..." : "Проверить"}
            </button>
          </div>
          {passport && !passportOk && <div className="errorText">Неверный формат паспорта.</div>}
        </div>

        <div className="field">
          <div className="label">Фамилия</div>
          <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="field">
          <div className="label">Имя</div>
          <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Отчество</div>
          <input className="input" value={middleName} onChange={(e) => setMiddleName(e.target.value)} />
        </div>
        <div className="field">
          <div className="label">Телефон (+...)</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <div className="label">Email</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {err && (
          <div className="errorText" style={{ gridColumn: "1 / -1" }}>
            {err}
          </div>
        )}

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
          <button className="btn btnPrimary" type="submit" disabled={loading || !canCreate}>
            {loading ? "Сохранение..." : "Сохранить гостя"}
          </button>
          {okId ? <div style={{ color: "var(--muted)", fontSize: 12 }}>Готово. ID клиента: <b>#{okId}</b></div> : <div />}
        </div>
      </form>
    </div>
  );
}

