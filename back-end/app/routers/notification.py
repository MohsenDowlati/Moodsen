from typing import Annotated
from uuid import UUID

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models import User
from app.schemas.notification import (
    DeleteNotificationResponse,
    DeleteAllNotificationsResponse,
    MarkAllReadResponse,
    NotificationListResponse,
    NotificationResponse,
)
from app.services.notification_service import NotificationService
from app.services.redis_service import notification_pubsub

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
    return notification_service.get_list_response(
        db=db,
        user_id=current_user.id,
        page=page,
        page_size=page_size,
    )


@router.get("/stream")
async def stream_my_notifications(
    request: Request,
    current_user: Annotated[User, Depends(get_current_user)],
):
    async def events():
        client = None
        pubsub = None
        try:
            client, pubsub = await notification_pubsub(current_user.id)
            yield "event: connected\ndata: {}\n\n"
            while not await request.is_disconnected():
                message = await pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=15.0,
                )
                if message is None:
                    yield ": heartbeat\n\n"
                    continue
                payload = message.get("data", "{}")
                try:
                    parsed = json.loads(payload)
                    event_name = parsed.get("event", "changed")
                except (TypeError, json.JSONDecodeError):
                    event_name = "changed"
                yield f"event: notification\ndata: {json.dumps({'event': event_name})}\n\n"
                await asyncio.sleep(0)
        finally:
            if pubsub is not None:
                await pubsub.unsubscribe(f"notifications:{current_user.id}")
                await pubsub.aclose()
            if client is not None:
                await client.aclose()

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
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
    "",
    response_model=DeleteAllNotificationsResponse,
)
def delete_all_my_notifications(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return {
        "deleted_count": notification_service.delete_all_for_user(
            db, current_user.id
        )
    }


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
