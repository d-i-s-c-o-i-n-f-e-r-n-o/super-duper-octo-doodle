import "express";

declare module "express-serve-static-core" {
  interface Request {
    auth?: {
      accountId: number;
      accountType: "network_admin" | "hotel_staff";
      staff?: {
        employeeId: number;
        buildingId: number;
        positionId: number;
        positionName: string;
      };
      permissions: Set<string>;
    };
  }
}

