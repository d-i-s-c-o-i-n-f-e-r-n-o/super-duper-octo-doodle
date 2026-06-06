import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

type BuildingOption = {
  building_id: number;
  floors: number;
  hotel_class_stars: number;
  hotel_class_name: string;
  city_name: string;
  street_name: string;
  house_name: string;
};

const NEW = "__new__";

export function AdminBuildingUpsertPage() {
  const { me, hasPermission } = useAuth();
  const can = hasPermission("hotel:manage");
  const isNetworkAdmin = me?.accountType === "network_admin";

  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [selected, setSelected] = useState<string>(NEW);

  const [city, setCity] = useState("");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [floors, setFloors] = useState<number | "">(5);
  const [stars, setStars] = useState<number | "">(4);

  const [snapshot, setSnapshot] = useState<{
    city: string;
    street: string;
    house: string;
    floors: number;
    stars: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!can) return;
    apiFetch<{ buildings: BuildingOption[] }>("/api/meta/lookups/buildings", { method: "GET" })
      .then((r) => {
        const list = r.buildings ?? [];
        setBuildings(list);
        if (!isNetworkAdmin && list.length > 0) {
          setSelected(String(list[0].building_id));
        }
      })
      .catch(() => setBuildings([]));
  }, [can, isNetworkAdmin]);

  const starsOptions = useMemo(() => [3, 4, 5], []);

  function applyExisting(b: BuildingOption) {
    setCity(b.city_name);
    setStreet(b.street_name);
    setHouse(b.house_name);
    setFloors(b.floors);
    setStars(b.hotel_class_stars);
    setSnapshot({
      city: b.city_name,
      street: b.street_name,
      house: b.house_name,
      floors: b.floors,
      stars: b.hotel_class_stars,
    });
  }

  function resetNew() {
    setCity("");
    setStreet("");
    setHouse("");
    setFloors(5);
    setStars(4);
    setSnapshot(null);
  }

  useEffect(() => {
    if (selected === NEW) {
      resetNew();
      return;
    }
    const id = Number(selected);
    const b = buildings.find((x) => x.building_id === id);
    if (!b) return;
    applyExisting(b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, buildings]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!can) {
      setErr("Недостаточно прав для управления корпусом.");
      return;
    }
    if (selected === NEW) {
      if (!city.trim() || !street.trim() || !house.trim()) {
        setErr("Заполните город, улицу и дом.");
        return;
      }
      if (!stars || !floors) {
        setErr("Укажите класс и этажность.");
        return;
      }

      setLoading(true);
      try {
        const data = await apiFetch<{ ok: boolean; buildingId: number }>("/api/admin/buildings/create", {
          method: "POST",
          body: JSON.stringify({
            hotelClassStars: stars,
            floors,
            cityName: city.trim(),
            streetName: street.trim(),
            houseName: house.trim(),
          }),
        });
        setOk(`Корпус создан. buildingId: #${data.buildingId}`);
        const list = await apiFetch<{ buildings: BuildingOption[] }>("/api/meta/lookups/buildings", { method: "GET" });
        setBuildings(list.buildings ?? []);
        setSelected(String(data.buildingId));
      } catch (e: any) {
        setErr(e?.message ?? "Не удалось создать корпус");
      } finally {
        setLoading(false);
      }
      return;
    }

    const id = Number(selected);
    if (!snapshot) {
      setErr("Нет данных для сохранения.");
      return;
    }
    const patch: { hotelClassStars?: number; floors?: number } = {};
    const sStars = stars === "" ? snapshot.stars : stars;
    const sFloors = floors === "" ? snapshot.floors : floors;
    if (typeof sStars === "number" && sStars !== snapshot.stars) patch.hotelClassStars = sStars;
    if (typeof sFloors === "number" && sFloors !== snapshot.floors) patch.floors = sFloors;
    if (Object.keys(patch).length === 0) {
      setOk("Изменений нет.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch(`/api/admin/buildings/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setOk("Сохранено.");
      const list = await apiFetch<{ buildings: BuildingOption[] }>("/api/meta/lookups/buildings", { method: "GET" });
      setBuildings(list.buildings ?? []);
      const b = list.buildings?.find((x) => x.building_id === id);
      if (b) applyExisting(b);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось сохранить изменения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Корпус</div>

      {!can ? <div style={{ marginTop: 14, color: "#ff5b7b", fontWeight: 800 }}>Недостаточно прав.</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          
          <select className="input" value={selected} onChange={(e) => setSelected(e.target.value)} disabled={!can} style={{ background: "var(--card)", color: "var(--text)"}}>
            {isNetworkAdmin ? <option value={NEW}>Добавить новый корпус</option> : null}
            {buildings.map((b) => (
              <option key={b.building_id} value={String(b.building_id)}>
                #{b.building_id} • {b.hotel_class_stars}★ • {b.city_name}, {b.street_name} {b.house_name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="label">Город</div>
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} disabled={!can || selected !== NEW} />
        </div>
        <div className="field">
          <div className="label">Улица</div>
          <input className="input" value={street} onChange={(e) => setStreet(e.target.value)} disabled={!can || selected !== NEW} />
        </div>

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Дом / литер</div>
          <input className="input" value={house} onChange={(e) => setHouse(e.target.value)} disabled={!can || selected !== NEW} />
        </div>

        <div className="field">
          <div className="label">Класс (звёзды)</div>
          <select className="input" value={stars} onChange={(e) => setStars(e.target.value ? Number(e.target.value) : "")} disabled={!can} style={{ background: "var(--card)", color: "var(--text)"}}>
            <option value="">—</option>
            {starsOptions.map((s) => (
              <option key={s} value={s}>
                {s}★
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <div className="label">Этажность</div>
          <input
            className="input"
            type="number"
            min={1}
            value={floors === "" ? "" : floors}
            onChange={(e) => setFloors(e.target.value ? Number(e.target.value) : "")}
            disabled={!can}
          />
        </div>

        {err ? (
          <div className="errorText" style={{ gridColumn: "1 / -1" }}>
            {err}
          </div>
        ) : null}
        {ok ? (
          <div style={{ gridColumn: "1 / -1", color: "#20c997", fontWeight: 800, fontSize: 13 }}>
            {ok}
          </div>
        ) : null}

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
          <button className="btn btnPrimary" type="submit" disabled={loading || !can}>
            {loading ? "Отправка..." : selected === NEW ? "Создать" : "Сохранить"}
          </button>
        </div>
      </form>
    </div>
  );
}
