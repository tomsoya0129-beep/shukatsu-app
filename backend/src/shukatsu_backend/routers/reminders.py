from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Reminder, User
from ..schemas import ReminderCreate, ReminderOut


router = APIRouter(prefix="/api/reminders", tags=["reminders"])


@router.get("", response_model=List[ReminderOut])
def list_reminders(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Reminder).where(Reminder.user_id == user.id).order_by(Reminder.remind_at)
    ).all()
    return [ReminderOut.model_validate(r) for r in rows]


@router.get("/due", response_model=List[ReminderOut])
def due_reminders(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    """Reminders whose remind_at is in the past 24h and not yet marked sent."""
    now = datetime.now(timezone.utc)
    rows = session.exec(
        select(Reminder)
        .where(Reminder.user_id == user.id)
        .where(Reminder.sent == False)  # noqa: E712
        .where(Reminder.remind_at <= now)
        .order_by(Reminder.remind_at)
    ).all()
    return [ReminderOut.model_validate(r) for r in rows]


@router.post("", response_model=ReminderOut)
def create_reminder(
    payload: ReminderCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    r = Reminder(user_id=user.id, **payload.model_dump())
    session.add(r)
    session.commit()
    session.refresh(r)
    return ReminderOut.model_validate(r)


@router.post("/{reminder_id}/mark_sent", response_model=ReminderOut)
def mark_sent(
    reminder_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    r = session.get(Reminder, reminder_id)
    if r is None or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="リマインダーが見つかりません")
    r.sent = True
    session.add(r)
    session.commit()
    session.refresh(r)
    return ReminderOut.model_validate(r)


@router.delete("/{reminder_id}")
def delete_reminder(
    reminder_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    r = session.get(Reminder, reminder_id)
    if r is None or r.user_id != user.id:
        raise HTTPException(status_code=404, detail="リマインダーが見つかりません")
    session.delete(r)
    session.commit()
    return {"ok": True}
