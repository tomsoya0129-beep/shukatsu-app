import os
import uuid
from pathlib import Path
from datetime import date, timedelta
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import get_db
from models import Book, BookUnit, Student, Plan, PlanSubject, PlanDayEvent, PlanEntry
from schemas import (
    BookCreate, BookResponse, BookUnitCreate,
    StudentCreate, StudentResponse,
    PlanCreate, PlanResponse, PlanSubjectCreate,
    PlanDayEventCreate, PlanEntryCreate, PlanEntryResponse,
    GeneratePlanRequest,
)

app = FastAPI(title="Study Scheduler API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DAY_MAP = {"mon": 0, "tue": 1, "wed": 2, "thu": 3, "fri": 4, "sat": 5, "sun": 6}


# ── Books ──

@app.get("/api/books", response_model=list[BookResponse])
def list_books(db: Session = Depends(get_db)):
    return db.query(Book).order_by(Book.name).all()


@app.get("/api/books/{book_id}", response_model=BookResponse)
def get_book(book_id: uuid.UUID, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, "Book not found")
    return book


@app.post("/api/books", response_model=BookResponse)
def create_book(data: BookCreate, db: Session = Depends(get_db)):
    book = Book(name=data.name, book_type=data.book_type, total_pages=data.total_pages)
    db.add(book)
    db.flush()
    for i, u in enumerate(data.units):
        unit = BookUnit(
            book_id=book.id, label=u.label, title=u.title,
            start_page=u.start_page, end_page=u.end_page,
            sort_order=u.sort_order if u.sort_order is not None else i,
            parent_label=u.parent_label,
        )
        db.add(unit)
    db.commit()
    db.refresh(book)
    return book


@app.put("/api/books/{book_id}", response_model=BookResponse)
def update_book(book_id: uuid.UUID, data: BookCreate, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, "Book not found")
    book.name = data.name
    book.book_type = data.book_type
    book.total_pages = data.total_pages
    db.query(BookUnit).filter(BookUnit.book_id == book_id).delete()
    for i, u in enumerate(data.units):
        unit = BookUnit(
            book_id=book.id, label=u.label, title=u.title,
            start_page=u.start_page, end_page=u.end_page,
            sort_order=u.sort_order if u.sort_order is not None else i,
            parent_label=u.parent_label,
        )
        db.add(unit)
    db.commit()
    db.refresh(book)
    return book


@app.delete("/api/books/{book_id}")
def delete_book(book_id: uuid.UUID, db: Session = Depends(get_db)):
    book = db.query(Book).filter(Book.id == book_id).first()
    if not book:
        raise HTTPException(404, "Book not found")
    db.delete(book)
    db.commit()
    return {"ok": True}


# ── Students ──

@app.get("/api/students", response_model=list[StudentResponse])
def list_students(db: Session = Depends(get_db)):
    return db.query(Student).order_by(Student.name).all()


@app.post("/api/students", response_model=StudentResponse)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    student = Student(name=data.name, grade=data.grade, notes=data.notes)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@app.put("/api/students/{student_id}", response_model=StudentResponse)
def update_student(student_id: uuid.UUID, data: StudentCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    student.name = data.name
    student.grade = data.grade
    student.notes = data.notes
    db.commit()
    db.refresh(student)
    return student


@app.delete("/api/students/{student_id}")
def delete_student(student_id: uuid.UUID, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(404, "Student not found")
    db.delete(student)
    db.commit()
    return {"ok": True}


# ── Plans ──

@app.get("/api/plans", response_model=list[PlanResponse])
def list_plans(student_id: uuid.UUID | None = None, db: Session = Depends(get_db)):
    q = db.query(Plan)
    if student_id:
        q = q.filter(Plan.student_id == student_id)
    return q.order_by(Plan.created_at.desc()).all()


@app.get("/api/plans/{plan_id}", response_model=PlanResponse)
def get_plan(plan_id: uuid.UUID, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    return plan


@app.post("/api/plans", response_model=PlanResponse)
def create_plan(data: PlanCreate, db: Session = Depends(get_db)):
    plan = Plan(
        student_id=data.student_id, name=data.name,
        start_date=data.start_date, end_date=data.end_date, notes=data.notes,
    )
    db.add(plan)
    db.flush()
    for i, s in enumerate(data.subjects):
        subj = PlanSubject(
            plan_id=plan.id, book_id=s.book_id, display_name=s.display_name,
            start_unit_index=s.start_unit_index, duration_hours=s.duration_hours,
            duration_display=s.duration_display, units_per_day=s.units_per_day,
            study_days=s.study_days, review_interval=s.review_interval,
            review_type=s.review_type, on_completion=s.on_completion,
            next_book_id=s.next_book_id, sort_order=i,
        )
        db.add(subj)
    for ev in data.day_events:
        event = PlanDayEvent(
            plan_id=plan.id, date=ev.date, event_type=ev.event_type,
            content=ev.content, is_off_day=ev.is_off_day,
        )
        db.add(event)
    db.commit()
    db.refresh(plan)
    return plan


@app.put("/api/plans/{plan_id}", response_model=PlanResponse)
def update_plan(plan_id: uuid.UUID, data: PlanCreate, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    plan.student_id = data.student_id
    plan.name = data.name
    plan.start_date = data.start_date
    plan.end_date = data.end_date
    plan.notes = data.notes
    db.query(PlanSubject).filter(PlanSubject.plan_id == plan_id).delete()
    db.query(PlanDayEvent).filter(PlanDayEvent.plan_id == plan_id).delete()
    for i, s in enumerate(data.subjects):
        subj = PlanSubject(
            plan_id=plan.id, book_id=s.book_id, display_name=s.display_name,
            start_unit_index=s.start_unit_index, duration_hours=s.duration_hours,
            duration_display=s.duration_display, units_per_day=s.units_per_day,
            study_days=s.study_days, review_interval=s.review_interval,
            review_type=s.review_type, on_completion=s.on_completion,
            next_book_id=s.next_book_id, sort_order=i,
        )
        db.add(subj)
    for ev in data.day_events:
        event = PlanDayEvent(
            plan_id=plan.id, date=ev.date, event_type=ev.event_type,
            content=ev.content, is_off_day=ev.is_off_day,
        )
        db.add(event)
    db.commit()
    db.refresh(plan)
    return plan


@app.delete("/api/plans/{plan_id}")
def delete_plan(plan_id: uuid.UUID, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")
    db.delete(plan)
    db.commit()
    return {"ok": True}


# ── Plan Entries (manual add/edit) ──

@app.post("/api/plans/{plan_id}/entries", response_model=PlanEntryResponse)
def add_plan_entry(plan_id: uuid.UUID, data: PlanEntryCreate, db: Session = Depends(get_db)):
    entry = PlanEntry(plan_id=plan_id, **data.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@app.delete("/api/plans/{plan_id}/entries/{entry_id}")
def delete_plan_entry(plan_id: uuid.UUID, entry_id: uuid.UUID, db: Session = Depends(get_db)):
    entry = db.query(PlanEntry).filter(PlanEntry.id == entry_id, PlanEntry.plan_id == plan_id).first()
    if not entry:
        raise HTTPException(404, "Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


# ── Generate Schedule ──

@app.post("/api/plans/{plan_id}/generate")
def generate_plan(plan_id: uuid.UUID, db: Session = Depends(get_db)):
    plan = db.query(Plan).filter(Plan.id == plan_id).first()
    if not plan:
        raise HTTPException(404, "Plan not found")

    # Clear existing generated entries
    db.query(PlanEntry).filter(PlanEntry.plan_id == plan_id).delete()

    # Get off days and events
    off_days = set()
    day_events_map: dict[date, list[str]] = {}
    for ev in plan.day_events:
        if ev.is_off_day:
            off_days.add(ev.date)
        if ev.content:
            day_events_map.setdefault(ev.date, []).append(ev.content)

    # Build date range
    current = plan.start_date
    dates = []
    while current <= plan.end_date:
        dates.append(current)
        current += timedelta(days=1)

    # For each subject, generate entries
    sort_counter = 0
    for subj in sorted(plan.subjects, key=lambda s: s.sort_order):
        book = db.query(Book).filter(Book.id == subj.book_id).first()
        if not book:
            continue
        units = sorted(book.units, key=lambda u: u.sort_order)
        if not units:
            continue

        display_name = subj.display_name or book.name
        study_day_nums = {DAY_MAP.get(d, -1) for d in (subj.study_days or [])}

        unit_idx = subj.start_unit_index
        units_studied = 0
        completed_once = False

        for d in dates:
            if d in off_days:
                continue
            if d.weekday() not in study_day_nums:
                continue

            # Check for review day
            if subj.review_interval and units_studied > 0 and units_studied % subj.review_interval == 0:
                entry = PlanEntry(
                    plan_id=plan_id, date=d, entry_type="review",
                    book_name=display_name,
                    duration_display=subj.duration_display,
                    content="★復習",
                    sort_order=sort_counter,
                )
                db.add(entry)
                sort_counter += 1
                units_studied += 1
                continue

            # Study units
            for _ in range(subj.units_per_day):
                if unit_idx >= len(units):
                    if subj.on_completion == "repeat":
                        unit_idx = 0
                        completed_once = True
                    else:
                        break

                unit = units[unit_idx]
                detail_parts = []
                if unit.title:
                    detail_parts.append(unit.title)
                if unit.start_page and unit.end_page:
                    detail_parts.append(f"p.{unit.start_page}-{unit.end_page}")
                elif unit.start_page:
                    detail_parts.append(f"p.{unit.start_page}")
                detail = "\n".join(detail_parts) if detail_parts else None

                # Build content with label
                content = unit.label
                if completed_once and subj.on_completion == "repeat":
                    content += " (2周目)"

                entry = PlanEntry(
                    plan_id=plan_id, date=d, entry_type="study",
                    book_name=display_name,
                    duration_display=subj.duration_display,
                    content=content,
                    detail=detail,
                    sort_order=sort_counter,
                )
                db.add(entry)
                sort_counter += 1
                unit_idx += 1

            units_studied += 1

            if unit_idx >= len(units) and subj.on_completion != "repeat":
                break

    # Add day events as entries
    for d, events in day_events_map.items():
        for ev_content in events:
            entry = PlanEntry(
                plan_id=plan_id, date=d, entry_type="event",
                book_name=None,
                duration_display=None,
                content=ev_content,
                sort_order=sort_counter,
            )
            db.add(entry)
            sort_counter += 1

    db.commit()
    db.refresh(plan)
    return plan


@app.get("/api/health")
def health():
    return {"status": "ok"}


# Serve frontend static files in production
STATIC_DIR = Path(__file__).parent / "static"
if STATIC_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        file_path = (STATIC_DIR / full_path).resolve()
        if file_path.is_relative_to(STATIC_DIR) and file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(STATIC_DIR / "index.html"))
