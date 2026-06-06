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

type RoomLookupRow = {
  building_id: number;
  room_number: number;
  floor: number;
  room_type_id: number;
  room_type_name: string;
  capacity: number;
  cost: string;
};

type RoomTypeOption = { room_type_id: number; name: string; capacity: number };

const NEW_ROOM = "__new__";

export function AdminRoomUpsertPage() {
  const { me, hasPermission } = useAuth();
  const can = hasPermission("hotel:manage");
  const isNetworkAdmin = me?.accountType === "network_admin";

  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomTypeOption[]>([]);
  const [rooms, setRooms] = useState<RoomLookupRow[]>([]);

  const [selectedRoomKey, setSelectedRoomKey] = useState<string>(NEW_ROOM); // "__new__" | "bid:rn"

  const [buildingId, setBuildingId] = useState<number | "">("");
  const [roomNumber, setRoomNumber] = useState<number | "">("");
  const [floor, setFloor] = useState<number | "">(1);
  const [cost, setCost] = useState<string>("5000");
  const [roomTypeId, setRoomTypeId] = useState<number | "">("");

  const [snap, setSnap] = useState<{ floor: number; cost: number; roomTypeId: number } | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!can) return;
    apiFetch<{ buildings: BuildingOption[] }>("/api/meta/lookups/buildings", { method: "GET" })
      .then((r) => setBuildings(r.buildings ?? []))
      .catch(() => setBuildings([]));
    apiFetch<{ roomTypes: RoomTypeOption[] }>("/api/meta/lookups/room-types", { method: "GET" })
      .then((r) => setRoomTypes(r.roomTypes ?? []))
      .catch(() => setRoomTypes([]));
    apiFetch<{ rooms: RoomLookupRow[] }>("/api/meta/lookups/rooms", { method: "GET" })
      .then((r) => setRooms(r.rooms ?? []))
      .catch(() => setRooms([]));
  }, [can]);

  const roomRows = useMemo(() => rooms, [rooms]);

  function roomLabel(r: RoomLookupRow) {
    return `#${r.room_number} • этаж ${r.floor} • ${r.room_type_name} (${r.capacity}) • ${Number(r.cost).toFixed(2)} ₽/сут`;
  }

  function applyExisting(rr: RoomLookupRow) {
    setBuildingId(rr.building_id);
    setRoomNumber(rr.room_number);
    setFloor(rr.floor);
    setCost(String(rr.cost));
    setRoomTypeId(rr.room_type_id);
    const c = Number(rr.cost);
    setSnap({
      floor: rr.floor,
      roomTypeId: rr.room_type_id,
      cost: Number.isFinite(c) ? c : 0,
    });
  }

  function resetNew() {
    const firstBid = buildings[0]?.building_id;
    const firstRt = roomTypes[0]?.room_type_id;
    setSelectedRoomKey(NEW_ROOM);
    setBuildingId(firstBid ?? "");
    setRoomNumber("");
    setFloor(1);
    setCost("5000");
    setRoomTypeId(firstRt ?? "");
    setSnap(null);
  }

  // When combos load, stabilize defaults once.
  useEffect(() => {
    if (!can) return;
    if (selectedRoomKey !== NEW_ROOM) return;
    if (buildingId === "" && buildings[0]?.building_id) setBuildingId(buildings[0].building_id);
    if (roomTypeId === "" && roomTypes[0]?.room_type_id) setRoomTypeId(roomTypes[0].room_type_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, buildings, roomTypes]);

  function onPickRoom(next: string) {
    setOk(null);
    setErr(null);
    setSelectedRoomKey(next);

    if (next === NEW_ROOM) {
      resetNew();
      return;
    }
    const parts = next.split(":");
    const bid = Number(parts[0]);
    const rn = Number(parts[1]);
    const rr = rooms.find((x) => x.building_id === bid && x.room_number === rn);
    if (!rr) {
      setErr("Комната не найдена в списке. Обновите страницу.");
      return;
    }
    applyExisting(rr);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!can) {
      setErr("Недостаточно прав для управления номерами.");
      return;
    }
    if (!buildingId || !roomNumber || !floor || roomTypeId === "") {
      setErr("Заполните корпус, номер комнаты, этаж и тип.");
      return;
    }

    const costNum = Number(String(cost).replace(",", "."));
    if (!Number.isFinite(costNum) || costNum < 0) {
      setErr("Некорректная цена.");
      return;
    }

    if (selectedRoomKey === NEW_ROOM) {
      setLoading(true);
      try {
        await apiFetch("/api/admin/rooms/create", {
          method: "POST",
          body: JSON.stringify({
            buildingId,
            roomNumber,
            roomTypeId,
            cost: costNum,
            floor,
          }),
        });
        setOk("Номер создан.");
        const list = await apiFetch<{ rooms: RoomLookupRow[] }>("/api/meta/lookups/rooms", { method: "GET" });
        setRooms(list.rooms ?? []);
        onPickRoom(`${buildingId}:${roomNumber}`);
      } catch (e: any) {
        setErr(e?.message ?? "Не удалось создать номер");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!snap) {
      setErr("Нет состояния для сохранения.");
      return;
    }

    const patch: { floor?: number; cost?: number; roomTypeId?: number } = {};
    if (Number(floor) !== snap.floor) patch.floor = Number(floor);
    if (Number(roomTypeId) !== snap.roomTypeId) patch.roomTypeId = Number(roomTypeId);
    if (Math.abs(costNum - snap.cost) > 1e-6) patch.cost = costNum;

    if (Object.keys(patch).length === 0) {
      setOk("Изменений нет.");
      return;
    }

    setLoading(true);
    try {
      await apiFetch(`/api/admin/rooms`, {
        method: "PATCH",
        body: JSON.stringify({
          buildingId,
          roomNumber,
          patch,
        }),
      });
      setOk("Сохранено.");
      const list = await apiFetch<{ rooms: RoomLookupRow[] }>("/api/meta/lookups/rooms", { method: "GET" });
      setRooms(list.rooms ?? []);
      const rr = list.rooms?.find((x) => x.building_id === Number(buildingId) && x.room_number === Number(roomNumber));
      if (rr) applyExisting(rr);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось сохранить изменения");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Номер</div>

      {!can ? <div style={{ marginTop: 14, color: "#ff5b7b", fontWeight: 800 }}>Недостаточно прав.</div> : null}

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Номер (выбор из базы)</div>
          <select className="input" value={selectedRoomKey} onChange={(e) => onPickRoom(e.target.value)} disabled={!can} style={{ background: "var(--card)", color: "var(--text)"}}>
            <option value={NEW_ROOM}>Добавить новый номер</option>
            {roomRows.map((r) => {
              const key = `${r.building_id}:${r.room_number}`;
              const b = buildings.find((x) => x.building_id === r.building_id);
              const addr = b ? `${b.city_name}, ${b.street_name} ${b.house_name}` : `Корпус #${r.building_id}`;
              return (
                <option key={key} value={key}>
                  К{r.building_id} • {addr} • {roomLabel(r)}
                </option>
              );
            })}
          </select>
        </div>

        <div className="field">
          <div className="label">Корпус</div>
          <select
            className="input"
            value={buildingId}
            onChange={(e) => setBuildingId(e.target.value ? Number(e.target.value) : "")}
            disabled={!can || selectedRoomKey !== NEW_ROOM || !isNetworkAdmin}
            style={{background: "var(--card)", color: "var(--text)"}}
          >
            <option value="">— выберите —</option>
            {buildings.map((b) => (
              <option key={b.building_id} value={b.building_id}>
                #{b.building_id} • {b.hotel_class_stars}★ • {b.city_name}, {b.street_name} {b.house_name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="label">Номер комнаты (целое)</div>
          <input
            className="input"
            type="number"
            min={1}
            value={roomNumber === "" ? "" : roomNumber}
            onChange={(e) => setRoomNumber(e.target.value ? Number(e.target.value) : "")}
            disabled={!can || selectedRoomKey !== NEW_ROOM}
          />
        </div>

        <div className="field">
          <div className="label">Этаж</div>
          <input className="input" type="number" min={0} value={floor === "" ? "" : floor} onChange={(e) => setFloor(e.target.value ? Number(e.target.value) : "")} disabled={!can} />
        </div>

        <div className="field">
          <div className="label">Тип номера</div>
          <select className="input" value={roomTypeId} onChange={(e) => setRoomTypeId(e.target.value ? Number(e.target.value) : "")} disabled={!can} style={{ background: "var(--card)", color: "var(--text)"}}>
            <option value="">— выберите —</option>
            {roomTypes.map((t) => (
              <option key={t.room_type_id} value={t.room_type_id}>
                {t.name} (вместимость {t.capacity})
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="label">Цена (₽ за сутки)</div>
          <input className="input" value={cost} onChange={(e) => setCost(e.target.value)} disabled={!can} />
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

        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center" }}>
          <button className="btn btnPrimary" type="submit" disabled={loading || !can}>
            {loading ? "Отправка..." : selectedRoomKey === NEW_ROOM ? "Создать" : "Сохранить"}
          </button>
          <button
            type="button"
            className="btn"
            disabled={loading || !can}
            onClick={async () => {
              try {
                setErr(null);
                setOk(null);
                const list = await apiFetch<{ rooms: RoomLookupRow[] }>("/api/meta/lookups/rooms", { method: "GET" });
                setRooms(list.rooms ?? []);
              } catch (e: any) {
                setErr(e?.message ?? "Не удалось обновить список");
              }
            }}
          >
            Обновить список номеров
          </button>
        </div>
      </form>
    </div>
  );
}
