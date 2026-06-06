import React, { useMemo, useState } from "react";
import { useTheme } from "../components/ThemeProvider";

export function DesignPage() {
  const { mode, accent, fontSize, setMode, setAccent, setFontSize } = useTheme();

  const accentOptions = useMemo(
    () => [
      { value: "#2a7fff", label: "Синий" },
      { value: "#00c2ff", label: "Голубой" },
      { value: "#20c997", label: "Зелёный" },
      { value: "#ff6b6b", label: "Красный" },
      { value: "#a78bfa", label: "Фиолетовый" },
      { value: "#f59e0b", label: "Оранжевый" },
    ],
    [],
  );

  const [showThemeControls, setShowThemeControls] = useState(true);
  const [showAccentControls, setShowAccentControls] = useState(true);

  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 900, fontSize: 18 }}>Дизайн</div>
      <div style={{ color: "var(--muted)", fontSize: 13, marginTop: 6 }}>
        Настройки темы и интерфейса. Изменения применяются сразу и сохраняются локально.
      </div>

      <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={showThemeControls} onChange={(e) => setShowThemeControls(e.target.checked)} />
            <span style={{ fontWeight: 700 }}>Тема</span>
          </label>
        </div>

        {showThemeControls ? (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="label">Режим</div>
            <select className="input" value={mode} onChange={(e) => setMode(e.target.value as any)}>
              <option value="light">Светлая</option>
              <option value="dark">Тёмная</option>
            </select>
          </div>
        ) : null}

        <div style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={showAccentControls} onChange={(e) => setShowAccentControls(e.target.checked)} />
            <span style={{ fontWeight: 700 }}>Цвет меню</span>
          </label>
        </div>

        {showAccentControls ? (
          <div className="field" style={{ gridColumn: "1 / -1" }}>
            <div className="label">Акцент</div>
            <select className="input" value={accent} onChange={(e) => setAccent(e.target.value)}>
              {accentOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <div className="label">Размер шрифта</div>
          <select className="input" value={fontSize} onChange={(e) => setFontSize(e.target.value as any)}>
            <option value="small">Мелкий</option>
            <option value="medium">Средний</option>
            <option value="large">Крупный</option>
            <option value="auto">Авто</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
        “Средний” соответствует текущему дефолтному размеру интерфейса. “Авто” возвращает управление браузеру.
      </div>
    </div>
  );
}

