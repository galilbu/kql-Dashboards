import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth";
import type { Dashboard } from "../types";

interface MyPermission {
  dashboard_id: string;
  dashboard_title: string;
  role: string;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.8rem",
  backgroundColor: "var(--surface-1)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: "0.85rem",
  fontFamily: "var(--font-body)",
  boxSizing: "border-box",
  outline: "none",
  transition: "border-color 0.15s ease",
};

export function DashboardList() {
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [myPerms, setMyPerms] = useState<MyPermission[]>([]);
  const [tab, setTab] = useState<"dashboards" | "permissions">("dashboards");
  const { getAccessToken } = useAuth();
  const navigate = useNavigate();

  const fetchDashboards = useCallback(async () => {
    try {
      const token = await getAccessToken(["openid"]);
      const data = await api.get<{ dashboards: Dashboard[] }>(
        "/dashboards",
        token,
      );
      setDashboards(data.dashboards);
      const permsData = await api.get<{ permissions: MyPermission[] }>(
        "/users/me/permissions",
        token,
      );
      setMyPerms(permsData.permissions);
    } catch (err) {
      console.error("Failed to fetch dashboards:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      const token = await getAccessToken(["openid"]);
      const created = await api.post<Dashboard>(
        "/dashboards",
        { title: newTitle, description: newDesc },
        token,
      );
      setShowCreate(false);
      setNewTitle("");
      setNewDesc("");
      navigate(`/dashboards/${created.id}`);
    } catch (err) {
      console.error("Failed to create dashboard:", err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: "4rem 2rem", textAlign: "center" }}>
        <div
          style={{
            display: "inline-block",
            width: "6px",
            height: "6px",
            backgroundColor: "var(--green)",
            borderRadius: "50%",
            animation: "pulse 1.2s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: "0.5rem 1rem",
    fontSize: "0.82rem",
    fontFamily: "var(--font-body)",
    fontWeight: active ? 600 : 400,
    color: active ? "var(--green)" : "var(--text-tertiary)",
    backgroundColor: "transparent",
    border: "none",
    borderBottom: active ? "2px solid var(--green)" : "2px solid transparent",
    cursor: "pointer",
    transition: "all 0.15s ease",
  });

  return (
    <div
      style={{
        padding: "2.5rem 2rem",
        maxWidth: "960px",
        margin: "0 auto",
        animation: "fadeIn 0.35s ease both",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
        }}
      >
        <h1>Home</h1>
        {tab === "dashboards" && (
          <button
            onClick={() => setShowCreate(true)}
            style={{
              padding: "0.5rem 1.1rem",
              backgroundColor: "var(--green)",
              color: "var(--text-inverse)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: "pointer",
              fontSize: "0.82rem",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              transition: "background-color 0.15s ease",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--green-light)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--green)")
            }
          >
            + New Dashboard
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
        }}
      >
        <button
          style={tabStyle(tab === "dashboards")}
          onClick={() => setTab("dashboards")}
        >
          Dashboards ({dashboards.length})
        </button>
        <button
          style={tabStyle(tab === "permissions")}
          onClick={() => setTab("permissions")}
        >
          My Permissions ({myPerms.length})
        </button>
      </div>

      {/* ── Dashboards tab ── */}
      {tab === "dashboards" && (
        <>
          {showCreate && (
            <div
              style={{
                padding: "1.25rem",
                marginBottom: "1.5rem",
                backgroundColor: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border)",
                animation: "fadeIn 0.2s ease both",
              }}
            >
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Dashboard title"
                style={{ ...inputStyle, marginBottom: "0.6rem" }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--green-border)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Description (optional)"
                style={{ ...inputStyle, marginBottom: "0.85rem" }}
                onFocus={(e) =>
                  (e.currentTarget.style.borderColor = "var(--green-border)")
                }
                onBlur={(e) =>
                  (e.currentTarget.style.borderColor = "var(--border)")
                }
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={handleCreate}
                  style={{
                    padding: "0.45rem 1rem",
                    backgroundColor: "var(--green)",
                    color: "var(--text-inverse)",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                  }}
                >
                  Create
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{
                    padding: "0.45rem 1rem",
                    backgroundColor: "transparent",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.82rem",
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {dashboards.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "3rem 2rem",
                color: "var(--text-tertiary)",
              }}
            >
              <p style={{ fontSize: "0.9rem" }}>
                No dashboards yet. Create one to get started.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
                gap: "0.75rem",
              }}
            >
              {dashboards.map((d, i) => (
                <div
                  key={d.id}
                  onClick={() => navigate(`/dashboards/${d.id}`)}
                  style={{
                    padding: "1.15rem 1.25rem",
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    animation: `fadeIn 0.3s ease ${i * 0.04}s both`,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--green-border)";
                    e.currentTarget.style.backgroundColor = "var(--surface-3)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--border)";
                    e.currentTarget.style.backgroundColor = "var(--surface-2)";
                  }}
                >
                  <h3 style={{ marginBottom: d.description ? "0.3rem" : 0 }}>
                    {d.title}
                  </h3>
                  {d.description && (
                    <p
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.8rem",
                        lineHeight: 1.45,
                      }}
                    >
                      {d.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── My Permissions tab ── */}
      {tab === "permissions" && (
        <div>
          {myPerms.length === 0 ? (
            <p
              style={{
                color: "var(--text-tertiary)",
                fontSize: "0.85rem",
                textAlign: "center",
                padding: "3rem 0",
              }}
            >
              You don't have specific permissions on any dashboards yet.
            </p>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
              }}
            >
              {myPerms.map((p) => (
                <div
                  key={p.dashboard_id}
                  onClick={() => navigate(`/dashboards/${p.dashboard_id}`)}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "var(--green-border)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                >
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "0.88rem",
                    }}
                  >
                    {p.dashboard_title}
                  </span>
                  <span
                    style={{
                      color: "var(--green)",
                      fontSize: "0.72rem",
                      backgroundColor: "var(--green-bg)",
                      padding: "0.15rem 0.5rem",
                      borderRadius: "var(--radius-sm)",
                      fontWeight: 500,
                      textTransform: "capitalize",
                    }}
                  >
                    {p.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
