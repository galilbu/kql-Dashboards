import { type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth";

/* ── SVG icons ─────────────────────────────────────────────── */
function UsersIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#13C636" : "#5c5c78"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

interface LayoutProps {
  children: ReactNode;
}

/* ── eToro logo (compact) ──────────────────────────────────── */
function EtoroMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="28"
      height="28"
      fill="none"
      viewBox="0 0 32 32"
    >
      <path
        fill="#13C636"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M21.766 18.022a.184.184 0 0 1-.183.185h-7.964V16.75c0-1.99 2.345-2.923 4.197-2.923 1.731 0 3.951.934 3.951 2.923zm-3.95-8.54c-4.107.042-8.626 2.436-8.626 7.267v7.347c0 4.911 4.52 7.226 8.626 7.266 2.942-.03 6.292-1.256 7.887-3.858.053-.086.006-.2-.075-.248-1.406-.812-2.222-1.262-3.615-2.053-.044-.025-.091-.025-.127.035-.761 1.278-2.704 1.984-4.07 1.984-1.852 0-4.197-1.137-4.197-3.126V21.9h11.384c.608 0 1.101-.497 1.101-1.11v-4.042c0-4.83-4.262-7.225-8.288-7.266"
      />
    </svg>
  );
}

/* ── SVG icons ─────────────────────────────────────────────── */
function DashboardIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? "#13C636" : "#5c5c78"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5c5c78" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ── Monogram avatar ───────────────────────────────────────── */
function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div
      style={{
        width: "36px",
        height: "36px",
        borderRadius: "50%",
        background: "linear-gradient(135deg, #0ea02b 0%, #13C636 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: "0.72rem",
        fontWeight: 700,
        letterSpacing: "0.04em",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

/* ── Sidebar nav item ──────────────────────────────────────── */
function NavItem({
  to,
  label,
  icon,
  active,
}: {
  to: string;
  label: string;
  icon: ReactNode;
  active: boolean;
}) {
  return (
    <Link
      to={to}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.7rem",
        padding: "0.55rem 0.85rem",
        borderRadius: "var(--radius-sm)",
        color: active ? "var(--green)" : "var(--text-tertiary)",
        backgroundColor: active ? "var(--green-bg)" : "transparent",
        textDecoration: "none",
        fontSize: "0.82rem",
        fontWeight: active ? 600 : 400,
        fontFamily: "var(--font-body)",
        transition: "all 0.12s ease",
        borderLeft: active
          ? "2px solid var(--green)"
          : "2px solid transparent",
      }}
    >
      {icon}
      {label}
    </Link>
  );
}

/* ── Layout with sidebar ───────────────────────────────────── */
export function Layout({ children }: LayoutProps) {
  const { user, logout, isSuperAdmin } = useAuth();
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* ── Sidebar ── */}
      <aside
        style={{
          width: "220px",
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          backgroundColor: "var(--surface-1)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "1.1rem 1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <EtoroMark />
          <span
            style={{
              color: "var(--text-secondary)",
              fontSize: "0.78rem",
              fontWeight: 600,
              letterSpacing: "0.03em",
            }}
          >
            KQL Dashboard
          </span>
        </div>

        {/* Navigation */}
        <nav
          style={{
            padding: "0.75rem 0.6rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.2rem",
            flex: 1,
          }}
        >
          <NavItem
            to="/dashboards"
            label="Dashboards"
            icon={<DashboardIcon active={isActive("/dashboards")} />}
            active={isActive("/dashboards")}
          />
          {isSuperAdmin && (
            <NavItem
              to="/admin"
              label="Users"
              icon={<UsersIcon active={isActive("/admin")} />}
              active={isActive("/admin")}
            />
          )}
        </nav>

        {/* ── Bottom: User profile ── */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "0.85rem 0.85rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.65rem",
          }}
        >
          {/* Avatar + name */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Avatar name={user?.name || "?"} />
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  color: "var(--text-primary)",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.name}
              </div>
              <div
                style={{
                  color: "var(--text-tertiary)",
                  fontSize: "0.68rem",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user?.username}
              </div>
            </div>
          </div>

          {/* Logout */}
          <button
            onClick={() => logout()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.4rem 0.5rem",
              fontSize: "0.75rem",
              cursor: "pointer",
              backgroundColor: "transparent",
              color: "var(--text-tertiary)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontFamily: "var(--font-body)",
              transition: "all 0.12s ease",
              width: "100%",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border-hover)";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
              e.currentTarget.style.color = "var(--text-tertiary)";
            }}
          >
            <LogoutIcon />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "var(--surface-0)",
        }}
      >
        {children}
      </main>
    </div>
  );
}
