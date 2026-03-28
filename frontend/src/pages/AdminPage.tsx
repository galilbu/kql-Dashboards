import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";
import { InviteDialog } from "../components/InviteDialog";

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
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

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

  // Build a lookup: user_oid → list of permissions
  const permsByUser: Record<string, PermissionEntry[]> = {};
  for (const p of permissions) {
    if (!permsByUser[p.user_oid]) permsByUser[p.user_oid] = [];
    permsByUser[p.user_oid].push(p);
  }

  const roleBadgeColors: Record<string, { bg: string; color: string }> = {
    admin: { bg: "var(--green-bg)", color: "var(--green)" },
    editor: { bg: "rgba(59,130,246,0.1)", color: "#60a5fa" },
    viewer: { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  };

  return (
    <div
      style={{
        padding: "2.5rem 2rem",
        maxWidth: "960px",
        margin: "0 auto",
        animation: "fadeIn 0.35s ease both",
      }}
    >
      {showInvite && <InviteDialog onClose={() => { setShowInvite(false); fetchData(); }} />}

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>Users</h1>
        <button
          onClick={() => setShowInvite(true)}
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
          + Invite User
        </button>
      </div>

      {/* Users list */}
      {users.length === 0 ? (
        <p
          style={{
            color: "var(--text-tertiary)",
            fontSize: "0.85rem",
            textAlign: "center",
            padding: "3rem 0",
          }}
        >
          No users registered yet.
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
                  <span
                    style={{
                      marginLeft: "0.5rem",
                      fontSize: "0.68rem",
                    }}
                  >
                    {u.created_at
                      ? new Date(u.created_at).toLocaleDateString()
                      : ""}
                  </span>
                </div>
                {/* Dashboard permission badges */}
                {permsByUser[u.id] && permsByUser[u.id].length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      gap: "0.35rem",
                      flexWrap: "wrap",
                      marginTop: "0.4rem",
                    }}
                  >
                    {permsByUser[u.id].map((p) => {
                      const badge =
                        roleBadgeColors[p.role] || roleBadgeColors.viewer;
                      return (
                        <span
                          key={p.dashboard_id}
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.1rem 0.4rem",
                            backgroundColor: badge.bg,
                            color: badge.color,
                            borderRadius: "var(--radius-sm)",
                            fontWeight: 500,
                          }}
                        >
                          {p.dashboard_title}: {p.role}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
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
  );
}
