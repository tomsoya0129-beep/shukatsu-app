"""Pydantic schemas for API I/O."""
from __future__ import annotations

from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class _ORMModel(BaseModel):
    """Base for response models that read directly from SQLModel rows.

    Enabling ``from_attributes`` lets us call ``Schema.model_validate(orm_row)``
    instead of the slower ``Schema.model_validate(orm_row.model_dump())`` pattern.
    """

    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class SignupRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=64)
    birthday: date
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None


class LoginRequest(BaseModel):
    first_name: str
    birthday: date


class UserOut(_ORMModel):
    id: int
    first_name: str
    birthday: date
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    display_name: Optional[str] = None
    email: Optional[EmailStr] = None


# ---------- Company ----------
class CompanyBase(BaseModel):
    name: str
    industry: Optional[str] = None
    location: Optional[str] = None
    recruit_url: Optional[str] = None
    mypage_url: Optional[str] = None
    login_id: Optional[str] = None
    color: str = "#2563eb"
    tags: str = ""
    memo: Optional[str] = None


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    recruit_url: Optional[str] = None
    mypage_url: Optional[str] = None
    login_id: Optional[str] = None
    color: Optional[str] = None
    tags: Optional[str] = None
    memo: Optional[str] = None


class CompanyOut(CompanyBase, _ORMModel):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime


# ---------- Internship ----------
class InternshipBase(BaseModel):
    company_id: int
    title: Optional[str] = None
    entry_deadline: Optional[date] = None
    entry_deadline_time: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    end_date: Optional[date] = None
    end_time: Optional[str] = None
    mode: str = "offline"
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    related_url: Optional[str] = None
    memo: Optional[str] = None
    briefing_date: Optional[date] = None
    briefing_time: Optional[str] = None
    status: str = "not_applied"


class InternshipCreate(InternshipBase):
    pass


class InternshipUpdate(BaseModel):
    company_id: Optional[int] = None
    title: Optional[str] = None
    entry_deadline: Optional[date] = None
    entry_deadline_time: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    end_date: Optional[date] = None
    end_time: Optional[str] = None
    mode: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    related_url: Optional[str] = None
    memo: Optional[str] = None
    briefing_date: Optional[date] = None
    briefing_time: Optional[str] = None
    status: Optional[str] = None


class InternshipStepBase(BaseModel):
    step_type: str
    label: Optional[str] = None
    order_index: int = 0
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    result: str = "pending"
    memo: Optional[str] = None


class InternshipStepCreate(InternshipStepBase):
    pass


class InternshipStepUpdate(BaseModel):
    step_type: Optional[str] = None
    label: Optional[str] = None
    order_index: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    result: Optional[str] = None
    memo: Optional[str] = None


class InternshipStepOut(InternshipStepBase, _ORMModel):
    id: int
    internship_id: int
    created_at: datetime
    updated_at: datetime


class InternshipSessionBase(BaseModel):
    label: Optional[str] = None
    order_index: int = 0
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    end_date: Optional[date] = None
    end_time: Optional[str] = None
    mode: Optional[str] = None
    location: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    memo: Optional[str] = None


class InternshipSessionCreate(InternshipSessionBase):
    pass


class InternshipSessionUpdate(BaseModel):
    label: Optional[str] = None
    order_index: Optional[int] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    end_date: Optional[date] = None
    end_time: Optional[str] = None
    mode: Optional[str] = None
    location: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    memo: Optional[str] = None


class InternshipSessionOut(InternshipSessionBase, _ORMModel):
    id: int
    internship_id: int
    created_at: datetime
    updated_at: datetime


class InternshipOut(InternshipBase, _ORMModel):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    steps: List[InternshipStepOut] = []
    sessions: List[InternshipSessionOut] = []


# ---------- Selection Step ----------
class SelectionStepBase(BaseModel):
    step_type: str
    label: Optional[str] = None
    order_index: int = 0
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    result: str = "pending"
    memo: Optional[str] = None


class SelectionStepCreate(SelectionStepBase):
    pass


class SelectionStepUpdate(BaseModel):
    step_type: Optional[str] = None
    label: Optional[str] = None
    order_index: Optional[int] = None
    scheduled_date: Optional[date] = None
    scheduled_time: Optional[str] = None
    start_date: Optional[date] = None
    start_time: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None
    online_url: Optional[str] = None
    meeting_code: Optional[str] = None
    meeting_password: Optional[str] = None
    result: Optional[str] = None
    memo: Optional[str] = None


class SelectionStepOut(SelectionStepBase, _ORMModel):
    id: int
    selection_id: int
    created_at: datetime
    updated_at: datetime


# ---------- Submission ----------
class SubmissionBase(BaseModel):
    doc_type: str
    label: Optional[str] = None
    deadline: Optional[date] = None
    submitted: bool = False
    memo: Optional[str] = None


class SubmissionCreate(SubmissionBase):
    pass


class SubmissionUpdate(BaseModel):
    doc_type: Optional[str] = None
    label: Optional[str] = None
    deadline: Optional[date] = None
    submitted: Optional[bool] = None
    memo: Optional[str] = None


class SubmissionOut(SubmissionBase, _ORMModel):
    id: int
    selection_id: int


# ---------- Selection ----------
class SelectionBase(BaseModel):
    company_id: int
    title: Optional[str] = None
    entry_deadline: Optional[date] = None
    entry_deadline_time: Optional[str] = None
    aptitude_deadline: Optional[date] = None
    aptitude_deadline_time: Optional[str] = None
    result_announcement_date: Optional[date] = None
    overall_status: str = "in_progress"
    offer_deadline: Optional[date] = None
    offer_event_date: Optional[date] = None
    offer_salary: Optional[str] = None
    offer_location: Optional[str] = None
    memo: Optional[str] = None


class SelectionCreate(SelectionBase):
    pass


class SelectionUpdate(BaseModel):
    company_id: Optional[int] = None
    title: Optional[str] = None
    entry_deadline: Optional[date] = None
    entry_deadline_time: Optional[str] = None
    aptitude_deadline: Optional[date] = None
    aptitude_deadline_time: Optional[str] = None
    result_announcement_date: Optional[date] = None
    overall_status: Optional[str] = None
    offer_deadline: Optional[date] = None
    offer_event_date: Optional[date] = None
    offer_salary: Optional[str] = None
    offer_location: Optional[str] = None
    memo: Optional[str] = None


class SelectionOut(SelectionBase, _ORMModel):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime
    steps: List[SelectionStepOut] = []
    submissions: List[SubmissionOut] = []


# ---------- Calendar ----------
class CalendarEvent(BaseModel):
    id: str
    title: str
    start: date
    end: Optional[date] = None
    color: str
    kind: str  # "intern_period" | "intern_deadline" | "selection_deadline" | "step" | "offer_deadline" | "result"
    company_id: int
    ref_id: int
    allDay: bool = True
    extra: dict = {}


# ---------- Dashboard ----------
class DashboardSummary(BaseModel):
    active_selections: int   # 持ち駒数
    offers: int              # 内定数
    upcoming_events: List[CalendarEvent]
    total_companies: int
    total_internships: int


# ---------- Reminder ----------
class ReminderBase(BaseModel):
    ref_type: str
    ref_id: int
    title: str
    remind_at: datetime
    channel: str = "inapp"


class ReminderCreate(ReminderBase):
    pass


class ReminderOut(ReminderBase, _ORMModel):
    id: int
    sent: bool
