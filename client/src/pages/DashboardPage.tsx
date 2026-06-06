import React from "react";
import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider";
import { useTheme } from "../components/ThemeProvider";

function NavSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: "8px 10px 4px", color: "var(--muted)", fontSize: 12, fontWeight: 800, letterSpacing: 0.04 }}>
      {children}
    </div>
  );
}

function NavSubItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? "navItem navItemActive" : "navItem")}>
      <span style={{ opacity: 0.85, marginRight: 8 }}>-</span>
      {children}
    </NavLink>
  );
}

export function DashboardPage() {
  const { me, logout, loading, hasPermission } = useAuth();
  useTheme();
  const navigate = useNavigate();

  if (loading) return <div className="container" style={{ padding: 24 }}>Загрузка...</div>;
  if (!me) return <Navigate to="/login" replace />;

  const isNetworkAdmin = me.accountType === "network_admin";
  const positionName = me.staff?.positionName ?? "";
  const isManager = me.accountType === "hotel_staff" && positionName === "Менеджер";
  const isReceptionist = me.accountType === "hotel_staff" && positionName === "Ресепшионист";

  const showBookingsGuests = isReceptionist || isManager;
  const showHotel = isNetworkAdmin || isManager;
  const showAdmin = isNetworkAdmin;

  const doLogout = async () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="dashboardOuter">
      <div className="mainLayout">
      <aside
        className="sidebar"
        style={{
        display: "flex",
        flexDirection: "column",
        position: "sticky",
        top: 0,
        height: "100vh",
        flex: "0 0 260px", /* Ширина сайдбара*/
        overflow: "hidden",
        }}
      >

          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 8px 18px" }}>
            <div className="accentDot" />
            <div style={{ fontWeight: 800, letterSpacing: 0.2, fontSize: 16 }}>Ваш отель</div>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1, marginTop: 6 }}>
            <NavSubItem to="/app/design">Дизайн приложения</NavSubItem>

            {showBookingsGuests && (
              <>
                <NavSectionTitle>Брони</NavSectionTitle>
                {hasPermission("booking:upcoming") && <NavSubItem to="/app/gantt">Диаграмма</NavSubItem>}
                {hasPermission("booking:create") && <NavSubItem to="/app/booking/create">Оформить</NavSubItem>}
                {hasPermission("booking:view") && <NavSubItem to="/app/booking/view">Просмотр</NavSubItem>}
                {hasPermission("booking:cancel") && <NavSubItem to="/app/booking/cancel">Отменить</NavSubItem>}

                <div style={{ height: 6 }} />
                <NavSectionTitle>Гости</NavSectionTitle>
                {hasPermission("clients:create") && <NavSubItem to="/app/guests/create">Добавить</NavSubItem>}
                {hasPermission("booking:occupancy") && <NavSubItem to="/app/guests/occupancy">Проживают</NavSubItem>}
                {hasPermission("booking:checkout") && <NavSubItem to="/app/guests/checkout">Выселить</NavSubItem>}
              </>
            )}

            {showHotel && (
              <>
                <div style={{ height: 6 }} />
                <NavSectionTitle>Отель</NavSectionTitle>
                {hasPermission("hotel:manage") && <NavSubItem to="/app/hotel/building">Корпус</NavSubItem>}
                {hasPermission("hotel:manage") && <NavSubItem to="/app/hotel/room">Номер</NavSubItem>}
                {hasPermission("hotel:manage") && <NavSubItem to="/app/hotel/service">Услуга</NavSubItem>}
              </>
            )}

            {showAdmin && (
              <>
                <div style={{ height: 6 }} />
                <NavSectionTitle>Админ</NavSectionTitle>
                {hasPermission("admin:register_staff") && <NavSubItem to="/app/admin/staff">Сотрудники</NavSubItem>}
              </>
            )}
          </nav>

          <div style={{ padding: "12px 8px 16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 10 }}>
              <div style={{ fontWeight: 800 }}>Здравствуйте</div>
              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                {me.accountType === "hotel_staff" && me.staff
                  ? `${positionName || "Сотрудник"} • корпус #${me.staff.buildingId}`
                  : "Сетевой администратор"}
              </div>
            </div>
            <button className="btn" style={{ width: "100%" }} onClick={doLogout}>
              Выйти
            </button>
          </div>
        </aside>

        <main
          className="contentWrap"
          style={{
            width: "100%",
            height: "100vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >

          <div style={{ paddingTop: 16 }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
