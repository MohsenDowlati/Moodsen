from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: UUID
    full_name: str
    score: int
    streak_days: int
    is_current_user: bool = False
    updated_at: datetime


class LeaderboardResponse(BaseModel):
    items: list[LeaderboardEntry]
    current_user: LeaderboardEntry
    total_users: int
