import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./components/AuthProvider";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomePage } from "./pages/HomePage";
import { RoleHomeRedirect } from "./pages/RoleHomeRedirect";
import { HotelServicePricePage } from "./pages/HotelServicePricePage";
import { BookingCreatePage } from "./pages/BookingCreatePage";
import { BookingViewPage } from "./pages/BookingViewPage";
import { GuestCreatePage } from "./pages/GuestCreatePage";
import { AdminStaffRegisterPage } from "./pages/AdminStaffRegisterPage";
import { AdminBuildingUpsertPage } from "./pages/AdminBuildingUpsertPage";
import { AdminRoomUpsertPage } from "./pages/AdminRoomUpsertPage";
import { DesignPage } from "./pages/DesignPage";

import { BookingCancelPage } from "./pages/BookingCancelPage";
import { GuestOccupancyPage } from "./pages/GuestOccupancyPage";
import { GuestCheckoutPage } from "./pages/GuestCheckoutPage";

function HomeRedirect() {
  const { me, loading } = useAuth();
  if (loading) return <div className="container" style={{ padding: 24 }}>Загрузка...</div>;
  return <Navigate to={me ? "/app" : "/login"} replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<DashboardPage />}>
        <Route index element={<RoleHomeRedirect />} />
        <Route path="gantt" element={<HomePage />} />
        <Route path="booking/create" element={<BookingCreatePage />} />
        <Route path="booking/view" element={<BookingViewPage />} />
        <Route path="booking/cancel" element={<BookingCancelPage />} />
        <Route path="guests/create" element={<GuestCreatePage />} />
        <Route path="guests/occupancy" element={<GuestOccupancyPage />} />
        <Route path="guests/checkout" element={<GuestCheckoutPage />} />
        <Route path="hotel/building" element={<AdminBuildingUpsertPage />} />
        <Route path="hotel/room" element={<AdminRoomUpsertPage />} />
        <Route path="hotel/service" element={<HotelServicePricePage />} />
        <Route path="admin/staff" element={<AdminStaffRegisterPage />} />
        <Route path="admin/building" element={<Navigate to="/app/hotel/building" replace />} />
        <Route path="admin/room" element={<Navigate to="/app/hotel/room" replace />} />
        <Route path="design" element={<DesignPage />} />
        <Route path="*" element={<div className="card" style={{ padding: 18 }}>Страница не найдена</div>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

