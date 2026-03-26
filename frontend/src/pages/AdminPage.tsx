import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth";

interface LocalUser {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
}

interface PermissionEntry {
  dashboard_id: string;
  dashboard_title: string;
  user_oid: string;
  role: string;
  granted_by: string;
  granted_at: string;
}

export function AdminPage() {
  const { getAccessToken, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"users" | "permissions">("users");

  const fetchData = useCallback(async () => {
    try {
      const token = await getAccessToken(["openid"]);
      const [usersData, permsData] = await Promise.all([
        api.get<{ users: LocalUser[] }>("/admin/users", token),
        api.get<{ permissions: PermissionEntry[] }>(
          "/admin/permissions",
          token,
        ),
      ]);
      setUsers(usersData.users);
      setPermissions(permsData.permissions);
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteUser = async (userId: string, email: string) => {
    if (!confirm(`Delete user ${email}? This will revoke all their permissions.`))
      return;
    try {
      const token = await getAccessToken(["openid"]);
      await api.delete("/admin/users/" + userId, token);
      fetchData();
    } catch (err) {
      console.error("Failed to delete user:", err);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div
        style={{
          padding: "4rem 2rem",
          textAlign: "center",
          color: "var(--text-tertiary)",
        }}
      >
        Access denied. Super admin required.
      </div>
    );
  }

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

  // Build a lookup: user_oid → list of permissions
  const permsByUser: Record<string, PermissionEntry[]> = {};
  for (const p of permissions) {
    if (!permsByUser[p.user_oid]) permsByUser[p.user_oid] = [];
    permsByUser[p.user_oid].push(p);
  }

  return (
    <div
      style={{
        padding: "2.5rem 2rem",
        maxWidth: "960px",
        margin: "0 auto",
        animation: "fadeIn 0.35s ease both",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>Admin</h1>
        <button
          onClick={() => navigate("/dashboards")}
          style={{
            padding: "0.4rem 0.85rem",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontFamily: "var(--font-body)",
          }}
        >
          Back to Dashboards
        </button>
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
        <button style={tabStyle(tab === "users")} onClick={() => setTab("users")}>
          Users ({users.length})
        </button>
        <button
          style={tabStyle(tab === "permissions")}
          onClick={() => setTab("permissions")}
        >
          All Permissions ({permissions.length})
        </button>
      </div>

      {/* Users tab */}
      {tab === "users" && (
        <div>
          {users.length === 0 ? (
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
              No local users registered yet.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {users.map((u) => (
                <div
                  key={u.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0.85rem 1rem",
                    backgroundColor: "var(--surface-2)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        color: "var(--text-primary)",
                        fontSize: "0.88rem",
                        fontWeight: 500,
                      }}
                    >
                      {u.display_name}
                    </div>
                    <div
                      style={{
                        color: "var(--text-tertiary)",
                        fontSize: "0.75rem",
                        marginTop: "0.15rem",
                      }}
                    >
                      {u.email}
                    </div>
                    {/* Show this user's dashboard permissions */}
                    {permsByUser[u.id] && permsByUser[u.id].length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          gap: "0.35rem",
                          flexWrap: "wrap",
                          marginTop: "0.4rem",
                        }}
                      >
                        {permsByUser[u.id].map((p) => (
                          <span
                            key={p.dashboard_id}
                            style={{
                              fontSize: "0.68rem",
                              padding: "0.1rem 0.4rem",
                              backgroundColor: "var(--green-bg)",
                              color: "var(--green)",
                              borderRadius: "var(--radius-sm)",
                              fontWeight: 500,
                            }}
                          >
                            {p.dashboard_title}: {p.role}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-tertiary)",
                      }}
                    >
                      {u.created_at ? new Date(u.created_at).toLocaleDateString() : ""}
                    </span>
                    <button
                      onClick={() => handleDeleteUser(u.id, u.email)}
                      style={{
                        backgroundColor: "transparent",
                        color: "var(--error)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        padding: "0.2rem 0.5rem",
                        fontFamily: "var(--font-body)",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.borderColor = "rgba(240,72,72,0.3)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.borderColor = "var(--border)")
                      }
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Permissions tab */}
      {tab === "permissions" && (
        <div style={{ overflow: "auto" }}>
          {permissions.length === 0 ? (
            <p style={{ color: "var(--text-tertiary)", fontSize: "0.85rem" }}>
              No permissions assigned yet.
            </p>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.8rem",
                fontFamily: "var(--font-body)",
              }}
            >
              <thead>
                <tr>
                  {["Dashboard", "User", "Role", "Granted"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "0.5rem 0.7rem",
                        borderBottom: "1px solid var(--green-border)",
                        color: "var(--text-primary)",
                        fontWeight: 600,
                        fontSize: "0.72rem",
                        letterSpacing: "0.03em",
                        backgroundColor: "var(--surface-2)",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((p, i) => (
                  <tr
                    key={`${p.dashboard_id}-${p.user_oid}`}
                    style={{
                      backgroundColor:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
                    }}
                  >
                    <td
                      style={{
                        padding: "0.4rem 0.7rem",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-primary)",
                      }}
                    >
                      {p.dashboard_title}
                    </td>
                    <td
                      style={{
                        padding: "0.4rem 0.7rem",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {p.user_oid.substring(0, 8)}...
                    </td>
                    <td
                      style={{
                        padding: "0.4rem 0.7rem",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--green)",
                          fontSize: "0.72rem",
                          backgroundColor: "var(--green-bg)",
                          padding: "0.1rem 0.4rem",
                          borderRadius: "var(--radius-sm)",
                          fontWeight: 500,
                          textTransform: "capitalize",
                        }}
                      >
                        {p.role}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "0.4rem 0.7rem",
                        borderBottom: "1px solid var(--border)",
                        color: "var(--text-tertiary)",
                        fontSize: "0.72rem",
                      }}
                    >
                      {p.granted_at
                        ? new Date(p.granted_at).toLocaleDateString()
                        : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
