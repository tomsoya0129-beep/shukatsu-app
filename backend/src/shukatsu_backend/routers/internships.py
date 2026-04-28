from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Company, Internship, InternshipSession, InternshipStep, User
from ..reminder_service import regenerate_for_user
from ..schemas import (
    InternshipCreate,
    InternshipOut,
    InternshipSessionCreate,
    InternshipSessionOut,
    InternshipSessionUpdate,
    InternshipStepCreate,
    InternshipStepOut,
    InternshipStepUpdate,
    InternshipUpdate,
)


router = APIRouter(prefix="/api/internships", tags=["internships"])


def _owned_company(session: Session, user: User, company_id: int) -> Company:
    c = session.get(Company, company_id)
    if c is None or c.user_id != user.id:
        raise HTTPException(status_code=404, detail="企業が見つかりません")
    return c


def _owned(session: Session, user: User, internship_id: int) -> Internship:
    i = session.get(Internship, internship_id)
    if i is None or i.user_id != user.id:
        raise HTTPException(status_code=404, detail="インターン情報が見つかりません")
    return i


def _to_internship_out(session: Session, i: Internship) -> InternshipOut:
    steps = session.exec(
        select(InternshipStep)
        .where(InternshipStep.internship_id == i.id)
        .order_by(InternshipStep.order_index, InternshipStep.id)
    ).all()
    sessions_ = session.exec(
        select(InternshipSession)
        .where(InternshipSession.internship_id == i.id)
        .order_by(InternshipSession.order_index, InternshipSession.id)
    ).all()
    out = InternshipOut.model_validate(i)
    out.steps = [InternshipStepOut.model_validate(st) for st in steps]
    out.sessions = [InternshipSessionOut.model_validate(s) for s in sessions_]
    return out


@router.get("", response_model=List[InternshipOut])
def list_internships(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Internship)
        .where(Internship.user_id == user.id)
        .order_by(Internship.sort_order.asc(), Internship.created_at.desc())
    ).all()
    if not rows:
        return []

    # Bulk-load children once and group by parent id (avoids N+1 queries).
    intern_ids = [r.id for r in rows if r.id is not None]
    steps_by_parent: dict[int, list[InternshipStep]] = {iid: [] for iid in intern_ids}
    for st in session.exec(
        select(InternshipStep)
        .where(InternshipStep.internship_id.in_(intern_ids))  # type: ignore[attr-defined]
        .order_by(InternshipStep.order_index, InternshipStep.id)
    ).all():
        steps_by_parent.setdefault(st.internship_id, []).append(st)

    sessions_by_parent: dict[int, list[InternshipSession]] = {iid: [] for iid in intern_ids}
    for s in session.exec(
        select(InternshipSession)
        .where(InternshipSession.internship_id.in_(intern_ids))  # type: ignore[attr-defined]
        .order_by(InternshipSession.order_index, InternshipSession.id)
    ).all():
        sessions_by_parent.setdefault(s.internship_id, []).append(s)

    out_list: list[InternshipOut] = []
    for r in rows:
        out = InternshipOut.model_validate(r)
        out.steps = [InternshipStepOut.model_validate(x) for x in steps_by_parent.get(r.id or 0, [])]
        out.sessions = [InternshipSessionOut.model_validate(x) for x in sessions_by_parent.get(r.id or 0, [])]
        out_list.append(out)
    return out_list


