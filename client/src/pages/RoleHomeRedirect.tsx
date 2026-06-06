import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";

export function RoleHomeRedirect() {
  const { me, loading, hasPermission } = useAuth();
  if (loading) return <div className="container" style={{ padding: 24 }}>Загрузка...</div>;
  if (!me) return <Navigate to="/login" replace />;

  if (me.accountType === "network_admin") {
    return <Navigate to="/app/hotel/building" replace />;
  }

  const positionName = me.staff?.positionName ?? "";
  if (positionName === "Менеджер") {
    if (hasPermission("booking:create")) return <Navigate to="/app/booking/create" replace />;
    if (hasPermission("hotel:manage")) return <Navigate to="/app/hotel/building" replace />;
  }

  if (hasPermission("booking:upcoming")) return <Navigate to="/app/gantt" replace />;
  if (hasPermission("booking:create")) return <Navigate to="/app/booking/create" replace />;
  return <Navigate to="/app/booking/view" replace />;
}
