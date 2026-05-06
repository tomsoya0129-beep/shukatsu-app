from pydantic import BaseModel
from typing import Optional
from datetime import date
from uuid import UUID


class BookUnitCreate(BaseModel):
    label: str
    title: Optional[str] = None
    start_page: Optional[int] = None
    end_page: Optional[int] = None
    sort_order: int = 0
    parent_label: Optional[str] = None


class BookUnitResponse(BookUnitCreate):
    id: UUID
    book_id: UUID

    class Config:
        from_attributes = True


class BookCreate(BaseModel):
    name: str
    book_type: str = "chapter_based"
    total_pages: Optional[int] = None
    units: list[BookUnitCreate] = []


class BookResponse(BaseModel):
    id: UUID
    name: str
    book_type: str
    total_pages: Optional[int]
    units: list[BookUnitResponse] = []

    class Config:
        from_attributes = True


class StudentCreate(BaseModel):
    name: str
    grade: Optional[str] = None
    notes: Optional[str] = None


class StudentResponse(BaseModel):
    id: UUID
    name: str
    grade: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class PlanSubjectCreate(BaseModel):
    book_id: UUID
    display_name: Optional[str] = None
    start_unit_index: int = 0
    duration_hours: float = 0.75
    duration_display: str = "0.75h"
    units_per_day: int = 1
    study_days: list[str] = ["mon", "tue", "wed", "thu", "fri", "sat"]
    review_interval: Optional[int] = None
    review_type: str = "review"
    on_completion: str = "stop"
    next_book_id: Optional[UUID] = None
    sort_order: int = 0


class PlanSubjectResponse(PlanSubjectCreate):
    id: UUID
    plan_id: UUID

    class Config:
        from_attributes = True


class PlanDayEventCreate(BaseModel):
    date: date
    event_type: str = "event"
    content: str
    is_off_day: bool = False


class PlanDayEventResponse(PlanDayEventCreate):
    id: UUID
    plan_id: UUID

    class Config:
        from_attributes = True


class PlanEntryCreate(BaseModel):
    date: date
    entry_type: str = "study"
    book_name: Optional[str] = None
    duration_display: Optional[str] = None
    content: str
    detail: Optional[str] = None
    sort_order: int = 0


class PlanEntryResponse(PlanEntryCreate):
    id: UUID
    plan_id: UUID

    class Config:
        from_attributes = True


class PlanCreate(BaseModel):
    student_id: UUID
    name: str
    start_date: date
    end_date: date
    notes: Optional[str] = None
    subjects: list[PlanSubjectCreate] = []
    day_events: list[PlanDayEventCreate] = []


class PlanResponse(BaseModel):
    id: UUID
    student_id: UUID
    name: str
    start_date: date
    end_date: date
    notes: Optional[str]
    subjects: list[PlanSubjectResponse] = []
    entries: list[PlanEntryResponse] = []
    day_events: list[PlanDayEventResponse] = []
    student: Optional[StudentResponse] = None

    class Config:
        from_attributes = True


class GeneratePlanRequest(BaseModel):
    plan_id: UUID
