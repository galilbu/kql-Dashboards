import { useState, useRef } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth";

interface ActionResult {
  success: boolean;
  device_name: string;
  action: string;
  message: string;
}

interface OtpResponse {
  sent: boolean;
  message: string;
}

interface BulkResult {
  device_name: string;
  status: "pending" | "running" | "success" | "error";
  message: string;
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

const labelStyle: React.CSSProperties = {
  display: "block",
  color: "var(--text-tertiary)",
  fontSize: "0.72rem",
  fontWeight: 600,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  marginBottom: "0.35rem",
};

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

function downloadCsvTemplate() {
  const csv = "device_name\nWORKSTATION-001\nWORKSTATION-002\nLAPTOP-003\n";
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "device_action_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseCsv(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  // Skip header if it looks like one
  const start = lines[0]?.toLowerCase() === "device_name" ? 1 : 0;
  return lines.slice(start).filter(Boolean);
}

export function ActionsPage() {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [deviceName, setDeviceName] = useState("");
  const [action, setAction] = useState<"isolate" | "release">("isolate");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState("");

  // OTP state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [otpSending, setOtpSending] = useState(false);

  // Bulk state
  const [bulkDevices, setBulkDevices] = useState<string[]>([]);
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { getAccessToken } = useAuth();

  const handleSendOtp = async () => {
    if (!deviceName.trim()) return;
    setOtpSending(true);
    setError("");
    setOtpMessage("");
    try {
      const token = await getAccessToken(["openid"]);
      const data = await api.post<OtpResponse>(
        "/actions/otp/send",
        { device_name: deviceName.trim(), action },
        token,
      );
      setOtpSent(true);
      setOtpMessage(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const handleExecute = async () => {
    if (!deviceName.trim() || !otpCode.trim()) return;

    setLoading(true);
    setError("");
    setResult(null);
    try {
      const token = await getAccessToken(["openid"]);
      const data = await api.post<ActionResult>(
        "/actions/device",
        { device_name: deviceName.trim(), action, comment, otp_code: otpCode.trim() },
        token,
      );
      setResult(data);
      setOtpSent(false);
      setOtpCode("");
      setOtpMessage("");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const resetOtp = () => {
    setOtpSent(false);
    setOtpCode("");
    setOtpMessage("");
    setResult(null);
    setError("");
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const devices = parseCsv(reader.result as string);
      setBulkDevices(devices);
      setBulkResults([]);
    };
    reader.readAsText(file);
    // Reset so same file can be re-selected
    e.target.value = "";
  };

  // Bulk OTP state
  const [bulkOtpSent, setBulkOtpSent] = useState(false);
  const [bulkOtpCode, setBulkOtpCode] = useState("");
  const [bulkOtpMessage, setBulkOtpMessage] = useState("");

  const handleBulkSendOtp = async () => {
    if (bulkDevices.length === 0) return;
    setOtpSending(true);
    setError("");
    try {
      const token = await getAccessToken(["openid"]);
      const data = await api.post<OtpResponse>(
        "/actions/otp/send",
        { device_name: `bulk-${bulkDevices.length}-devices`, action },
        token,
      );
      setBulkOtpSent(true);
      setBulkOtpMessage(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setOtpSending(false);
    }
  };

  const handleBulkExecute = async () => {
    if (bulkDevices.length === 0 || bulkOtpCode.length !== 6) return;

    setBulkRunning(true);
    const results: BulkResult[] = bulkDevices.map((d) => ({
      device_name: d,
      status: "pending",
      message: "",
    }));
    setBulkResults([...results]);

    const token = await getAccessToken(["openid"]);

    for (let i = 0; i < results.length; i++) {
      results[i].status = "running";
      setBulkResults([...results]);

      try {
        const data = await api.post<ActionResult>(
          "/actions/device",
          {
            device_name: results[i].device_name,
            action,
            comment: comment || `Bulk ${action} operation`,
            otp_code: bulkOtpCode.trim(),
          },
          token,
        );
        results[i].status = "success";
        results[i].message = data.message;
      } catch (err: unknown) {
        results[i].status = "error";
        results[i].message =
          err instanceof Error ? err.message : "Failed";
      }
      setBulkResults([...results]);
    }

    setBulkRunning(false);
  };

  const actionButtons = (
    <>
      <label style={labelStyle}>Action</label>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <button
          onClick={() => setAction("isolate")}
          style={{
            flex: 1,
            padding: "0.55rem",
            backgroundColor:
              action === "isolate"
                ? "rgba(240, 72, 72, 0.08)"
                : "var(--surface-1)",
            color:
              action === "isolate" ? "var(--error)" : "var(--text-secondary)",
            border: `1px solid ${action === "isolate" ? "rgba(240, 72, 72, 0.25)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontFamily: "var(--font-body)",
            fontWeight: action === "isolate" ? 600 : 400,
            transition: "all 0.15s ease",
          }}
        >
          Isolate
        </button>
        <button
          onClick={() => setAction("release")}
          style={{
            flex: 1,
            padding: "0.55rem",
            backgroundColor:
              action === "release"
                ? "var(--green-bg)"
                : "var(--surface-1)",
            color:
              action === "release"
                ? "var(--green)"
                : "var(--text-secondary)",
            border: `1px solid ${action === "release" ? "var(--green-border)" : "var(--border)"}`,
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontFamily: "var(--font-body)",
            fontWeight: action === "release" ? 600 : 400,
            transition: "all 0.15s ease",
          }}
        >
          Release
        </button>
      </div>

      <label style={labelStyle}>Comment (optional)</label>
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Reason for action..."
        style={{ ...inputStyle, marginBottom: "1.25rem" }}
        onFocus={(e) =>
          (e.currentTarget.style.borderColor = "var(--green-border)")
        }
        onBlur={(e) =>
          (e.currentTarget.style.borderColor = "var(--border)")
        }
      />
    </>
  );

  return (
    <div
      style={{
        padding: "2.5rem 2rem",
        maxWidth: "720px",
        margin: "0 auto",
        animation: "fadeIn 0.35s ease both",
      }}
    >
      <h1 style={{ marginBottom: "0.35rem" }}>Actions</h1>
      <p
        style={{
          color: "var(--text-tertiary)",
          fontSize: "0.82rem",
          marginBottom: "1.5rem",
        }}
      >
        Execute security operations on endpoints via Microsoft Defender.
      </p>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: "0.25rem",
          borderBottom: "1px solid var(--border)",
          marginBottom: "1.5rem",
        }}
      >
        <button style={tabStyle(tab === "single")} onClick={() => setTab("single")}>
          Single Device
        </button>
        <button style={tabStyle(tab === "bulk")} onClick={() => setTab("bulk")}>
          Bulk (CSV)
        </button>
      </div>

      {/* ── Single Device tab ── */}
      {tab === "single" && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--surface-2)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 style={{ marginBottom: "1.25rem" }}>
            Device Isolate / Release
          </h3>

          <label style={labelStyle}>Device name</label>
          <input
            value={deviceName}
            onChange={(e) => { setDeviceName(e.target.value); resetOtp(); }}
            placeholder="e.g. WORKSTATION-001"
            style={{ ...inputStyle, marginBottom: "1rem" }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--green-border)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border)")
            }
            autoFocus
          />

          {actionButtons}

          {/* Step 1: Send OTP */}
          {!otpSent && (
            <button
              onClick={handleSendOtp}
              disabled={otpSending || !deviceName.trim()}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor:
                  otpSending || !deviceName.trim()
                    ? "var(--surface-4)"
                    : action === "isolate"
                      ? "#e04848"
                      : "var(--green)",
                color:
                  otpSending || !deviceName.trim()
                    ? "var(--text-tertiary)"
                    : "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor:
                  otpSending || !deviceName.trim()
                    ? "not-allowed"
                    : "pointer",
                fontSize: "0.85rem",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                transition: "background-color 0.15s ease",
              }}
            >
              {otpSending
                ? "Sending verification..."
                : `${action === "isolate" ? "Isolate" : "Release"} Device`}
            </button>
          )}

          {/* Step 2: Enter OTP + confirm */}
          {otpSent && !result && (
            <div style={{
              padding: "0.85rem",
              backgroundColor: "rgba(78, 164, 247, 0.06)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(78, 164, 247, 0.15)",
            }}>
              <p style={{ color: "var(--info)", fontSize: "0.82rem", marginBottom: "0.6rem" }}>
                {otpMessage}
              </p>
              <label style={{ ...labelStyle, color: "var(--info)" }}>Verification code</label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    letterSpacing: "0.3em",
                    textAlign: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                  }}
                  onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "rgba(78, 164, 247, 0.4)")
                  }
                  onBlur={(e) =>
                    (e.currentTarget.style.borderColor = "var(--border)")
                  }
                  onKeyDown={(e) => e.key === "Enter" && otpCode.length === 6 && handleExecute()}
                  autoFocus
                />
                <button
                  onClick={handleExecute}
                  disabled={loading || otpCode.length !== 6}
                  style={{
                    padding: "0.6rem 1.2rem",
                    backgroundColor:
                      loading || otpCode.length !== 6
                        ? "var(--surface-4)"
                        : action === "isolate"
                          ? "#e04848"
                          : "var(--green)",
                    color:
                      loading || otpCode.length !== 6
                        ? "var(--text-tertiary)"
                        : "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor:
                      loading || otpCode.length !== 6
                        ? "not-allowed"
                        : "pointer",
                    fontSize: "0.82rem",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                  }}
                >
                  {loading ? "Executing..." : "Confirm"}
                </button>
              </div>
              <button
                onClick={resetOtp}
                style={{
                  marginTop: "0.5rem",
                  backgroundColor: "transparent",
                  color: "var(--text-tertiary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-body)",
                  padding: 0,
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {error && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.6rem 0.8rem",
                backgroundColor: "rgba(240, 72, 72, 0.06)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid rgba(240, 72, 72, 0.15)",
                color: "var(--error)",
                fontSize: "0.82rem",
              }}
            >
              {error}
            </div>
          )}

          {result && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.6rem 0.8rem",
                backgroundColor: "var(--green-bg)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--green-border)",
                color: "var(--green)",
                fontSize: "0.82rem",
              }}
            >
              {result.message}
            </div>
          )}
        </div>
      )}

      {/* ── Bulk CSV tab ── */}
      {tab === "bulk" && (
        <div
          style={{
            padding: "1.5rem",
            backgroundColor: "var(--surface-2)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          <h3 style={{ marginBottom: "1.25rem" }}>
            Bulk Device Isolate / Release
          </h3>

          {/* CSV upload + template */}
          <label style={labelStyle}>Upload CSV file</label>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              marginBottom: "1rem",
              alignItems: "center",
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              style={{ display: "none" }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "var(--surface-1)",
                color: "var(--text-secondary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "0.82rem",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--green-border)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            >
              Choose CSV File
            </button>
            <button
              onClick={downloadCsvTemplate}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "transparent",
                color: "var(--text-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                cursor: "pointer",
                fontSize: "0.78rem",
                fontFamily: "var(--font-body)",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
            >
              Download Template
            </button>
            {bulkDevices.length > 0 && (
              <span
                style={{
                  fontSize: "0.78rem",
                  color: "var(--green)",
                  fontWeight: 500,
                }}
              >
                {bulkDevices.length} device(s) loaded
              </span>
            )}
          </div>

          {/* Show loaded devices */}
          {bulkDevices.length > 0 && bulkResults.length === 0 && (
            <div
              style={{
                padding: "0.6rem 0.8rem",
                backgroundColor: "var(--surface-1)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                marginBottom: "1rem",
                maxHeight: "150px",
                overflow: "auto",
              }}
            >
              {bulkDevices.map((d, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    padding: "0.15rem 0",
                  }}
                >
                  {d}
                </div>
              ))}
            </div>
          )}

          {actionButtons}

          {/* Step 1: Send OTP for bulk */}
          {!bulkOtpSent && (
            <button
              onClick={handleBulkSendOtp}
              disabled={otpSending || bulkDevices.length === 0}
              style={{
                width: "100%",
                padding: "0.6rem",
                backgroundColor:
                  otpSending || bulkDevices.length === 0
                    ? "var(--surface-4)"
                    : action === "isolate"
                      ? "#e04848"
                      : "var(--green)",
                color:
                  otpSending || bulkDevices.length === 0
                    ? "var(--text-tertiary)"
                    : "#fff",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor:
                  otpSending || bulkDevices.length === 0
                    ? "not-allowed"
                    : "pointer",
                fontSize: "0.85rem",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                transition: "background-color 0.15s ease",
              }}
            >
              {otpSending
                ? "Sending verification..."
                : `${action === "isolate" ? "Isolate" : "Release"} ${bulkDevices.length} Device(s)`}
            </button>
          )}

          {/* Step 2: Enter OTP for bulk */}
          {bulkOtpSent && !bulkRunning && bulkResults.length === 0 && (
            <div style={{
              padding: "0.85rem",
              backgroundColor: "rgba(78, 164, 247, 0.06)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(78, 164, 247, 0.15)",
            }}>
              <p style={{ color: "var(--info)", fontSize: "0.82rem", marginBottom: "0.6rem" }}>
                {bulkOtpMessage}
              </p>
              <label style={{ ...labelStyle, color: "var(--info)" }}>Verification code</label>
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  value={bulkOtpCode}
                  onChange={(e) => setBulkOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  style={{
                    ...inputStyle,
                    flex: 1,
                    letterSpacing: "0.3em",
                    textAlign: "center",
                    fontFamily: "var(--font-mono)",
                    fontSize: "1.1rem",
                    fontWeight: 600,
                  }}
                  onKeyDown={(e) => e.key === "Enter" && bulkOtpCode.length === 6 && handleBulkExecute()}
                  autoFocus
                />
                <button
                  onClick={handleBulkExecute}
                  disabled={bulkOtpCode.length !== 6}
                  style={{
                    padding: "0.6rem 1.2rem",
                    backgroundColor: bulkOtpCode.length !== 6 ? "var(--surface-4)" : action === "isolate" ? "#e04848" : "var(--green)",
                    color: bulkOtpCode.length !== 6 ? "var(--text-tertiary)" : "#fff",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: bulkOtpCode.length !== 6 ? "not-allowed" : "pointer",
                    fontSize: "0.82rem",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                  }}
                >
                  Confirm
                </button>
              </div>
              <button
                onClick={() => { setBulkOtpSent(false); setBulkOtpCode(""); }}
                style={{
                  marginTop: "0.5rem",
                  backgroundColor: "transparent",
                  color: "var(--text-tertiary)",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.72rem",
                  fontFamily: "var(--font-body)",
                  padding: 0,
                }}
              >
                Cancel
              </button>
            </div>
          )}

          {/* Progress indicator during bulk run */}
          {bulkRunning && (
            <div style={{
              padding: "0.6rem 0.8rem",
              backgroundColor: "rgba(78, 164, 247, 0.06)",
              borderRadius: "var(--radius-sm)",
              border: "1px solid rgba(78, 164, 247, 0.15)",
              color: "var(--info)",
              fontSize: "0.82rem",
              fontWeight: 500,
            }}>
              Running... ({bulkResults.filter((r) => r.status === "success" || r.status === "error").length}/{bulkDevices.length})
            </div>
          )}

          {/* Bulk results */}
          {bulkResults.length > 0 && (
            <div
              style={{
                marginTop: "1rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                maxHeight: "300px",
                overflow: "auto",
              }}
            >
              {bulkResults.map((r, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.4rem 0.6rem",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor:
                      r.status === "success"
                        ? "var(--green-bg)"
                        : r.status === "error"
                          ? "rgba(240, 72, 72, 0.06)"
                          : r.status === "running"
                            ? "rgba(78, 164, 247, 0.06)"
                            : "transparent",
                    border: `1px solid ${
                      r.status === "success"
                        ? "var(--green-border)"
                        : r.status === "error"
                          ? "rgba(240, 72, 72, 0.15)"
                          : "var(--border)"
                    }`,
                    fontSize: "0.78rem",
                  }}
                >
                  {/* Status indicator */}
                  <div
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      flexShrink: 0,
                      backgroundColor:
                        r.status === "success"
                          ? "var(--green)"
                          : r.status === "error"
                            ? "var(--error)"
                            : r.status === "running"
                              ? "var(--info)"
                              : "var(--text-tertiary)",
                      animation:
                        r.status === "running"
                          ? "pulse 1s ease-in-out infinite"
                          : "none",
                    }}
                  />
                  <span
                    style={{
                      color: "var(--text-primary)",
                      fontWeight: 500,
                      minWidth: "120px",
                    }}
                  >
                    {r.device_name}
                  </span>
                  <span
                    style={{
                      color:
                        r.status === "success"
                          ? "var(--green)"
                          : r.status === "error"
                            ? "var(--error)"
                            : "var(--text-tertiary)",
                      flex: 1,
                    }}
                  >
                    {r.status === "pending"
                      ? "Waiting..."
                      : r.status === "running"
                        ? "In progress..."
                        : r.message}
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
