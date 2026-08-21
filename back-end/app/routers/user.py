from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.middleware import (
    clear_auth_cookies,
    create_access_token,
    set_auth_cookies,
)
from app.models import User
from app.schemas.user import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
    ReminderSettingsUpdate,
)
from app.services.user_service import UserService

router = APIRouter()
user_service = UserService()


@router.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserRegister,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        user = user_service.register(db, payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )

    token = create_access_token(str(user.id), user.email)
    set_auth_cookies(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/auth/login",
    response_model=TokenResponse,
)
def login(
    payload: UserLogin,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    user = user_service.authenticate(
        db=db,
        email=str(payload.email),
        password=payload.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(str(user.id), user.email)
    set_auth_cookies(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(response: Response):
    clear_auth_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT



@router.get(
    "/me",
    response_model=dict,
)
def get_my_profile(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    # Keep the session bootstrap response useful to the web client while
    # retaining the dedicated /moods and /notifications endpoints.
    from app.services.mood_service import MoodEntryService
    from app.services.notification_service import NotificationService

    moods = MoodEntryService().get_recent_entries(db, current_user.id, 30)
    notifications, _, _ = NotificationService().get_for_user(
        db, current_user.id, page=1, page_size=100
    )
    return {
        # Legacy top-level identity fields remain for older clients.
        "id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "dark_mode_enabled": current_user.dark_mode_enabled,
        "daily_reminders_enabled": current_user.daily_reminders_enabled,
        "reminder_time": current_user.reminder_time,
        "current_streak": current_user.current_streak,
        "longest_streak": current_user.longest_streak,
        "joined_at": current_user.joined_at,
        "updated_at": current_user.updated_at,
        "user": current_user,
        "entries": moods,
        "notifications": notifications,
    }


@router.post("/settings/reminder", response_model=UserResponse)
def update_reminder_settings(
    payload: ReminderSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    update_data: dict = {}
    if payload.enabled is not None:
        update_data["daily_reminders_enabled"] = payload.enabled
    if payload.hour is not None:
        current_time = current_user.reminder_time
        update_data["reminder_time"] = current_time.replace(
            hour=payload.hour, minute=0, second=0, microsecond=0
        )

    return user_service.update(
        db=db,
        user=current_user,
        payload=UserUpdate(**update_data),
    )


@router.patch(
    "/me",
    response_model=UserResponse,
)
def update_my_profile(
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return user_service.update(
        db=db,
        user=current_user,
        payload=payload,
    )
