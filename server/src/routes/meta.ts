import { Router } from "express";
import { requireAuth, requirePermission } from "../lib/auth";
import { withClient } from "../lib/db";

export const metaRouter = Router();

function getBuildingIdFromAuth(req: any): number {
  if (req.auth?.accountType === "hotel_staff") return req.auth.staff.buildingId;
  return undefined as any;
}

metaRouter.get("/me/building", requireAuth, requirePermission("booking:view"), async (req, res) => {
  try {
    let buildingId: number | undefined;
    if (req.auth!.accountType === "hotel_staff") {
      buildingId = req.auth!.staff!.buildingId;
    } else {
      buildingId = req.query.buildingId ? Number(req.query.buildingId) : undefined;
    }

    if (!buildingId || Number.isNaN(buildingId)) return res.status(400).json({ message: "buildingId required" });

    const result = await withClient(async (client) => {
      return client.query<{
        building_id: number;
        floors: number;
        hotel_class_stars: number;
        hotel_class_name: string;
        city_name: string;
        street_name: string;
        house_name: string;
      }>(
        `
          select b.building_id, b.floors,
                 hc.stars as hotel_class_stars, hc.name as hotel_class_name,
                 c.name as city_name, s.name as street_name, h.name as house_name
          from buildings b
          join hotel_classes hc on hc.stars = b.hotel_class_stars
          join cities c on c.city_id = b.city_id
          join streets s on s.street_id = b.street_id
          join houses h on h.house_id = b.house_id
          where b.building_id = $1
        `,
        [buildingId],
      );
    });

    if (result.rowCount !== 1) return res.status(404).json({ message: "Not found" });
    return res.json({ building: result.rows[0] });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/me/rooms", requireAuth, requirePermission("booking:view"), async (req, res) => {
  try {
    let buildingId: number | undefined;
    if (req.auth!.accountType === "hotel_staff") {
      buildingId = req.auth!.staff!.buildingId;
    } else {
      buildingId = req.query.buildingId ? Number(req.query.buildingId) : undefined;
    }
    if (!buildingId || Number.isNaN(buildingId)) return res.status(400).json({ message: "buildingId required" });

    const result = await withClient(async (client) => {
      return client.query<{
        room_number: number;
        floor: number;
        cost: string;
        room_type_id: number;
        room_type_name: string;
        capacity: number;
      }>(
        `
          select r.room_number, r.floor,
                 r.cost::text as cost,
                 rt.room_type_id,
                 rt.name as room_type_name,
                 rt.capacity
          from rooms_in_building r
          join room_types rt on rt.room_type_id = r.room_type_id
          where r.building_id = $1
          order by r.floor, r.room_number
        `,
        [buildingId],
      );
    });

    return res.json({ rooms: result.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/me/services", requireAuth, requirePermission("booking:view"), async (req, res) => {
  try {
    let buildingId: number | undefined;
    if (req.auth!.accountType === "hotel_staff") {
      buildingId = req.auth!.staff!.buildingId;
    } else {
      buildingId = req.query.buildingId ? Number(req.query.buildingId) : undefined;
    }
    if (!buildingId || Number.isNaN(buildingId)) return res.status(400).json({ message: "buildingId required" });

    const result = await withClient(async (client) => {
      return client.query<{
        service_id: number;
        name: string;
        cost: string;
      }>(
        `
          select s.service_id,
                 s.name,
                 os.cost::text as cost
          from offered_services os
          join services s on s.service_id = os.service_id
          where os.building_id = $1
          order by s.name
        `,
        [buildingId],
      );
    });

    return res.json({ services: result.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/lookups/positions", requireAuth, requirePermission("admin:register_staff"), async (req, res) => {
  try {
    const r = await withClient(async (client) => {
      return client.query<{ position_id: number; name: string }>(
        `select position_id, name from positions order by name`,
      );
    });
    return res.json({ positions: r.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/lookups/buildings", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  try {
    const staffBuildingId = req.auth?.accountType === "hotel_staff" ? req.auth.staff!.buildingId : null;
    const r = await withClient(async (client) => {
      return client.query<{
        building_id: number;
        floors: number;
        hotel_class_stars: number;
        hotel_class_name: string;
        city_name: string;
        street_name: string;
        house_name: string;
      }>(
        `
          select b.building_id, b.floors,
                 hc.stars as hotel_class_stars, hc.name as hotel_class_name,
                 c.name as city_name, s.name as street_name, h.name as house_name
          from buildings b
          join hotel_classes hc on hc.stars = b.hotel_class_stars
          join cities c on c.city_id = b.city_id
          join streets s on s.street_id = b.street_id
          join houses h on h.house_id = b.house_id
          where ($1::int is null or b.building_id = $1)
          order by hc.stars desc, c.name, s.name, h.name
        `,
        [staffBuildingId],
      );
    });

    return res.json({ buildings: r.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/lookups/room-types", requireAuth, requirePermission("hotel:manage"), async (_req, res) => {
  try {
    const r = await withClient(async (client) => {
      return client.query<{ room_type_id: number; name: string; capacity: number }>(
        `select room_type_id, name, capacity from room_types order by name`,
      );
    });
    return res.json({ roomTypes: r.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/lookups/rooms", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  try {
    const staffBuildingId = req.auth?.accountType === "hotel_staff" ? req.auth.staff!.buildingId : null;

    const r = await withClient(async (client) => {
      return client.query<{
        building_id: number;
        room_number: number;
        floor: number;
        room_type_id: number;
        room_type_name: string;
        capacity: number;
        cost: string;
      }>(
        `
          select r.building_id,
                 r.room_number,
                 r.floor,
                 r.room_type_id,
                 rt.name as room_type_name,
                 rt.capacity,
                 r.cost::text as cost
          from rooms_in_building r
          join room_types rt on rt.room_type_id = r.room_type_id
          where ($1::int is null or r.building_id = $1)
          order by r.building_id, r.floor, r.room_number
        `,
        [staffBuildingId],
      );
    });
    return res.json({ rooms: r.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

metaRouter.get("/lookups/offered-services", requireAuth, requirePermission("hotel:manage"), async (req, res) => {
  try {
    let buildingId: number | undefined;
    if (req.auth!.accountType === "hotel_staff") {
      buildingId = req.auth!.staff!.buildingId;
    } else {
      buildingId = req.query.buildingId ? Number(req.query.buildingId) : undefined;
    }
    if (!buildingId || Number.isNaN(buildingId)) return res.status(400).json({ message: "buildingId required" });

    const r = await withClient(async (client) => {
      return client.query<{ service_id: number; name: string; cost: string }>(
        `
          select s.service_id, s.name, os.cost::text as cost
          from offered_services os
          join services s on s.service_id = os.service_id
          where os.building_id = $1
          order by s.name
        `,
        [buildingId],
      );
    });
    return res.json({ services: r.rows });
  } catch {
    return res.status(500).json({ message: "Internal server error" });
  }
});

