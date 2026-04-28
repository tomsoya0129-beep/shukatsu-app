from datetime import timedelta
from typing import Dict, List

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import get_current_user
from ..database import get_session
from ..models import (
    Company,
    Internship,
    InternshipSession,
    InternshipStep,
    Selection,
    SelectionStep,
    User,
)
from ..schemas import CalendarEvent, DashboardSummary


router = APIRouter(prefix="/api", tags=["calendar"])


STEP_TYPE_LABELS_JA = {
    "briefing": "説明会",
    "es": "エントリーシート",
    "aptitude": "適性テスト",
    "gd": "グループディスカッション",
    "interview_1": "一次面接",
    "interview_2": "二次面接",
    "interview_3": "三次面接",
    "interview_final": "最終面接",
    "other": "その他",
}


def _step_label(step_type: str, label: str | None) -> str:
    if label:
        return label
    return STEP_TYPE_LABELS_JA.get(step_type, step_type)


def _company_color_map(session: Session, user: User) -> Dict[int, Company]:
    rows = session.exec(select(Company).where(Company.user_id == user.id)).all()
    return {c.id: c for c in rows if c.id is not None}


def _build_events(session: Session, user: User) -> List[CalendarEvent]:
    companies = _company_color_map(session, user)
    events: List[CalendarEvent] = []

    interns = session.exec(select(Internship).where(Internship.user_id == user.id)).all()
    intern_ids = [i.id for i in interns if i.id is not None]

    # Bulk-load children once (avoids N+1).
    intern_sessions_by_parent: Dict[int, list] = {iid: [] for iid in intern_ids}
    intern_steps_by_parent: Dict[int, list] = {iid: [] for iid in intern_ids}
    if intern_ids:
        for sess in session.exec(
            select(InternshipSession).where(
                InternshipSession.internship_id.in_(intern_ids)  # type: ignore[attr-defined]
            )
        ).all():
            intern_sessions_by_parent.setdefault(sess.internship_id, []).append(sess)
        for st in session.exec(
            select(InternshipStep).where(
                InternshipStep.internship_id.in_(intern_ids)  # type: ignore[attr-defined]
            )
        ).all():
            intern_steps_by_parent.setdefault(st.internship_id, []).append(st)

    for i in interns:
        # Hide events for internships that were rejected
        if i.status == "rejected":
            continue
        c = companies.get(i.company_id)
        color = c.color if c else "#64748b"
        cname = c.name if c else "?"
        if i.start_date:
            end = i.end_date or i.start_date
            time_parts = []
            if i.start_time:
                time_parts.append(i.start_time)
            if i.end_time:
                time_parts.append(i.end_time)
            time_suffix = f" ({'〜'.join(time_parts)})" if time_parts else ""
            events.append(CalendarEvent(
                id=f"intern-period-{i.id}",
                title=f"{cname} {i.title or 'インターン'}{time_suffix}",
                start=i.start_date,
                end=end + timedelta(days=1),  # fullcalendar end is exclusive
                color=color,
                kind="intern_period",
                company_id=i.company_id,
                ref_id=i.id or 0,
                extra={
                    "mode": i.mode,
                    "internship_id": i.id,
                    "start_time": i.start_time,
                    "end_time": i.end_time,
                    "online_url": i.online_url,
                    "meeting_code": i.meeting_code,
                    "meeting_password": i.meeting_password,
                },
            ))

        i_sessions = intern_sessions_by_parent.get(i.id or 0, [])
        for sess in i_sessions:
            if not sess.start_date:
                continue
            sess_end = sess.end_date or sess.start_date
            time_parts = []
            if sess.start_time:
                time_parts.append(sess.start_time)
            if sess.end_time:
                time_parts.append(sess.end_time)
            time_suffix = f" ({'〜'.join(time_parts)})" if time_parts else ""
            sess_label = sess.label or i.title or "インターン"
            events.append(CalendarEvent(
                id=f"intern-sess-{sess.id}",
                title=f"{cname} {sess_label}{time_suffix}",
                start=sess.start_date,
                end=sess_end + timedelta(days=1),
                color=color,
                kind="intern_period",
                company_id=i.company_id,
                ref_id=sess.id or 0,
                extra={
                    "mode": sess.mode or i.mode,
                    "internship_id": i.id,
                    "session_id": sess.id,
                    "start_time": sess.start_time,
                    "end_time": sess.end_time,
                    "online_url": sess.online_url,
                    "location": sess.location,
                    "meeting_code": sess.meeting_code,
                    "meeting_password": sess.meeting_password,
                },
            ))

        i_steps = intern_steps_by_parent.get(i.id or 0, [])
        for st in i_steps:
            if not st.scheduled_date:
                continue
            # Hide failed steps
            if st.result == "failed":
                continue
            is_es_or_apt = st.step_type in ("es", "aptitude")
            ts = f" {st.scheduled_time}" if st.scheduled_time else ""
            # 説明会・セミナーは「インターン選考」のプレフィックスを付けない
            prefix = "" if st.step_type == "briefing" else "(インターン選考) "
            label_text = _step_label(st.step_type, st.label)
            extra = {
                "internship_id": i.id,
                "step_type": st.step_type,
                "time": st.scheduled_time,
                "mode": st.mode,
                "result": st.result,
                "online_url": st.online_url,
                "location": st.location,
                "meeting_code": st.meeting_code,
                "meeting_password": st.meeting_password,
            }
            if is_es_or_apt and st.start_date:
                # 期間イベントとして表示
                extra["start_time"] = st.start_time
                extra["end_time"] = st.scheduled_time
                events.append(CalendarEvent(
                    id=f"istep-{st.id}",
                    title=f"{cname} {prefix}{label_text}",
                    start=st.start_date,
                    end=st.scheduled_date + timedelta(days=1),
                    color=color,
                    kind="step",
                    company_id=i.company_id,
                    ref_id=st.id or 0,
                    extra=extra,
                ))
            else:
                deadline_prefix = "【締切】" if is_es_or_apt else ""
                events.append(CalendarEvent(
                    id=f"istep-{st.id}",
                    title=f"{deadline_prefix}{cname} {prefix}{label_text}{ts}",
                    start=st.scheduled_date,
                    color=color,
                    kind="step",
                    company_id=i.company_id,
                    ref_id=st.id or 0,
                    extra=extra,
                ))

    selections = session.exec(select(Selection).where(Selection.user_id == user.id)).all()
    sel_ids = [s.id for s in selections if s.id is not None]
    sel_steps_by_parent: Dict[int, list] = {sid: [] for sid in sel_ids}
    if sel_ids:
        for st in session.exec(
            select(SelectionStep).where(
                SelectionStep.selection_id.in_(sel_ids)  # type: ignore[attr-defined]
            )
        ).all():
            sel_steps_by_parent.setdefault(st.selection_id, []).append(st)

    for s in selections:
        # Hide events for selections that were rejected/withdrawn/declined
        if s.overall_status in ("rejected", "withdrawn", "declined"):
            continue
        c = companies.get(s.company_id)
        color = c.color if c else "#64748b"
        cname = c.name if c else "?"
        if s.result_announcement_date:
            events.append(CalendarEvent(
                id=f"sel-result-{s.id}",
                title=f"【結果発表】{cname}",
                start=s.result_announcement_date,
                color=color,
                kind="result",
                company_id=s.company_id,
                ref_id=s.id or 0,
                extra={"selection_id": s.id},
            ))
        if s.offer_deadline:
            events.append(CalendarEvent(
                id=f"sel-offer-{s.id}",
                title=f"【内定承諾期限】{cname}",
                start=s.offer_deadline,
                color=color,
                kind="offer_deadline",
                company_id=s.company_id,
                ref_id=s.id or 0,
                extra={"selection_id": s.id},
            ))

        steps = sel_steps_by_parent.get(s.id or 0, [])
        for st in steps:
            if st.result == "failed":
                continue
            if not st.scheduled_date:
                continue
            is_es_or_apt = st.step_type in ("es", "aptitude")
            label_text = _step_label(st.step_type, st.label)
            extra = {
                "selection_id": s.id,
                "step_type": st.step_type,
                "time": st.scheduled_time,
                "mode": st.mode,
                "result": st.result,
                "online_url": st.online_url,
                "location": st.location,
                "meeting_code": st.meeting_code,
                "meeting_password": st.meeting_password,
            }
            if is_es_or_apt and st.start_date:
                extra["start_time"] = st.start_time
                extra["end_time"] = st.scheduled_time
                events.append(CalendarEvent(
                    id=f"step-{st.id}",
                    title=f"{cname} {label_text}",
                    start=st.start_date,
                    end=st.scheduled_date + timedelta(days=1),
                    color=color,
                    kind="step",
                    company_id=s.company_id,
                    ref_id=st.id or 0,
                    extra=extra,
                ))
            else:
                deadline_prefix = "【締切】" if is_es_or_apt else ""
                events.append(CalendarEvent(
                    id=f"step-{st.id}",
                    title=f"{deadline_prefix}{cname} {label_text}",
                    start=st.scheduled_date,
                    color=color,
                    kind="step",
                    company_id=s.company_id,
                    ref_id=st.id or 0,
                    extra=extra,
                ))
    return events


