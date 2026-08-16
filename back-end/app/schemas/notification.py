from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

NotificationCategory = Literal[
    "reminder",
    "streak_milestone",
    "system",
]


class MarkAllReadResponse(BaseModel):
    updated_count: int


class DeleteNotificationResponse(BaseModel):
    message: str


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    recipient_id: UUID
    category: NotificationCategory
    title: str
    message: str
    read_at: datetime | None
    created_at: datetime


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    total: int
    unread_count: int
    page: int
    page_size: int
    total_pages: int


class CustomNotificationCreate(BaseModel):
    recipient_id: UUID
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)


class BroadcastNotificationCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    message: str = Field(min_length=1)
