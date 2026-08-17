from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.schemas.notification import (
    DeleteNotificationResponse,
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.notification_service import NotificationService

router = APIRouter()
notification_service = NotificationService()


@router.get(
    "",
    response_model=NotificationListResponse,
)
def get_my_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    notifications, total, unread_count = notification_service.get_for_user(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )

    return notification_service.build_list_response(
        notifications=notifications,
        total=total,
        unread_count=unread_count,
        page=page,
        page_size=page_size,
    )


@router.patch(
    "/read-all",
    response_model=MarkAllReadResponse,
)
def mark_all_my_notifications_as_read(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    updated_count = notification_service.mark_all_as_read(
        db=db,
        user_id=current_user.id,
    )
    return {"updated_count": updated_count}


@router.patch(
    "/{notification_id}/read",
    response_model=NotificationResponse,
)
def mark_my_notification_as_read(
    notification_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    notification = notification_service.get_by_id_for_user(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    return notification_service.mark_as_read(
        db=db,
        notification=notification,
    )


@router.delete(
    "/{notification_id}",
    response_model=DeleteNotificationResponse,
)
def delete_my_notification(
    notification_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    notification = notification_service.get_by_id_for_user(
        db=db,
        notification_id=notification_id,
        user_id=current_user.id,
    )

    if notification is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found",
        )

    notification_service.delete_notification(
        db=db,
        notification=notification,
    )

    return {"message": "Notification deleted"}
