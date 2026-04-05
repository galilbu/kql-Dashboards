import { useEffect, useState, useCallback } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";

interface Activity {
  id: string;
  timestamp: string;
  user_oid: string;
  user_name: string;
  action: string;
  target_type: string;
  target_id: string;
  target_name: string;
  details: string;
}

const actionLabels: Record<string, { label: string; color: string }> = {
  dashboard_create: { label: "Created dashboard", color: "var(--green)" },
  dashboard_update: { label: "Updated dashboard", color: "#60a5fa" },
  dashboard_delete: { label: "Deleted dashboard", color: "var(--error)" },
  permission_grant: { label: "Granted permission", color: "#a78bfa" },
  permission_revoke: { label: "Revoked permission", color: "#f59e0b" },
  device_isolate: { label: "Isolated device", color: "var(--error)" },
  device_release: { label: "Released device", color: "var(--green)" },
};

export function ActivityLog() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const { getAccessToken } = useAuth();

  const fetchActivities = useCallback(async () => {
    try {
      const token = await getAccessToken(["openid"]);
      const data = await api.get<{ activities: Activity[] }>("/activity", token);
      setActivities(data.activities);
    } catch (err) {
      console.error("Failed to fetch activity log:", err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

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
        <h1>Activity Log</h1>
        <button
          onClick={() => { setLoading(true); fetchActivities(); }}
          style={{
            padding: "0.4rem 0.85rem",
            backgroundColor: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: "0.78rem",
            fontFamily: "var(--font-body)",
            fontWeight: 500,
          }}
        >
          Refresh
        </button>
      </div>

      {activities.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "3rem 2rem",
            color: "var(--text-tertiary)",
          }}
        >
          <p style={{ fontSize: "0.9rem" }}>No activity recorded yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {activities.map((a, i) => {
            const info = actionLabels[a.action] || {
              label: a.action,
              color: "var(--text-secondary)",
            };
            const time = a.timestamp
              ? new Date(a.timestamp).toLocaleString()
              : "";

            return (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.65rem 0.85rem",
                  backgroundColor: "var(--surface-2)",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  animation: `fadeIn 0.25s ease ${i * 0.02}s both`,
                }}
              >
                {/* Color dot */}
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: info.color,
                    flexShrink: 0,
                  }}
                />
                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem", flexWrap: "wrap" }}>
                    <span
                      style={{
                        color: "var(--text-primary)",
                        fontSize: "0.82rem",
                        fontWeight: 500,
                      }}
                    >
                      {a.user_name || a.user_oid}
                    </span>
                    <span style={{ color: info.color, fontSize: "0.78rem" }}>
                      {info.label}
                    </span>
                    {a.target_name && (
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontSize: "0.78rem",
                        }}
                      >
                        {a.target_name}
                      </span>
                    )}
                    {a.details && (
                      <span
                        style={{
                          color: "var(--text-tertiary)",
                          fontSize: "0.72rem",
                          fontStyle: "italic",
                        }}
                      >
                        ({a.details})
                      </span>
                    )}
                  </div>
                </div>
                {/* Timestamp */}
                <span
                  style={{
                    color: "var(--text-tertiary)",
                    fontSize: "0.68rem",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {time}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
