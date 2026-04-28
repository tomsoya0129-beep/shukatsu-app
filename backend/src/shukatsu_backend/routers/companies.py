from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Company, User
from ..schemas import CompanyCreate, CompanyOut, CompanyUpdate


router = APIRouter(prefix="/api/companies", tags=["companies"])


def _owned(session: Session, user: User, company_id: int) -> Company:
    company = session.get(Company, company_id)
    if company is None or company.user_id != user.id:
        raise HTTPException(status_code=404, detail="企業が見つかりません")
    return company


@router.get("", response_model=List[CompanyOut])
def list_companies(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Company)
        .where(Company.user_id == user.id)
        .order_by(Company.sort_order.asc(), Company.created_at.desc())
    ).all()
    return [CompanyOut.model_validate(c) for c in rows]


@router.post("/reorder")
def reorder_companies(
    ids: List[int] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(select(Company).where(Company.user_id == user.id)).all()
    by_id = {c.id: c for c in rows}
    now = datetime.now(timezone.utc)
    for idx, cid in enumerate(ids):
        c = by_id.get(cid)
        if c is None:
            continue
        c.sort_order = idx
        c.updated_at = now
        session.add(c)
    session.commit()
    return {"ok": True}


@router.post("", response_model=CompanyOut)
def create_company(
    payload: CompanyCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    company = Company(user_id=user.id, **payload.model_dump())
    session.add(company)
    session.commit()
    session.refresh(company)
    return CompanyOut.model_validate(company)


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    c = _owned(session, user, company_id)
    return CompanyOut.model_validate(c)


@router.patch("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    c = _owned(session, user, company_id)
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    c.updated_at = datetime.now(timezone.utc)
    session.add(c)
    session.commit()
    session.refresh(c)
    return CompanyOut.model_validate(c)


@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    from ..models import (
        Internship,
        InternshipSession,
        InternshipStep,
        Reminder,
        Selection,
        SelectionStep,
        Submission,
    )
    from ..reminder_service import regenerate_for_user

    c = _owned(session, user, company_id)

    # Cascade delete: internships and their steps/sessions, plus orphaned reminders.
    interns = session.exec(
        select(Internship).where(Internship.company_id == company_id)
    ).all()
    intern_ids = [i.id for i in interns if i.id is not None]
    if intern_ids:
        i_steps = session.exec(
            select(InternshipStep).where(InternshipStep.internship_id.in_(intern_ids))  # type: ignore[attr-defined]
        ).all()
        for st in i_steps:
            session.delete(st)
        i_sess = session.exec(
            select(InternshipSession).where(
                InternshipSession.internship_id.in_(intern_ids)  # type: ignore[attr-defined]
            )
        ).all()
        for s in i_sess:
            session.delete(s)
    for i in interns:
        session.delete(i)

    # Cascade delete: selections and their steps/submissions.
    selections = session.exec(
        select(Selection).where(Selection.company_id == company_id)
    ).all()
    sel_ids = [s.id for s in selections if s.id is not None]
    if sel_ids:
        s_steps = session.exec(
            select(SelectionStep).where(SelectionStep.selection_id.in_(sel_ids))  # type: ignore[attr-defined]
        ).all()
        for st in s_steps:
            session.delete(st)
        s_subs = session.exec(
            select(Submission).where(Submission.selection_id.in_(sel_ids))  # type: ignore[attr-defined]
        ).all()
        for sub in s_subs:
            session.delete(sub)
    for s in selections:
        session.delete(s)

    # Drop orphaned reminders that pointed at the deleted entities.
    if intern_ids:
        for r in session.exec(
            select(Reminder).where(
                Reminder.user_id == user.id,
                Reminder.ref_type.in_(("internship", "internship_step", "internship_session")),  # type: ignore[attr-defined]
            )
        ).all():
            session.delete(r)
    if sel_ids:
        for r in session.exec(
            select(Reminder).where(
                Reminder.user_id == user.id,
                Reminder.ref_type.in_(("selection", "selection_step", "submission")),  # type: ignore[attr-defined]
            )
        ).all():
            session.delete(r)

    session.delete(c)
    session.commit()
    # Recompute reminders so anything still valid is recreated cleanly.
    regenerate_for_user(session, user)
    return {"ok": True}
