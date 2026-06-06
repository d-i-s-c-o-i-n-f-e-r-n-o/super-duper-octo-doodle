import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "../components/AuthProvider";

type BuildingOption = {
  building_id: number;
  city_name: string;
  street_name: string;
  house_name: string;
};

type OfferedServiceRow = {
  service_id: number;
  name: string;
  cost: string;
};

export function HotelServicePricePage() {
  const { me, hasPermission } = useAuth();
  const can = hasPermission("hotel:manage");
  const isNetworkAdmin = me?.accountType === "network_admin";

  const [buildings, setBuildings] = useState<BuildingOption[]>([]);
  const [buildingId, setBuildingId] = useState<number | "">("");
  const [services, setServices] = useState<OfferedServiceRow[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number | "">("");
  const [cost, setCost] = useState("");
  const [snapshotCost, setSnapshotCost] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => {
    if (!can) return;
    apiFetch<{ buildings: BuildingOption[] }>("/api/meta/lookups/buildings", { method: "GET" })
      .then((r) => {
        const list = r.buildings ?? [];
        setBuildings(list);
        if (list.length === 1) setBuildingId(list[0].building_id);
      })
      .catch(() => setBuildings([]));
  }, [can]);

  async function loadServices(bid: number) {
    const data = await apiFetch<{ services: OfferedServiceRow[] }>(
      `/api/meta/lookups/offered-services?buildingId=${bid}`,
      { method: "GET" },
    );
    setServices(data.services ?? []);
  }

  useEffect(() => {
    if (!can || !buildingId) return;
    setErr(null);
    loadServices(buildingId as number).catch((e: any) => {
      setErr(e?.message ?? "Не удалось загрузить услуги");
      setServices([]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [can, buildingId]);

  const selectedService = useMemo(
    () => services.find((s) => s.service_id === selectedServiceId),
    [services, selectedServiceId],
  );

  useEffect(() => {
    if (!selectedService) {
      setCost("");
      setSnapshotCost(null);
      return;
    }
    const n = Number(selectedService.cost);
    setCost(String(selectedService.cost));
    setSnapshotCost(Number.isFinite(n) ? n : 0);
  }, [selectedService]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(null);

    if (!can) {
      setErr("Недостаточно прав.");
      return;
    }
    if (!buildingId || selectedServiceId === "") {
      setErr("Выберите корпус и услугу.");
      return;
    }

    const costNum = Number(String(cost).replace(",", "."));
    if (!Number.isFinite(costNum) || costNum < 0) {
      setErr("Некорректная цена.");
      return;
    }

    setLoading(true);
    try {
      const body: { serviceId: number; cost: number; buildingId?: number } = {
        serviceId: selectedServiceId as number,
        cost: costNum,
      };
      if (isNetworkAdmin) body.buildingId = buildingId as number;

      await apiFetch("/api/admin/offered-services/cost", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setOk("Цена сохранена.");
      setSnapshotCost(costNum);
      await loadServices(buildingId as number);
    } catch (e: any) {
      setErr(e?.message ?? "Не удалось сохранить цену");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Услуга</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
        Изменение цены предлагаемой услуги для выбранного корпуса.
      </div>

      {!can ? (
        <div style={{ marginTop: 14, color: "#ff5b7b", fontWeight: 800 }}>Недостаточно прав.</div>
      ) : null}

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {isNetworkAdmin ? (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="label">Корпус</div>
            <select
              className="input"
              value={buildingId}
              onChange={(e) => {
                setSelectedServiceId("");
                setBuildingId(e.target.value ? Number(e.target.value) : "");
              }}
              style={{ background: "var(--card)", color: "var(--text)"}}
            >
              <option value="">— выберите —</option>
              {buildings.map((b) => (
                <option key={b.building_id} value={b.building_id}>
                  #{b.building_id} • {b.city_name}, {b.street_name} {b.house_name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="label">Корпус</div>
            <div className="input" style={{ opacity: 0.85 }}>
              {buildings[0]
                ? `#${buildings[0].building_id} • ${buildings[0].city_name}, ${buildings[0].street_name} ${buildings[0].house_name}`
                : "—"}
            </div>
          </div>
        )}

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Услуга</div>
          <select
            className="input"
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : "")}
            disabled={!buildingId || services.length === 0}
            style={{ background: "var(--card)", color: "var(--text)"}}
          >
            <option value="">— выберите услугу —</option>
            {services.map((s) => (
              <option key={s.service_id} value={s.service_id}>
                {s.name} (текущая цена: {Number(s.cost).toFixed(2)} ₽)
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <div className="label">Новая цена (₽)</div>
          <input className="input" value={cost} onChange={(e) => setCost(e.target.value)} disabled={!selectedServiceId} />
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

        <div style={{ gridColumn: "1 / -1" }}>
          <button
            className="btn btnPrimary"
            type="submit"
            disabled={
              loading ||
              !can ||
              !selectedServiceId ||
              (snapshotCost !== null && Number(String(cost).replace(",", ".")) === snapshotCost)
            }
          >
            {loading ? "Сохранение..." : "Сохранить цену"}
          </button>
        </div>
      </form>
    </div>
  );
}
