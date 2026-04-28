from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import Company, Selection, SelectionStep, Submission, User
from ..reminder_service import regenerate_for_user
from ..schemas import (
    SelectionCreate,
    SelectionOut,
    SelectionStepCreate,
    SelectionStepOut,
    SelectionStepUpdate,
    SelectionUpdate,
    SubmissionCreate,
    SubmissionOut,
    SubmissionUpdate,
)


router = APIRouter(prefix="/api/selections", tags=["selections"])


def _owned_company(session: Session, user: User, company_id: int) -> Company:
    c = session.get(Company, company_id)
    if c is None or c.user_id != user.id:
        raise HTTPException(status_code=404, detail="企業が見つかりません")
    return c


def _owned(session: Session, user: User, selection_id: int) -> Selection:
    s = session.get(Selection, selection_id)
    if s is None or s.user_id != user.id:
        raise HTTPException(status_code=404, detail="選考が見つかりません")
    return s


def _to_selection_out(session: Session, s: Selection) -> SelectionOut:
    steps = session.exec(
        select(SelectionStep)
        .where(SelectionStep.selection_id == s.id)
        .order_by(SelectionStep.order_index, SelectionStep.id)
    ).all()
    subs = session.exec(
        select(Submission).where(Submission.selection_id == s.id)
    ).all()
    out = SelectionOut.model_validate(s)
    out.steps = [SelectionStepOut.model_validate(st) for st in steps]
    out.submissions = [SubmissionOut.model_validate(sub) for sub in subs]
    return out


