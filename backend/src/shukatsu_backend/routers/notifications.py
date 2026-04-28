"""Notification preferences and test endpoints."""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlmodel import Session, select

from ..auth import get_current_user
from ..config import settings
from ..database import get_session
from ..emails import is_configured as mail_is_configured, provider_name
from ..models import User
from ..reminder_service import dispatch_due_reminders, regenerate_for_user, send_test_email


log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


class NotificationPrefs(BaseModel):
    email_enabled: bool = True
    deadline_3d: bool = True
    deadline_1d: bool = True
    aptitude_3d: bool = True
    aptitude_1d: bool = True
    interview_1d: bool = True
    interview_1h: bool = True
    intern_start_1d: bool = True
    intern_start_1h: bool = True
    briefing_1d: bool = True
    briefing_1h: bool = True
    submission_3d: bool = True
    submission_1d: bool = True
    offer_3d: bool = True
    offer_1d: bool = True


class PrefsResponse(BaseModel):
    email: str | None
    prefs: NotificationPrefs
    provider: str = ""
    configured: bool = False


class PrefsUpdate(BaseModel):
    email: EmailStr | None = Field(default=None)
    prefs: NotificationPrefs | None = None


@router.get("/prefs", response_model=PrefsResponse)
def get_prefs(user: User = Depends(get_current_user)):
    try:
        data = json.loads(user.notification_prefs or "{}")
    except Exception:
        data = {}
    return PrefsResponse(
        email=user.email,
        prefs=NotificationPrefs(**data),
        provider=provider_name(),
        configured=mail_is_configured(),
    )


@router.patch("/prefs", response_model=PrefsResponse)
def update_prefs(
    payload: PrefsUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.email is not None:
        user.email = str(payload.email) if payload.email else None
    if payload.prefs is not None:
        user.notification_prefs = json.dumps(payload.prefs.model_dump())
    session.add(user)
    session.commit()
    session.refresh(user)
    # Recompute reminders since prefs affect which ones are scheduled
    regenerate_for_user(session, user)
    return PrefsResponse(
        email=user.email,
        prefs=NotificationPrefs(**json.loads(user.notification_prefs)),
        provider=provider_name(),
        configured=mail_is_configured(),
    )


@router.post("/test")
async def test_send(user: User = Depends(get_current_user)):
    if not user.email:
        raise HTTPException(status_code=400, detail="メールアドレスが未設定です")
    if not mail_is_configured():
        raise HTTPException(
            status_code=503,
            detail="メール送信が未設定です（管理者にご連絡ください）",
        )
    ok = await send_test_email(user)
    if not ok:
        raise HTTPException(status_code=502, detail="送信に失敗しました")
    return {"ok": True, "to": user.email}


@router.post("/regenerate")
def regenerate(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    n = regenerate_for_user(session, user)
    return {"ok": True, "reminders": n}


# ---- Cron tick (secured by header) ----
cron_router = APIRouter(prefix="/api/cron", tags=["cron"])


@cron_router.post("/tick")
async def cron_tick(
    session: Session = Depends(get_session),
    x_cron_secret: str | None = Header(default=None, alias="X-Cron-Secret"),
):
    if x_cron_secret != settings.cron_secret:
        raise HTTPException(status_code=401, detail="unauthorized")

    # Regenerate reminders only for users that actually have email — others
    # would have nothing to dispatch anyway, so the work is wasted.
    users = session.exec(select(User).where(User.email.is_not(None))).all()  # type: ignore[union-attr]
    for u in users:
        regenerate_for_user(session, u)

    emailed = await dispatch_due_reminders(session)
    return {
        "ok": True,
        "emailed_users": emailed,
        "ran_at": datetime.now(timezone.utc).isoformat(),
    }
