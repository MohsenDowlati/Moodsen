from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

MoodType = Literal[
    "joyful",
    "calm",
    "motivated",
    "neutral",
    "anxious",
    "sad",
    "angry",
]


class MoodEntryCreateOrUpdate(BaseModel):
    mood: MoodType
    note: str | None = Field(default=None, max_length=500)


class MoodEntryUpdate(BaseModel):
    mood: MoodType | None = None
    note: str | None = Field(default=None, max_length=500)


class MoodEntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    mood: MoodType
    note: str | None
    entry_date: date
    created_at: datetime


class PaginatedMoodEntriesResponse(BaseModel):
    items: list[MoodEntryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool


class MoodStatisticsResponse(BaseModel):
    total_entries: int
    current_streak: int
    longest_streak: int
    most_common_mood: MoodType | None
    average_mood_score: float | None
    best_weekday: str | None
    mood_distribution: dict[str, int]