@router.get("/calendar/events", response_model=List[CalendarEvent])
def calendar_events(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    return _build_events(session, user)


@router.get("/dashboard", response_model=DashboardSummary)
def dashboard(
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    events = _build_events(session, user)

    # Use JST for "today" so the dashboard's 7-day window matches what the
    # user expects regardless of server timezone (Fly.io machines run in UTC).
    from datetime import datetime, timezone
    JST = timezone(timedelta(hours=9))
    today = datetime.now(JST).date()
    week_later = today + timedelta(days=7)
    upcoming = sorted(
        [e for e in events if e.start and today <= e.start <= week_later],
        key=lambda e: e.start,
    )

    selections = session.exec(select(Selection).where(Selection.user_id == user.id)).all()
    active_selections = sum(1 for s in selections if s.overall_status == "in_progress")
    offers = sum(1 for s in selections if s.overall_status in ("offer", "accepted"))

    # Count via SQL aggregates rather than loading all rows just to len() them.
    from sqlalchemy import func  # local import keeps top-level minimal
    total_companies = session.exec(
        select(func.count(Company.id)).where(Company.user_id == user.id)
    ).one()
    interns = session.exec(
        select(Internship).where(Internship.user_id == user.id)
    ).all()
    # 「本選考中」は本選考 (Selection) で overall_status=in_progress の件数のみ。
    # インターン選考は別カウント（total_internships）で表示される。
    return DashboardSummary(
        active_selections=active_selections,
        offers=offers,
        upcoming_events=upcoming,
        total_companies=int(total_companies or 0),
        total_internships=len(interns),
    )
