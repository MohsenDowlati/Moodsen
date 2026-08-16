import re
from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_must_have_letter_and_digit(cls, v: str) -> str:
        if not re.search(r"[A-Za-z]", v):
            raise ValueError("password must contain at least one letter")
        if not re.search(r"\d", v):
            raise ValueError("password must contain at least one number")
        return v
    full_name: str = Field(min_length=1, max_length=100)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=100)
    dark_mode_enabled: bool | None = None
    daily_reminders_enabled: bool | None = None
    reminder_time: time | None = None


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    full_name: str

    dark_mode_enabled: bool
    daily_reminders_enabled: bool
    reminder_time: time

    current_streak: int
    longest_streak: int

    joined_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
