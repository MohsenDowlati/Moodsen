from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.schemas.mood import (
    MoodEntryCreateOrUpdate,
    MoodEntryResponse,
    MoodEntryUpdate,
    MoodStatisticsResponse,
    PaginatedMoodEntriesResponse,
)
from app.services.mood_service import MoodEntryService

router = APIRouter()
mood_entry_service = MoodEntryService()


@router.get(
    "/today",
    response_model=MoodEntryResponse | None,
)
def get_today_mood_entry(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return mood_entry_service.get_today_entry(
        db=db,
        user_id=current_user.id,
    )


@router.post(
    "/today",
    response_model=MoodEntryResponse,
)
def create_or_update_today_mood_entry(
    payload: MoodEntryCreateOrUpdate,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry, created = mood_entry_service.create_or_update_today(
        db=db,
        user=current_user,
        payload=payload,
    )

    response.status_code = (
        status.HTTP_201_CREATED if created else status.HTTP_200_OK
    )
    return entry


@router.get(
    "/recent",
    response_model=list[MoodEntryResponse],
)
def get_recent_mood_entries(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: Annotated[
        int,
        Query(
            ge=1,
            le=365,
            description="Number of days to include, including today.",
        ),
    ] = 7,
):
    return mood_entry_service.get_recent_entries(
        db=db,
        user_id=current_user.id,
        days=days,
    )


@router.get(
    "/month/{year}/{month}",
    response_model=list[MoodEntryResponse],
)
def get_month_mood_entries(
    year: Annotated[int, Path(ge=1, le=9999)],
    month: Annotated[int, Path(ge=1, le=12)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return mood_entry_service.get_month_entries(
        db=db,
        user_id=current_user.id,
        year=year,
        month=month,
    )


@router.get(
    "/statistics",
    response_model=MoodStatisticsResponse,
)
def get_all_time_statistics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entries = mood_entry_service.get_all_entries(
        db=db,
        user_id=current_user.id,
    )
    return mood_entry_service.build_statistics(entries)


@router.get(
    "/statistics/recent",
    response_model=MoodStatisticsResponse,
)
def get_recent_statistics(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    days: Annotated[int, Query(ge=1, le=365)] = 30,
):
    entries = mood_entry_service.get_recent_entries(
        db=db,
        user_id=current_user.id,
        days=days,
    )
    return mood_entry_service.build_statistics(entries)


@router.get(
    "/statistics/month/{year}/{month}",
    response_model=MoodStatisticsResponse,
)
def get_month_statistics(
    year: Annotated[int, Path(ge=1, le=9999)],
    month: Annotated[int, Path(ge=1, le=12)],
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entries = mood_entry_service.get_month_entries(
        db=db,
        user_id=current_user.id,
        year=year,
        month=month,
    )
    return mood_entry_service.build_statistics(entries)


@router.get(
    "/",
    response_model=PaginatedMoodEntriesResponse,
)
def get_all_mood_entries(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
):
    try:
        return mood_entry_service.get_paginated_result(
            db=db,
            user_id=current_user.id,
            page=page,
            page_size=page_size,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        )


@router.get(
    "/{mood_entry_id}",
    response_model=MoodEntryResponse,
)
def get_mood_entry_by_id(
    mood_entry_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry = mood_entry_service.get_by_id_for_user(
        db=db,
        user_id=current_user.id,
        mood_entry_id=mood_entry_id,
    )

    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mood entry not found",
        )

    return entry


@router.patch(
    "/{mood_entry_id}",
    response_model=MoodEntryResponse,
)
def update_mood_entry(
    mood_entry_id: UUID,
    payload: MoodEntryUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry = mood_entry_service.get_by_id_for_user(
        db=db,
        user_id=current_user.id,
        mood_entry_id=mood_entry_id,
    )

    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mood entry not found",
        )

    return mood_entry_service.update_entry(
        db=db,
        user=current_user,
        entry=entry,
        payload=payload,
    )


@router.delete(
    "/{mood_entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_mood_entry(
    mood_entry_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    entry = mood_entry_service.get_by_id_for_user(
        db=db,
        user_id=current_user.id,
        mood_entry_id=mood_entry_id,
    )

    if entry is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mood entry not found",
        )

    mood_entry_service.delete_entry(
        db=db,
        user=current_user,
        entry=entry,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)