@router.post("/reorder")
def reorder_internships(
    ids: List[int] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(select(Internship).where(Internship.user_id == user.id)).all()
    by_id = {x.id: x for x in rows}
    now = datetime.now(timezone.utc)
    for idx, iid in enumerate(ids):
        x = by_id.get(iid)
        if x is None:
            continue
        x.sort_order = idx
        x.updated_at = now
        session.add(x)
    session.commit()
    return {"ok": True}


@router.post("", response_model=InternshipOut)
def create_internship(
    payload: InternshipCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned_company(session, user, payload.company_id)
    i = Internship(user_id=user.id, **payload.model_dump())
    session.add(i)
    session.commit()
    session.refresh(i)
    out = _to_internship_out(session, i)
    regenerate_for_user(session, user)
    return out


@router.get("/{internship_id}", response_model=InternshipOut)
def get_internship(
    internship_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    i = _owned(session, user, internship_id)
    return _to_internship_out(session, i)


@router.patch("/{internship_id}", response_model=InternshipOut)
def update_internship(
    internship_id: int,
    payload: InternshipUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    i = _owned(session, user, internship_id)
    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data:
        _owned_company(session, user, data["company_id"])
    for k, v in data.items():
        setattr(i, k, v)
    i.updated_at = datetime.now(timezone.utc)
    session.add(i)
    session.commit()
    session.refresh(i)
    out = _to_internship_out(session, i)
    regenerate_for_user(session, user)
    return out


@router.delete("/{internship_id}")
def delete_internship(
    internship_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    i = _owned(session, user, internship_id)
    steps = session.exec(
        select(InternshipStep).where(InternshipStep.internship_id == i.id)
    ).all()
    for st in steps:
        session.delete(st)
    sessions_ = session.exec(
        select(InternshipSession).where(InternshipSession.internship_id == i.id)
    ).all()
    for s in sessions_:
        session.delete(s)
    session.delete(i)
    session.commit()
    regenerate_for_user(session, user)
    return {"ok": True}


# ---------- Internship Steps ----------
@router.post("/{internship_id}/steps", response_model=InternshipStepOut)
def add_step(
    internship_id: int,
    payload: InternshipStepCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, internship_id)
    st = InternshipStep(internship_id=internship_id, **payload.model_dump())
    session.add(st)
    session.commit()
    session.refresh(st)
    out = InternshipStepOut.model_validate(st)
    regenerate_for_user(session, user)
    return out


@router.patch("/{internship_id}/steps/{step_id}", response_model=InternshipStepOut)
def update_step(
    internship_id: int,
    step_id: int,
    payload: InternshipStepUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, internship_id)
    st = session.get(InternshipStep, step_id)
    if st is None or st.internship_id != internship_id:
        raise HTTPException(status_code=404, detail="ステップが見つかりません")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(st, k, v)
    st.updated_at = datetime.now(timezone.utc)
    session.add(st)
    session.commit()
    session.refresh(st)
    out = InternshipStepOut.model_validate(st)
    regenerate_for_user(session, user)
    return out


@router.delete("/{internship_id}/steps/{step_id}")
def delete_step(
    internship_id: int,
    step_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, internship_id)
    st = session.get(InternshipStep, step_id)
    if st is None or st.internship_id != internship_id:
        raise HTTPException(status_code=404, detail="ステップが見つかりません")
    session.delete(st)
    session.commit()
    regenerate_for_user(session, user)
    return {"ok": True}


# ---------- Internship Sessions (複数日程) ----------
@router.post("/{internship_id}/sessions", response_model=InternshipSessionOut)
def add_session(
    internship_id: int,
    payload: InternshipSessionCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, internship_id)
    s = InternshipSession(internship_id=internship_id, **payload.model_dump())
    session.add(s)
    session.commit()
    session.refresh(s)
    out = InternshipSessionOut.model_validate(s)
    regenerate_for_user(session, user)
    return out


@router.patch("/{internship_id}/sessions/{session_id}", response_model=InternshipSessionOut)
def update_internship_session(
    internship_id: int,
    session_id: int,
    payload: InternshipSessionUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, internship_id)
    s = session.get(InternshipSession, session_id)
    if s is None or s.internship_id != internship_id:
        raise HTTPException(status_code=404, detail="日程が見つかりません")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(s, k, v)
    s.updated_at = datetime.now(timezone.utc)
    session.add(s)
    session.commit()
    session.refresh(s)
    out = InternshipSessionOut.model_validate(s)
    regenerate_for_user(session, user)
    return out


@router.delete("/{internship_id}/sessions/{session_id}")
def delete_internship_session(
    internship_id: int,
    session_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, internship_id)
    s = session.get(InternshipSession, session_id)
    if s is None or s.internship_id != internship_id:
        raise HTTPException(status_code=404, detail="日程が見つかりません")
    session.delete(s)
    session.commit()
    regenerate_for_user(session, user)
    return {"ok": True}
