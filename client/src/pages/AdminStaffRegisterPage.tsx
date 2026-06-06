import React, { useEffect, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

type PositionOption = { position_id: number; name: string };
type BuildingOption = {
  building_id: number;
  floors: number;
  hotel_class_stars: number;
  hotel_class_name: string;
  city_name: string;
  street_name: string;
  house_name: string;
};

export function AdminStaffRegisterPage() {
  const { me, hasPermission } = useAuth();

  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [buildings, setBuildings] = useState<BuildingOption[]>([]);

  const [buildingId, setBuildingId] = useState<number | "">("");
  const [positionId, setPositionId] = useState<number | "">("");

  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [passport, setPassport] = useState("");
  const [phone, setPhone] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [okEmployeeId, setOkEmployeeId] = useState<number | null>(null);

  const canRegister = hasPermission("admin:register_staff");

  useEffect(() => {
    if (!canRegister) return;
    apiFetch<{ positions: PositionOption[] }>("/api/meta/lookups/positions", { method: "GET" })
      .then((r) => setPositions(r.positions))
      .catch(() => setPositions([]));
    apiFetch<{ buildings: BuildingOption[] }>("/api/meta/lookups/buildings", { method: "GET" })
      .then((r) => setBuildings(r.buildings))
      .catch(() => setBuildings([]));
  }, [canRegister]);

  useEffect(() => {
    if (positions.length && positionId === "") setPositionId(positions[0].position_id);
  }, [positions]);

  useEffect(() => {
    if (buildings.length && buildingId === "") setBuildingId(buildings[0].building_id);
  }, [buildings]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOkEmployeeId(null);

    if (!me || me.accountType !== "network_admin") {
      setErr("Только сетевой администратор может регистрировать сотрудников.");
      return;
    }
    if (!canRegister) {
      setErr("Недостаточно прав.");
      return;
    }
    if (!buildingId || !positionId) {
      setErr("Выберите корпус и должность.");
      return;
    }
    if (!/^[0-9]{10}$/.test(passport.trim())) {
      setErr("Паспорт должен содержать 10 цифр без пробелов.");
      return;
    }
    if (!/^\+[0-9]{11,12}$/.test(phone.trim())) {
      setErr("Телефон должен быть в формате +XXXXXXXXXXXX.");
      return;
    }
    if (!email.trim() || !password.trim() || password.trim().length < 8) {
      setErr("Укажите email и пароль (минимум 8 символов).");
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ ok: boolean; employeeId: number }>("/api/admin/staff/register", {
        method: "POST",
        body: JSON.stringify({
          buildingId: buildingId as number,
          positionId: positionId as number,
          lastName: lastName.trim(),
          firstName: firstName.trim(),
          middleName: middleName.trim(),
          passport: passport.trim(),
          phone: phone.trim(),
          email: email.trim(),
          password: password.trim(),
        }),
      });
      setOkEmployeeId(data.employeeId);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось зарегистрировать сотрудника");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Регистрация сотрудника</div>
      
      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Корпус</div>
          <select className="input" value={buildingId} onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : "")} style={{ background: "var(--card)", color: "var(--text)"}}>
            <option value="">— выберите —</option>
            {buildings.map((b) => (
              <option key={b.building_id} value={b.building_id}>
                #{b.building_id} • {b.hotel_class_stars}* • {b.city_name}, {b.street_name} {b.house_name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Должность</div>
          <select className="input" value={positionId} onChange={(e) => setPositionId(e.target.value ? Number(e.target.value) : "")} style={{ background: "var(--card)", color: "var(--text)"}}>
            <option value="">— выберите —</option>
            {positions.map((p) => (
              <option key={p.position_id} value={p.position_id}>
                {p.name}
              </option>
            ))}
          </select>
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
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Паспорт сотрудника (10 цифр)</div>
          <input className="input" value={passport} onChange={(e) => setPassport(e.target.value)} placeholder="1234567890" />
        </div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Телефон сотрудника (+...)</div>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+79990001122" />
        </div>

        <div className="field">
          <div className="label">Email для входа</div>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <div className="label">Пароль</div>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {err && (
          <div className="errorText" style={{ gridColumn: "1 / -1" }}>
            {err}
          </div>
        )}

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <button className="btn btnPrimary" type="submit" disabled={loading || !canRegister}>
            {loading ? "Создание..." : "Создать сотрудника"}
          </button>
          {okEmployeeId ? (
            <div style={{ color: "var(--muted)", fontSize: 12 }}>
              Готово. employee_id: <b>#{okEmployeeId}</b>
            </div>
          ) : (
            <div />
          )}
        </div>
      </form>
    </div>
  );
}

