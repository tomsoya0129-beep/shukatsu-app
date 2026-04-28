"""Email sending via Gmail SMTP (preferred) or Resend (fallback).

Transport selection:
- If SMTP_USER and SMTP_PASSWORD are set → use Gmail SMTP
- Else if RESEND_API_KEY is set → use Resend
- Else: disabled (send_email returns False)
"""
from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from typing import Optional

import httpx

from .config import settings


log = logging.getLogger(__name__)

RESEND_URL = "https://api.resend.com/emails"


def _pick_provider() -> str:
    if settings.mail_provider == "gmail":
        return "gmail"
    if settings.mail_provider == "resend":
        return "resend"
    # auto
    if settings.smtp_user and settings.smtp_password:
        return "gmail"
    if settings.resend_api_key:
        return "resend"
    return "none"


def is_configured() -> bool:
    return _pick_provider() != "none"


def provider_name() -> str:
    p = _pick_provider()
    if p == "gmail":
        return f"Gmail SMTP ({settings.smtp_user})"
    if p == "resend":
        return "Resend (onboarding@resend.dev)"
    return "未設定"


def _send_via_gmail_sync(to: str, subject: str, html: str, text: Optional[str]) -> bool:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = formataddr((settings.smtp_from_name, settings.smtp_user or ""))
    msg["To"] = to
    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(settings.smtp_user or "", settings.smtp_password or "")
            server.sendmail(settings.smtp_user or "", [to], msg.as_string())
        return True
    except Exception as e:  # noqa: BLE001
        log.exception("Gmail SMTP send failed: %s", e)
        return False


async def _send_via_gmail(to: str, subject: str, html: str, text: Optional[str]) -> bool:
    if not (settings.smtp_user and settings.smtp_password):
        return False
    return await asyncio.to_thread(_send_via_gmail_sync, to, subject, html, text)


async def _send_via_resend(to: str, subject: str, html: str, text: Optional[str]) -> bool:
    if not settings.resend_api_key:
        return False
    payload: dict = {
        "from": settings.mail_from,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.post(
                RESEND_URL,
                json=payload,
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
            )
            if r.status_code >= 300:
                log.error(
                    "Resend send failed to=%s status=%s body=%s",
                    to,
                    r.status_code,
                    r.text[:400],
                )
                return False
            return True
    except Exception as e:  # noqa: BLE001
        log.exception("Resend send error: %s", e)
        return False


async def send_email(
    to: str,
    subject: str,
    html: str,
    *,
    text: Optional[str] = None,
) -> bool:
    """Send an email using the configured transport. Returns True on success."""
    provider = _pick_provider()
    if provider == "none":
        log.info("No mail provider configured; skipping send to %s", to)
        return False
    if provider == "gmail":
        return await _send_via_gmail(to, subject, html, text)
    return await _send_via_resend(to, subject, html, text)


def render_reminder_email(display_name: str, reminders: list[dict]) -> tuple[str, str, str]:
    """Render an email for a batch of due reminders.

    Returns (subject, html, text).
    """
    count = len(reminders)
    subject = f"【就活マネージャー】本日のお知らせ {count}件"

    rows_html = "".join(
        f"""
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;white-space:nowrap;">
            {r['when_label']}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;color:#0f172a;">
            {r['title']}
          </td>
        </tr>
        """
        for r in reminders
    )
    rows_text = "\n".join(f"- {r['when_label']}: {r['title']}" for r in reminders)

    html = f"""
<!doctype html>
<html lang="ja">
<body style="margin:0;padding:20px;background:#f8fafc;font-family:'Hiragino Sans','Noto Sans JP',sans-serif;color:#0f172a;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.05);">
    <div style="background:#2563eb;color:#fff;padding:18px 22px;">
      <div style="font-size:12px;opacity:.85;margin-bottom:2px;">就活マネージャー</div>
      <div style="font-size:18px;font-weight:700;">本日のリマインダー {count}件</div>
    </div>
    <div style="padding:22px;">
      <p style="margin:0 0 14px 0;font-size:14px;color:#475569;">
        {display_name}さん、今日〜直近のイベントです。
      </p>
      <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
        {rows_html}
      </table>
      <div style="margin-top:22px;text-align:center;">
        <a href="{settings.app_public_url}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;">
          アプリを開く
        </a>
      </div>
    </div>
    <div style="padding:14px 22px;background:#f1f5f9;color:#64748b;font-size:11px;">
      このメールは就活マネージャー（Shukatsu Manager）から送信されています。<br>
      通知を止めたい場合は、アプリの設定からオフにできます。
    </div>
  </div>
</body>
</html>
""".strip()

    text = (
        f"就活マネージャー - 本日のリマインダー {count}件\n\n"
        f"{display_name}さん、今日〜直近のイベントです:\n\n"
        f"{rows_text}\n\n"
        f"アプリ: {settings.app_public_url}\n"
    )
    return subject, html, text
