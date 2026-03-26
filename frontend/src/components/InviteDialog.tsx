import { useState } from "react";
import { api } from "../api/client";

interface InviteResponse {
  token: string;
  expires_at: string;
}

interface InviteDialogProps {
  onClose: () => void;
}

export function InviteDialog({ onClose }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async () => {
    setError("");
    setLoading(true);
    try {
      const data = await api.post<InviteResponse>("/auth/invite", {});
      const url = `${window.location.origin}/register?token=${data.token}`;
      setInviteUrl(url);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate invite");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent("You're invited to KQL Dashboard");
    const body = encodeURIComponent(
      `Hi${email ? " " + email : ""},\n\nYou've been invited to join KQL Dashboard.\n\nClick here to create your account:\n${inviteUrl}\n\nThis link expires in 7 days.`,
    );
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, "_self");
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.75rem",
    backgroundColor: "var(--surface-1)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    fontSize: "0.82rem",
    fontFamily: "var(--font-body)",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.15s ease",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: "var(--surface-2)",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border)",
          padding: "1.5rem",
          width: "440px",
          boxShadow: "var(--shadow-lg)",
          animation: "fadeIn 0.2s ease both",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
          }}
        >
          <h2>Invite User</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              color: "var(--text-tertiary)",
              border: "none",
              fontSize: "1rem",
              cursor: "pointer",
            }}
          >
            x
          </button>
        </div>

        {!inviteUrl ? (
          <>
            <label
              style={{
                display: "block",
                color: "var(--text-tertiary)",
                fontSize: "0.72rem",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "0.35rem",
              }}
            >
              Recipient email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              style={{ ...inputStyle, marginBottom: "1rem" }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--green-border)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border)")
              }
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              autoFocus
            />

            {error && (
              <div
                style={{
                  color: "var(--error)",
                  fontSize: "0.82rem",
                  marginBottom: "1rem",
                  padding: "0.4rem 0.6rem",
                  backgroundColor: "rgba(240, 72, 72, 0.06)",
                  borderRadius: "var(--radius-sm)",
                }}
              >
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading}
              style={{
                width: "100%",
                padding: "0.55rem",
                backgroundColor: loading ? "var(--surface-4)" : "var(--green)",
                color: loading
                  ? "var(--text-tertiary)"
                  : "var(--text-inverse)",
                border: "none",
                borderRadius: "var(--radius-sm)",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "0.82rem",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
              }}
            >
              {loading ? "Generating..." : "Generate Invite Link"}
            </button>
          </>
        ) : (
          <>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "0.82rem",
                marginBottom: "0.75rem",
              }}
            >
              Invite link generated{email ? ` for ${email}` : ""}. Share it
              with the user:
            </p>

            <div
              style={{
                padding: "0.55rem 0.75rem",
                backgroundColor: "var(--surface-1)",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                fontSize: "0.75rem",
                color: "var(--text-tertiary)",
                wordBreak: "break-all",
                marginBottom: "1rem",
                lineHeight: 1.4,
              }}
            >
              {inviteUrl}
            </div>

            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1,
                  padding: "0.5rem",
                  backgroundColor: copied
                    ? "var(--green-bg)"
                    : "transparent",
                  color: copied ? "var(--green)" : "var(--text-secondary)",
                  border: `1px solid ${copied ? "var(--green-border)" : "var(--border)"}`,
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer",
                  fontSize: "0.82rem",
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                }}
              >
                {copied ? "Copied!" : "Copy Link"}
              </button>
              {email && (
                <button
                  onClick={handleSendEmail}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    backgroundColor: "var(--green)",
                    color: "var(--text-inverse)",
                    border: "none",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                  }}
                >
                  Send via Email
                </button>
              )}
            </div>

            <p
              style={{
                color: "var(--text-tertiary)",
                fontSize: "0.72rem",
                marginTop: "0.75rem",
                textAlign: "center",
              }}
            >
              Link expires in 7 days and can only be used once.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