# ---------- Selection CRUD ----------
@router.get("", response_model=List[SelectionOut])
def list_selections(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(
        select(Selection)
        .where(Selection.user_id == user.id)
        .order_by(Selection.sort_order.asc(), Selection.created_at.desc())
    ).all()
    if not rows:
        return []

    sel_ids = [r.id for r in rows if r.id is not None]
    steps_by_parent: dict[int, list[SelectionStep]] = {sid: [] for sid in sel_ids}
    for st in session.exec(
        select(SelectionStep)
        .where(SelectionStep.selection_id.in_(sel_ids))  # type: ignore[attr-defined]
        .order_by(SelectionStep.order_index, SelectionStep.id)
    ).all():
        steps_by_parent.setdefault(st.selection_id, []).append(st)

    subs_by_parent: dict[int, list[Submission]] = {sid: [] for sid in sel_ids}
    for sub in session.exec(
        select(Submission).where(Submission.selection_id.in_(sel_ids))  # type: ignore[attr-defined]
    ).all():
        subs_by_parent.setdefault(sub.selection_id, []).append(sub)

    out_list: list[SelectionOut] = []
    for r in rows:
        out = SelectionOut.model_validate(r)
        out.steps = [SelectionStepOut.model_validate(x) for x in steps_by_parent.get(r.id or 0, [])]
        out.submissions = [SubmissionOut.model_validate(x) for x in subs_by_parent.get(r.id or 0, [])]
        out_list.append(out)
    return out_list


@router.post("/reorder")
def reorder_selections(
    ids: List[int] = Body(..., embed=True),
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    rows = session.exec(select(Selection).where(Selection.user_id == user.id)).all()
    by_id = {x.id: x for x in rows}
    now = datetime.now(timezone.utc)
    for idx, sid in enumerate(ids):
        x = by_id.get(sid)
        if x is None:
            continue
        x.sort_order = idx
        x.updated_at = now
        session.add(x)
    session.commit()
    return {"ok": True}


@router.post("", response_model=SelectionOut)
def create_selection(
    payload: SelectionCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned_company(session, user, payload.company_id)
    s = Selection(user_id=user.id, **payload.model_dump())
    session.add(s)
    session.commit()
    session.refresh(s)
    out = _to_selection_out(session, s)
    regenerate_for_user(session, user)
    return out


@router.get("/{selection_id}", response_model=SelectionOut)
def get_selection(
    selection_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    s = _owned(session, user, selection_id)
    return _to_selection_out(session, s)


@router.patch("/{selection_id}", response_model=SelectionOut)
def update_selection(
    selection_id: int,
    payload: SelectionUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    s = _owned(session, user, selection_id)
    data = payload.model_dump(exclude_unset=True)
    if "company_id" in data:
        _owned_company(session, user, data["company_id"])
    for k, v in data.items():
        setattr(s, k, v)
    s.updated_at = datetime.now(timezone.utc)
    session.add(s)
    session.commit()
    session.refresh(s)
    out = _to_selection_out(session, s)
    regenerate_for_user(session, user)
    return out


@router.delete("/{selection_id}")
def delete_selection(
    selection_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    s = _owned(session, user, selection_id)
    steps = session.exec(select(SelectionStep).where(SelectionStep.selection_id == s.id)).all()
    for st in steps:
        session.delete(st)
    subs = session.exec(select(Submission).where(Submission.selection_id == s.id)).all()
    for sub in subs:
        session.delete(sub)
    session.delete(s)
    session.commit()
    regenerate_for_user(session, user)
    return {"ok": True}


# ---------- Selection Steps ----------
@router.post("/{selection_id}/steps", response_model=SelectionStepOut)
def add_step(
    selection_id: int,
    payload: SelectionStepCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, selection_id)
    st = SelectionStep(selection_id=selection_id, **payload.model_dump())
    session.add(st)
    session.commit()
    session.refresh(st)
    out = SelectionStepOut.model_validate(st)
    regenerate_for_user(session, user)
    return out


@router.patch("/{selection_id}/steps/{step_id}", response_model=SelectionStepOut)
def update_step(
    selection_id: int,
    step_id: int,
    payload: SelectionStepUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, selection_id)
    st = session.get(SelectionStep, step_id)
    if st is None or st.selection_id != selection_id:
        raise HTTPException(status_code=404, detail="ステップが見つかりません")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(st, k, v)
    st.updated_at = datetime.now(timezone.utc)
    session.add(st)
    session.commit()
    session.refresh(st)
    out = SelectionStepOut.model_validate(st)
    regenerate_for_user(session, user)
    return out


@router.delete("/{selection_id}/steps/{step_id}")
def delete_step(
    selection_id: int,
    step_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, selection_id)
    st = session.get(SelectionStep, step_id)
    if st is None or st.selection_id != selection_id:
        raise HTTPException(status_code=404, detail="ステップが見つかりません")
    session.delete(st)
    session.commit()
    regenerate_for_user(session, user)
    return {"ok": True}


# ---------- Submissions ----------
@router.post("/{selection_id}/submissions", response_model=SubmissionOut)
def add_submission(
    selection_id: int,
    payload: SubmissionCreate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, selection_id)
    sub = Submission(selection_id=selection_id, **payload.model_dump())
    session.add(sub)
    session.commit()
    session.refresh(sub)
    out = SubmissionOut.model_validate(sub)
    regenerate_for_user(session, user)
    return out


@router.patch("/{selection_id}/submissions/{submission_id}", response_model=SubmissionOut)
def update_submission(
    selection_id: int,
    submission_id: int,
    payload: SubmissionUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, selection_id)
    sub = session.get(Submission, submission_id)
    if sub is None or sub.selection_id != selection_id:
        raise HTTPException(status_code=404, detail="提出物が見つかりません")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(sub, k, v)
    session.add(sub)
    session.commit()
    session.refresh(sub)
    out = SubmissionOut.model_validate(sub)
    regenerate_for_user(session, user)
    return out


@router.delete("/{selection_id}/submissions/{submission_id}")
def delete_submission(
    selection_id: int,
    submission_id: int,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    _owned(session, user, selection_id)
    sub = session.get(Submission, submission_id)
    if sub is None or sub.selection_id != selection_id:
        raise HTTPException(status_code=404, detail="提出物が見つかりません")
    session.delete(sub)
    session.commit()
    regenerate_for_user(session, user)
    return {"ok": True}
