"""Auto-generate reminders based on events and dispatch due ones."""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlmodel import Session, select

from .config import settings
from .emails import render_reminder_email, send_email
from .models import (
    Company,
    Internship,
    InternshipSession,
    InternshipStep,
    Reminder,
    Selection,
    SelectionStep,
    Submission,
    User,
)

log = logging.getLogger(__name__)

JST = ZoneInfo("Asia/Tokyo")

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


def _step_label(step_type: str, label: Optional[str]) -> str:
    if label:
        return label
    return STEP_TYPE_LABELS_JA.get(step_type, step_type)

# Morning send time (7:00 JST)
SEND_HOUR_JST = 7


def _user_prefs(user: User) -> dict:
    try:
        return json.loads(user.notification_prefs or "{}")
    except Exception:
        return {}


def _morning_jst_utc(target_date: date) -> datetime:
    """Return the UTC datetime for 7:00 JST on `target_date`."""
    return datetime.combine(target_date, time(SEND_HOUR_JST, 0), tzinfo=JST).astimezone(
        timezone.utc
    )


def _parse_hhmm(s: Optional[str]) -> Optional[time]:
    if not s:
        return None
    try:
        parts = s.split(":")
        return time(int(parts[0]), int(parts[1]))
    except Exception:
        return None


def _one_hour_before_utc(target_date: date, hhmm: Optional[str]) -> Optional[datetime]:
    """Return the UTC datetime for 1 hour before (target_date hhmm JST).

    Returns None if hhmm is missing/unparseable.
    """
    t = _parse_hhmm(hhmm)
    if t is None:
        return None
    event_local = datetime.combine(target_date, t, tzinfo=JST)
    return (event_local - timedelta(hours=1)).astimezone(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    """SQLite returns naive datetimes; assume UTC when no tzinfo is set."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _make_reminder(
    user_id: int,
    ref_type: str,
    ref_id: int,
    sub_key: str,
    title: str,
    remind_at_utc: datetime,
) -> Reminder:
    """Build a Reminder row. sub_key is prefixed into the title as ``[sub_key] ``
    so that callers (e.g. the email renderer) can strip it to get the display title.
    """
    return Reminder(
        user_id=user_id,
        ref_type=ref_type,
        ref_id=ref_id,
        title=f"[{sub_key}] {title}",
        remind_at=remind_at_utc,
        channel="email",
        sent=False,
    )


def regenerate_for_user(session: Session, user: User) -> int:
    """Recompute all reminders for a user based on current data. Returns count created."""
    if not user.id:
        return 0

    prefs = _user_prefs(user)
    today = datetime.now(JST).date()
    count = 0

    companies = {
        c.id: c for c in session.exec(select(Company).where(Company.user_id == user.id)).all()
    }

    def cname(cid: int) -> str:
        c = companies.get(cid)
        return c.name if c else "?"

    # Index existing reminders by their identity (ref_type, ref_id, sub_key)
    # so we can preserve already-sent ones (avoid re-sending) while still
    # being able to update unsent ones whose schedule/title changed.
    existing_rows = session.exec(
        select(Reminder)
        .where(Reminder.user_id == user.id)
        .where(Reminder.channel == "email")
    ).all()

    def _identity(title: str) -> tuple[str, int, str] | None:
        # title is "[sub_key] ..." — extract sub_key.
        if not title.startswith("["):
            return None
        end = title.find("] ")
        if end < 0:
            return None
        return ("", 0, title[1:end])  # sub_key only; combined below with ref

    existing: dict[tuple[str, int, str], Reminder] = {}
    for r in existing_rows:
        ident = _identity(r.title or "")
        if ident is not None:
            existing[(r.ref_type, r.ref_id, ident[2])] = r

    # IDs we will keep at the end. Anything not in this set gets deleted at the bottom.
    keep_ids: set[int] = set()
    now_utc = datetime.now(timezone.utc)

    def _upsert_reminder(
        sub_key: str,
        ref_type: str,
        ref_id: int,
        title: str,
        remind_at: datetime,
    ) -> None:
        """Idempotently materialize a single reminder.

        - If a sent reminder exists at the same scheduled time -> keep as-is (no resend).
        - If a sent reminder exists at a DIFFERENT time -> the event was rescheduled,
          so create a fresh reminder for the new time (the old sent record is dropped).
        - If an unsent reminder exists -> update its time/title in place.
        - Otherwise -> insert a brand-new unsent reminder.
        """
        nonlocal count
        key = (ref_type, ref_id, sub_key)
        full_title = f"[{sub_key}] {title}"
        prev = existing.get(key)
        if prev is not None and prev.sent and _as_utc(prev.remind_at) == remind_at:
            # Already sent at the right time — leave it alone.
            keep_ids.add(prev.id or 0)
            return
        if prev is not None and not prev.sent:
            # Update in place; remains unsent and will be picked up by dispatch.
            prev.remind_at = remind_at
            prev.title = full_title
            session.add(prev)
            keep_ids.add(prev.id or 0)
            count += 1
            return
        # No usable existing row (sent-but-rescheduled or none). Insert fresh.
        session.add(
            _make_reminder(user.id, ref_type, ref_id, sub_key, title, remind_at)
        )
        count += 1

    def add_day(target: date, sub_key: str, ref_type: str, ref_id: int, title: str) -> None:
        """Add a reminder scheduled for 7:00 JST on target date.

        If the target morning is in the past but the EVENT itself is still upcoming
        (or within the last 24h), still create the reminder so it can be dispatched
        late (better-late-than-never; covers Fly machine downtime).
        """
        # Drop only when the morning slot is more than 36h in the past — by then
        # the event itself is past too and there's no point notifying.
        cutoff = today - timedelta(days=2)
        if target < cutoff:
            return
        _upsert_reminder(sub_key, ref_type, ref_id, title, _morning_jst_utc(target))

    def add_hour_before(
        event_date: date,
        event_time: Optional[str],
        sub_key: str,
        ref_type: str,
        ref_id: int,
        title: str,
    ) -> None:
        """Add a reminder 1 hour before the event datetime (requires time).

        Catch-up behaviour: if the 1h-before slot is already past, still create
        the reminder as long as the event itself is no more than 24h in the past.
        This way a brief downtime of the dispatcher doesn't drop the notification.
        """
        remind_at = _one_hour_before_utc(event_date, event_time)
        if remind_at is None:
            return
        # Compute event time itself (UTC) and skip only if event ended >24h ago.
        t = _parse_hhmm(event_time)
        if t is None:
            return
        event_utc = datetime.combine(event_date, t, tzinfo=JST).astimezone(timezone.utc)
        if event_utc < now_utc - timedelta(hours=24):
            return
        _upsert_reminder(sub_key, ref_type, ref_id, title, remind_at)

    # ---------------- Internships ----------------
    interns = session.exec(
        select(Internship).where(Internship.user_id == user.id)
    ).all()
    intern_ids = [i.id for i in interns if i.id is not None]
    isessions_by_parent: dict[int, list[InternshipSession]] = {iid: [] for iid in intern_ids}
    isteps_by_parent: dict[int, list[InternshipStep]] = {iid: [] for iid in intern_ids}
    if intern_ids:
        for sess in session.exec(
            select(InternshipSession).where(
                InternshipSession.internship_id.in_(intern_ids)  # type: ignore[attr-defined]
            )
        ).all():
            isessions_by_parent.setdefault(sess.internship_id, []).append(sess)
        for st in session.exec(
            select(InternshipStep).where(
                InternshipStep.internship_id.in_(intern_ids)  # type: ignore[attr-defined]
            )
        ).all():
            isteps_by_parent.setdefault(st.internship_id, []).append(st)

    for i in interns:
        # Internship start: 1d + 1h before
        if i.start_date:
            start_time_parts = []
            if i.start_time:
                start_time_parts.append(i.start_time)
            if i.end_time:
                start_time_parts.append(i.end_time)
            time_suffix = f" ({'〜'.join(start_time_parts)})" if start_time_parts else ""
            if prefs.get("intern_start_1d", prefs.get("interview_1d", True)):
                add_day(
                    i.start_date - timedelta(days=1),
                    "intern_start_1d",
                    "internship",
                    i.id or 0,
                    f"【明日開始】インターン: {cname(i.company_id)} {i.title or ''}{time_suffix}".strip(),
                )
            if prefs.get("intern_start_1h", True):
                add_hour_before(
                    i.start_date,
                    i.start_time,
                    "intern_start_1h",
                    "internship",
                    i.id or 0,
                    f"【1時間後開始】インターン: {cname(i.company_id)} {i.title or ''}{time_suffix}".strip(),
                )

        # Internship additional sessions (複数日程): 1d + 1h before
        i_sessions = isessions_by_parent.get(i.id or 0, [])
        for sess in i_sessions:
            if not sess.start_date:
                continue
            sess_time_parts = []
            if sess.start_time:
                sess_time_parts.append(sess.start_time)
            if sess.end_time:
                sess_time_parts.append(sess.end_time)
            sess_time_suffix = f" ({'〜'.join(sess_time_parts)})" if sess_time_parts else ""
            sess_label = sess.label or "日程"
            if prefs.get("intern_start_1d", prefs.get("interview_1d", True)):
                add_day(
                    sess.start_date - timedelta(days=1),
                    "intern_sess_1d",
                    "internship_session",
                    sess.id or 0,
                    f"【明日】インターン ({sess_label}): {cname(i.company_id)} {i.title or ''}{sess_time_suffix}".strip(),
                )
            if prefs.get("intern_start_1h", True):
                add_hour_before(
                    sess.start_date,
                    sess.start_time,
                    "intern_sess_1h",
                    "internship_session",
                    sess.id or 0,
                    f"【1時間後】インターン ({sess_label}): {cname(i.company_id)} {i.title or ''}{sess_time_suffix}".strip(),
                )

        # Internship steps: 1d + 1h before (split briefing vs interview)
        i_steps = isteps_by_parent.get(i.id or 0, [])
        for st in i_steps:
            if not st.scheduled_date:
                continue
            label = _step_label(st.step_type, st.label)
            is_briefing = st.step_type == "briefing"
            is_es_or_apt = st.step_type in ("es", "aptitude")
            pref_1d = "briefing_1d" if is_briefing else "interview_1d"
            pref_1h = "briefing_1h" if is_briefing else "interview_1h"
            time_suffix = f" {st.scheduled_time}" if st.scheduled_time else ""
            # 説明会・セミナーは「インターン選考」のプレフィックスを付けない
            prefix = "" if is_briefing else "(インターン選考) "
            deadline_marker = "【締切】" if is_es_or_apt else "【明日】"
            if prefs.get(pref_1d, True):
                add_day(
                    st.scheduled_date - timedelta(days=1),
                    "istep_1d",
                    "internship_step",
                    st.id or 0,
                    f"{deadline_marker}{cname(i.company_id)} {prefix}{label}{time_suffix}",
                )
            if prefs.get(pref_1h, True):
                add_hour_before(
                    st.scheduled_date,
                    st.scheduled_time,
                    "istep_1h",
                    "internship_step",
                    st.id or 0,
                    f"【1時間前】{cname(i.company_id)} {prefix}{label}{time_suffix}",
                )
            # ES/適性 期間モード：開始日も通知
            if is_es_or_apt and st.start_date:
                start_time_suffix = f" {st.start_time}" if st.start_time else ""
                if prefs.get(pref_1d, True):
                    add_day(
                        st.start_date - timedelta(days=1),
                        "istep_start_1d",
                        "internship_step",
                        st.id or 0,
                        f"【開始明日】{cname(i.company_id)} {prefix}{label}{start_time_suffix}",
                    )
                if prefs.get(pref_1h, True):
                    add_hour_before(
                        st.start_date,
                        st.start_time,
                        "istep_start_1h",
                        "internship_step",
                        st.id or 0,
                        f"【開始1時間前】{cname(i.company_id)} {prefix}{label}{start_time_suffix}",
                    )

    # ---------------- Selections ----------------
    selections = session.exec(
        select(Selection).where(Selection.user_id == user.id)
    ).all()
    sel_ids = [s.id for s in selections if s.id is not None]
    sel_steps_by_parent: dict[int, list[SelectionStep]] = {sid: [] for sid in sel_ids}
    sel_subs_by_parent: dict[int, list[Submission]] = {sid: [] for sid in sel_ids}
    if sel_ids:
        for st in session.exec(
            select(SelectionStep).where(
                SelectionStep.selection_id.in_(sel_ids)  # type: ignore[attr-defined]
            )
        ).all():
            sel_steps_by_parent.setdefault(st.selection_id, []).append(st)
        for sub in session.exec(
            select(Submission).where(
                Submission.selection_id.in_(sel_ids)  # type: ignore[attr-defined]
            )
        ).all():
            sel_subs_by_parent.setdefault(sub.selection_id, []).append(sub)

    for s in selections:
        if s.offer_deadline:
            if prefs.get("offer_3d", True):
                add_day(
                    s.offer_deadline - timedelta(days=3),
                    "sel_offer_3d",
                    "selection",
                    s.id or 0,
                    f"【3日前】内定承諾期限: {cname(s.company_id)}",
                )
            if prefs.get("offer_1d", True):
                add_day(
                    s.offer_deadline - timedelta(days=1),
                    "sel_offer_1d",
                    "selection",
                    s.id or 0,
                    f"【明日】内定承諾期限: {cname(s.company_id)}",
                )
        if s.offer_event_date and prefs.get("interview_1d", True):
            add_day(
                s.offer_event_date - timedelta(days=1),
                "sel_offer_event_1d",
                "selection",
                s.id or 0,
                f"【明日】内定者懇親会: {cname(s.company_id)}",
            )

        # Selection steps: 1d + 1h before (split briefing vs interview)
        steps = sel_steps_by_parent.get(s.id or 0, [])
        for st in steps:
            if not st.scheduled_date:
                continue
            label = _step_label(st.step_type, st.label)
            is_briefing = st.step_type == "briefing"
            is_es_or_apt = st.step_type in ("es", "aptitude")
            pref_1d = "briefing_1d" if is_briefing else "interview_1d"
            pref_1h = "briefing_1h" if is_briefing else "interview_1h"
            time_suffix = f" {st.scheduled_time}" if st.scheduled_time else ""
            deadline_marker = "【締切】" if is_es_or_apt else "【明日】"
            if prefs.get(pref_1d, True):
                add_day(
                    st.scheduled_date - timedelta(days=1),
                    "step_1d",
                    "selection_step",
                    st.id or 0,
                    f"{deadline_marker}{cname(s.company_id)} {label}{time_suffix}",
                )
            if prefs.get(pref_1h, True):
                add_hour_before(
                    st.scheduled_date,
                    st.scheduled_time,
                    "step_1h",
                    "selection_step",
                    st.id or 0,
                    f"【1時間前】{cname(s.company_id)} {label}{time_suffix}",
                )
            # ES/適性 期間モード：開始日も通知
            if is_es_or_apt and st.start_date:
                start_time_suffix = f" {st.start_time}" if st.start_time else ""
                if prefs.get(pref_1d, True):
                    add_day(
                        st.start_date - timedelta(days=1),
                        "step_start_1d",
                        "selection_step",
                        st.id or 0,
                        f"【開始明日】{cname(s.company_id)} {label}{start_time_suffix}",
                    )
                if prefs.get(pref_1h, True):
                    add_hour_before(
                        st.start_date,
                        st.start_time,
                        "step_start_1h",
                        "selection_step",
                        st.id or 0,
                        f"【開始1時間前】{cname(s.company_id)} {label}{start_time_suffix}",
                    )

        # Submissions: deadline 3d/1d
        subs = sel_subs_by_parent.get(s.id or 0, [])
        for sub in subs:
            if sub.submitted:
                continue
            if sub.deadline:
                if prefs.get("submission_3d", True):
                    add_day(
                        sub.deadline - timedelta(days=3),
                        "sub_3d",
                        "submission",
                        sub.id or 0,
                        f"【3日前】提出物: {cname(s.company_id)} {sub.label or ''}",
                    )
                if prefs.get("submission_1d", True):
                    add_day(
                        sub.deadline - timedelta(days=1),
                        "sub_1d",
                        "submission",
                        sub.id or 0,
                        f"【明日】提出物: {cname(s.company_id)} {sub.label or ''}",
                    )

    # Drop stale reminders (existed before but were not re-emitted this pass)
    # — covers deletions and entries whose underlying event/step is gone.
    # Sent reminders that are still relevant were preserved via keep_ids above.
    cutoff_dt = now_utc - timedelta(hours=24)
    for r in existing_rows:
        if r.id in keep_ids:
            continue
        # Preserve sent rows for the last 24h purely for audit/idempotency
        # (they won't resend because dispatch only picks unsent ones).
        if r.sent and _as_utc(r.remind_at) >= cutoff_dt:
            continue
        session.delete(r)

    session.commit()
    return count


async def dispatch_due_reminders(session: Session) -> int:
    """Send emails for reminders due now. Returns number of users emailed."""
    now = datetime.now(timezone.utc)
    # Group due reminders per user
    rows = session.exec(
        select(Reminder)
        .where(Reminder.sent == False)  # noqa: E712
        .where(Reminder.channel == "email")
        .where(Reminder.remind_at <= now)
    ).all()
    if not rows:
        return 0

    by_user: dict[int, list[Reminder]] = {}
    for r in rows:
        by_user.setdefault(r.user_id, []).append(r)

    users_emailed = 0
    for user_id, reminders in by_user.items():
        user = session.get(User, user_id)
        if not user or not user.email:
            # Mark as sent to avoid retrying forever when there's no email
            for r in reminders:
                r.sent = True
                session.add(r)
            continue

        prefs = _user_prefs(user)
        if not prefs.get("email_enabled", True):
            for r in reminders:
                r.sent = True
                session.add(r)
            continue

        items = [
            {
                "when_label": _event_label(r),
                "title": _strip_key(r.title),
            }
            for r in reminders
        ]
        subject, html, text = render_reminder_email(
            user.display_name or user.first_name, items
        )
        ok = await send_email(user.email, subject, html, text=text)
        if ok:
            users_emailed += 1
            for r in reminders:
                r.sent = True
                session.add(r)

    session.commit()
    return users_emailed


def _strip_key(title: str) -> str:
    if title.startswith("[") and "] " in title:
        return title.split("] ", 1)[1]
    return title


def _extract_sub_key(title: str) -> str:
    if not title.startswith("["):
        return ""
    end = title.find("] ")
    if end < 0:
        return ""
    return title[1:end]


def _event_label(r: Reminder) -> str:
    """Display label for the EVENT this reminder is about (not the send time).

    Derived from sub_key conventions:
      *_1h : event = remind_at + 1 hour (full datetime).
      *_1d : event date = remind_date + 1 day (date only).
      *_3d : event date = remind_date + 3 days (date only).
      otherwise: fall back to remind_at date.
    """
    remind_local = _as_utc(r.remind_at).astimezone(JST)
    sub_key = _extract_sub_key(r.title or "")
    if sub_key.endswith("_1h"):
        return (remind_local + timedelta(hours=1)).strftime("%m/%d (%a) %H:%M〜")
    if sub_key.endswith("_3d"):
        return (remind_local + timedelta(days=3)).strftime("%m/%d (%a)")
    if sub_key.endswith("_1d"):
        return (remind_local + timedelta(days=1)).strftime("%m/%d (%a)")
    return remind_local.strftime("%m/%d (%a)")


# -------------- Test helper --------------

async def send_test_email(user: User) -> bool:
    if not user.email:
        return False
    subject = "【就活マネージャー】通知テスト"
    html = f"""
<!doctype html><html><body style="font-family:'Hiragino Sans','Noto Sans JP',sans-serif;">
<div style="max-width:540px;margin:20px auto;padding:22px;border-radius:14px;background:#f8fafc;border:1px solid #e2e8f0;">
<h2 style="color:#2563eb;margin:0 0 10px 0;">通知テスト</h2>
<p>{user.display_name or user.first_name}さん、こんにちは。</p>
<p>この通知は「就活マネージャー」からのテスト送信です。<br>
締切や面接の前日・数日前に、このような形で通知をお送りします。</p>
<p><a href="{settings.app_public_url}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;">アプリを開く</a></p>
</div></body></html>
"""
    return await send_email(user.email, subject, html)
