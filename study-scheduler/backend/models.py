import uuid
from datetime import datetime, date
from sqlalchemy import Column, String, Integer, Text, Date, DateTime, Boolean, DECIMAL, ARRAY, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base


class Book(Base):
    __tablename__ = "books"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    book_type = Column(Text, nullable=False, default="chapter_based")
    total_pages = Column(Integer)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    units = relationship("BookUnit", back_populates="book", cascade="all, delete-orphan", order_by="BookUnit.sort_order")


class BookUnit(Base):
    __tablename__ = "book_units"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id", ondelete="CASCADE"), nullable=False)
    label = Column(Text, nullable=False)
    title = Column(Text)
    start_page = Column(Integer)
    end_page = Column(Integer)
    sort_order = Column(Integer, nullable=False, default=0)
    parent_label = Column(Text)
    book = relationship("Book", back_populates="units")


class Student(Base):
    __tablename__ = "students"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    grade = Column(Text)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class Plan(Base):
    __tablename__ = "plans"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    student_id = Column(UUID(as_uuid=True), ForeignKey("students.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    subjects = relationship("PlanSubject", back_populates="plan", cascade="all, delete-orphan", order_by="PlanSubject.sort_order")
    entries = relationship("PlanEntry", back_populates="plan", cascade="all, delete-orphan")
    day_events = relationship("PlanDayEvent", back_populates="plan", cascade="all, delete-orphan")
    student = relationship("Student")


class PlanSubject(Base):
    __tablename__ = "plan_subjects"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"), nullable=False)
    display_name = Column(Text)
    start_unit_index = Column(Integer, nullable=False, default=0)
    duration_hours = Column(DECIMAL(4, 2), nullable=False, default=0.75)
    duration_display = Column(Text, default="0.75h")
    units_per_day = Column(Integer, nullable=False, default=1)
    study_days = Column(ARRAY(Text), default=["mon", "tue", "wed", "thu", "fri", "sat"])
    review_interval = Column(Integer)
    review_type = Column(Text, default="review")
    on_completion = Column(Text, default="stop")
    next_book_id = Column(UUID(as_uuid=True), ForeignKey("books.id"))
    sort_order = Column(Integer, nullable=False, default=0)
    plan = relationship("Plan", back_populates="subjects")
    book = relationship("Book", foreign_keys=[book_id])


class PlanDayEvent(Base):
    __tablename__ = "plan_day_events"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    event_type = Column(Text, nullable=False, default="event")
    content = Column(Text, nullable=False)
    is_off_day = Column(Boolean, default=False)
    plan = relationship("Plan", back_populates="day_events")


class PlanEntry(Base):
    __tablename__ = "plan_entries"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    entry_type = Column(Text, nullable=False, default="study")
    book_name = Column(Text)
    duration_display = Column(Text)
    content = Column(Text, nullable=False)
    detail = Column(Text)
    sort_order = Column(Integer, nullable=False, default=0)
    plan = relationship("Plan", back_populates="entries")
