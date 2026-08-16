import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import Uuid

from .database import Base

MOOD_VALUES = (
    "joyful",
    "calm",
    "motivated",
    "neutral",
    "anxious",
    "sad",
    "angry",
)

NOTIFICATION_CATEGORIES = (
    "reminder",
    "streak_milestone",
    "system",
)


class User(Base):
    __tablename__ = "users"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    full_name = Column(String(100), nullable=False)

    dark_mode_enabled = Column(Boolean, default=False)
    daily_reminders_enabled = Column(Boolean, default=True)
    reminder_time = Column(Time, default=time(9, 0))

    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    joined_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    notifications = relationship(
        "Notification",
        back_populates="recipient",
        cascade="all, delete-orphan",
    )


class MoodEntry(Base):
    __tablename__ = "mood_entries"

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "entry_date",
            name="uq_mood_entries_user_date",
        ),
    )

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id = Column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    mood = Column(
        Enum(*MOOD_VALUES, name="mood_type", native_enum=False),
        nullable=False,
    )
    note = Column(String(500), nullable=True)
    entry_date = Column(
        Date,
        nullable=False,
        default=date.today,
        index=True,
    )
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Uuid, primary_key=True, default=uuid.uuid4)
    recipient_id = Column(
        Uuid,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category = Column(
        Enum(
            *NOTIFICATION_CATEGORIES,
            name="notification_category",
            native_enum=False,
        ),
        nullable=False,
    )
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    read_at = Column(DateTime, nullable=True, default=None)
    created_at = Column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
    )

    recipient = relationship(
        "User",
        back_populates="notifications",
    )
