"""Simple SMTP email service for sending invite emails."""

import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

import structlog

from config import settings

log = structlog.get_logger()


async def send_invite_email(to_email: str, invite_url: str) -> bool:
    """Send an invite email. Returns True on success, False on failure."""
    if not settings.smtp_configured:
        log.warning("SMTP not configured, skipping email send")
        return False

    from_addr = settings.SMTP_FROM or settings.SMTP_USER

    msg = MIMEMultipart("alternative")
    msg["Subject"] = "You're invited to KQL Dashboard"
    msg["From"] = from_addr
    msg["To"] = to_email

    text_body = (
        f"Hi,\n\n"
        f"You've been invited to join KQL Dashboard.\n\n"
        f"Click the link below to create your account:\n"
        f"{invite_url}\n\n"
        f"This link expires in 7 days and can only be used once.\n\n"
        f"— KQL Dashboard Team"
    )

    html_body = f"""\
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
  <div style="text-align: center; margin-bottom: 24px;">
    <span style="color: #13C636; font-size: 20px; font-weight: 700;">KQL Dashboard</span>
  </div>
  <p style="color: #333; font-size: 15px; line-height: 1.6;">Hi,</p>
  <p style="color: #333; font-size: 15px; line-height: 1.6;">
    You've been invited to join <strong>KQL Dashboard</strong>.
  </p>
  <div style="text-align: center; margin: 28px 0;">
    <a href="{invite_url}"
       style="display: inline-block; padding: 12px 32px; background-color: #13C636;
              color: #fff; text-decoration: none; border-radius: 6px;
              font-weight: 600; font-size: 15px;">
      Create Your Account
    </a>
  </div>
  <p style="color: #888; font-size: 13px; line-height: 1.5;">
    This link expires in 7 days and can only be used once.
  </p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
  <p style="color: #aaa; font-size: 12px;">
    If the button doesn't work, copy and paste this URL into your browser:<br />
    <a href="{invite_url}" style="color: #13C636; word-break: break-all;">{invite_url}</a>
  </p>
</div>"""

    msg.attach(MIMEText(text_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        if settings.SMTP_PORT == 465:
            context = ssl.create_default_context()
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=context) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.send_message(msg)

        log.info("invite_email_sent", to=to_email)
        return True
    except Exception as exc:
        log.error("invite_email_failed", to=to_email, error=str(exc))
        return False
