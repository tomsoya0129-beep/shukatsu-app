"""Database models."""
from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


# ---------- User ----------
class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    # Login is by first name + birthday. We enforce uniqueness on the pair.
    first_name: str = Field(index=True)
    birthday: date = Field(index=True)
    # Optional display name (e.g. full name), email for notifications.
    display_name: Optional[str] = None
    email: Optional[str] = None
    # JSON: see DEFAULT_NOTIFICATION_PREFS below
    notification_prefs: str = Field(default='{"email_enabled":true,"deadline_3d":true,"deadline_1d":true,"aptitude_3d":true,"aptitude_1d":true,"interview_1d":true,"interview_1h":true,"intern_start_1d":true,"intern_start_1h":true,"briefing_1d":true,"briefing_1h":true,"submission_3d":true,"submission_1d":true,"offer_3d":true,"offer_1d":true}')
    created_at: datetime = Field(default_factory=_utcnow)


# ---------- Company ----------
class Company(SQLModel, table=True):
    __tablename__ = "companies"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    name: str
    industry: Optional[str] = None       # 業界
    location: Optional[str] = None       # 所在地
    recruit_url: Optional[str] = None    # 採用ページURL
    mypage_url: Optional[str] = None     # マイページURL
    login_id: Optional[str] = None       # ログインID（パスワードは保存しない）

    # UI: カラーコード (#RRGGBB)
    color: str = "#2563eb"

    # タグ (JSON文字列でカンマ区切り)
    tags: str = ""  # e.g. "IT,外資,夏インターン"

    memo: Optional[str] = None
    sort_order: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Internship ----------
class Internship(SQLModel, table=True):
    __tablename__ = "internships"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    company_id: int = Field(foreign_key="companies.id", index=True)

    title: Optional[str] = None          # 例: サマーインターン5days
    entry_deadline: Optional[date] = None  # エントリー締切日
    entry_deadline_time: Optional[str] = None  # 例: "23:59"
    start_date: Optional[date] = None    # 開始日
    start_time: Optional[str] = None     # 例: "10:00"
    end_date: Optional[date] = None      # 終了日
    end_time: Optional[str] = None       # 例: "18:00"

    # "online" | "offline" | "hybrid"
    mode: str = "offline"
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None

    related_url: Optional[str] = None    # 募集要項などのURL
    memo: Optional[str] = None

    # 説明会
    briefing_date: Optional[date] = None
    briefing_time: Optional[str] = None  # "14:00" など

    # "applied" | "accepted" | "rejected" | "completed" | "not_applied"
    status: str = "not_applied"

    sort_order: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Selection (本選考) ----------
class Selection(SQLModel, table=True):
    __tablename__ = "selections"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    company_id: int = Field(foreign_key="companies.id", index=True)

    title: Optional[str] = None  # 例: 2026新卒 本選考
    entry_deadline: Optional[date] = None  # 本エントリー締切日
    entry_deadline_time: Optional[str] = None
    aptitude_deadline: Optional[date] = None  # 適性検査の締切
    aptitude_deadline_time: Optional[str] = None
    result_announcement_date: Optional[date] = None  # 結果発表日

    # 選考全体のステータス
    # "in_progress" | "offer" | "accepted" | "declined" | "rejected" | "withdrawn"
    overall_status: str = "in_progress"

    # 内定関連
    offer_deadline: Optional[date] = None   # 内定承諾期限
    offer_event_date: Optional[date] = None  # 内定者懇親会など
    offer_salary: Optional[str] = None      # 提示年収など
    offer_location: Optional[str] = None    # 勤務地

    memo: Optional[str] = None

    sort_order: int = Field(default=0, index=True)
    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Selection Step (選考ステップ) ----------
class SelectionStep(SQLModel, table=True):
    __tablename__ = "selection_steps"

    id: Optional[int] = Field(default=None, primary_key=True)
    selection_id: int = Field(foreign_key="selections.id", index=True)

    # 種類: "briefing"(説明会) | "es" | "aptitude"(適性テスト) | "gd" | "interview_1" | "interview_2" | "interview_3" | "interview_final" | "other"
    step_type: str
    label: Optional[str] = None  # カスタム表示名
    order_index: int = 0

    scheduled_date: Optional[date] = None  # ES/適性 の場合は 「締切日」として扱う
    scheduled_time: Optional[str] = None  # "14:00" など
    # ES/適性 の「期間モード」で使用（開始日時）
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None  # "online" | "offline"
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None  # オンライン参加コード
    meeting_password: Optional[str] = None  # オンラインパスワード

    # 結果: "pending" | "waiting"(合否待ち) | "passed" | "failed" | "skipped"
    result: str = "pending"
    memo: Optional[str] = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Internship Step (インターン選考ステップ) ----------
class InternshipStep(SQLModel, table=True):
    __tablename__ = "internship_steps"

    id: Optional[int] = Field(default=None, primary_key=True)
    internship_id: int = Field(foreign_key="internships.id", index=True)

    # "briefing" | "es" | "aptitude" | "gd" | "interview_1" | "interview_2" | "interview_3" | "interview_final" | "other"
    step_type: str
    label: Optional[str] = None
    order_index: int = 0

    scheduled_date: Optional[date] = None  # ES/適性は「締切日」として扱う
    scheduled_time: Optional[str] = None
    # ES/適性 の「期間モード」で使用（開始日時）
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None

    result: str = "pending"
    memo: Optional[str] = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Internship Session (複数日程) ----------
class InternshipSession(SQLModel, table=True):
    __tablename__ = "internship_sessions"

    id: Optional[int] = Field(default=None, primary_key=True)
    internship_id: int = Field(foreign_key="internships.id", index=True)

    label: Optional[str] = None  # 例: Day1, 第1回 など
    order_index: int = 0

    start_date: Optional[date] = None
    start_time: Optional[str] = None
    end_date: Optional[date] = None
    end_time: Optional[str] = None

    mode: Optional[str] = None  # "online" | "offline"
    location: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None

    memo: Optional[str] = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Submission (提出物) ----------
class Submission(SQLModel, table=True):
    __tablename__ = "submissions"

    id: Optional[int] = Field(default=None, primary_key=True)
    selection_id: int = Field(foreign_key="selections.id", index=True)

    # "resume"(履歴書) | "transcript"(成績証明書) | "health_check"(健康診断書) | "portfolio" | "cover_letter" | "other"
    doc_type: str
    label: Optional[str] = None
    deadline: Optional[date] = None
    submitted: bool = False
    memo: Optional[str] = None

    created_at: datetime = Field(default_factory=_utcnow)
    updated_at: datetime = Field(default_factory=_utcnow)


# ---------- Reminder ----------
class Reminder(SQLModel, table=True):
    __tablename__ = "reminders"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)

    # 参照: "internship" | "selection" | "selection_step" | "submission" | "offer"
    ref_type: str
    ref_id: int

    title: str
    # Indexed for the dispatcher's `remind_at <= now` sweep.
    remind_at: datetime = Field(index=True)
    # Indexed because dispatch filters by (sent=False, channel='email').
    sent: bool = Field(default=False, index=True)
    # "inapp" | "email"
    channel: str = Field(default="inapp", index=True)

    created_at: datetime = Field(default_factory=_utcnow)
