from datetime import datetime
from math import ceil
from uuid import UUID, uuid4

from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.models import Notification, NotificationOutbox, User
from app.services.notification_outbox_service import NotificationOutboxService
from app.services.redis_service import (
    cache_get,
    cache_set,
    invalidate_notifications,
    notification_cache_version,
)


class NotificationService:
    def create_notification(
        self,
        db: Session,
        recipient_id: UUID | str,
        category: str,
        title: str,
        message: str,
        source_event_id: UUID | None = None,
        dedupe_key: str | None = None,
    ) -> Notification:
        if source_event_id is not None:
            existing = db.query(Notification).filter(
                Notification.source_event_id == source_event_id
            ).first()
            if existing is not None:
                return existing
        if dedupe_key:
            existing = db.query(Notification).filter(
                Notification.dedupe_key == dedupe_key
            ).first()
            if existing is not None:
                return existing

        notification = Notification(
            recipient_id=UUID(str(recipient_id)),
            category=category,
            title=title.strip(),
            message=message.strip(),
            source_event_id=source_event_id,
            dedupe_key=dedupe_key,
        )

        db.add(notification)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            existing = None
            if source_event_id is not None:
                existing = db.query(Notification).filter(
                    Notification.source_event_id == source_event_id
                ).first()
            if existing is None and dedupe_key:
                existing = db.query(Notification).filter(
                    Notification.dedupe_key == dedupe_key
                ).first()
            if existing is not None:
                return existing
            raise
        db.refresh(notification)
        invalidate_notifications(notification.recipient_id, "created")

        return notification

    def get_by_id_for_user(
        self,
        db: Session,
        notification_id: UUID,
        user_id: UUID,
    ) -> Notification | None:
        return (
            db.query(Notification)
            .filter(
                Notification.id == notification_id,
                Notification.recipient_id == user_id,
            )
            .first()
        )

    def get_for_user(
        self,
        db: Session,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Notification], int, int]:
        if page < 1:
            raise ValueError("Page must be at least 1")

        if page_size < 1 or page_size > 100:
            raise ValueError("Page size must be between 1 and 100")

        base_query = db.query(Notification).filter(
            Notification.recipient_id == user_id
        )

        total = base_query.count()

        unread_count = (
            base_query.filter(Notification.read_at.is_(None)).count()
        )

        notifications = (
            base_query.order_by(Notification.created_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return notifications, total, unread_count

    def get_list_response(
        self,
        db: Session,
        user_id: UUID,
        page: int = 1,
        page_size: int = 20,
    ) -> dict:
        version = notification_cache_version(user_id)
        cache_key = f"notifications:{user_id}:v{version}:p{page}:s{page_size}"
        cached = cache_get(cache_key)
        if cached is not None:
            return cached

        notifications, total, unread_count = self.get_for_user(
            db, user_id, page, page_size
        )
        result = self.build_list_response(
            notifications, total, unread_count, page, page_size
        )
        serializable = {
            **result,
            "items": [
                {
                    "id": item.id,
                    "recipient_id": item.recipient_id,
                    "category": item.category,
                    "title": item.title,
                    "message": item.message,
                    "read_at": item.read_at,
                    "created_at": item.created_at,
                }
                for item in notifications
            ],
        }
        cache_set(cache_key, serializable)
        return serializable

    def mark_as_read(
        self,
        db: Session,
        notification: Notification,
    ) -> Notification:
        if notification.read_at is None:
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)
            invalidate_notifications(notification.recipient_id, "read")

        return notification

    def mark_all_as_read(
        self,
        db: Session,
        user_id: UUID,
    ) -> int:
        updated_count = (
            db.query(Notification)
            .filter(
                Notification.recipient_id == user_id,
                Notification.read_at.is_(None),
            )
            .update(
                {Notification.read_at: datetime.utcnow()},
                synchronize_session=False,
            )
        )

        db.commit()
        if updated_count:
            invalidate_notifications(user_id, "read-all")
        return updated_count

    def delete_notification(
        self,
        db: Session,
        notification: Notification,
    ) -> None:
        recipient_id = notification.recipient_id
        db.delete(notification)
        db.commit()
        invalidate_notifications(recipient_id, "deleted")

    def delete_all_for_user(self, db: Session, user_id: UUID) -> int:
        deleted_count = (
            db.query(Notification)
            .filter(Notification.recipient_id == user_id)
            .delete(synchronize_session=False)
        )
        db.commit()
        if deleted_count:
            invalidate_notifications(user_id, "cleared")
        return deleted_count

    def create_system_notification_for_user(
        self,
        db: Session,
        recipient_id: UUID,
        title: str,
        message: str,
    ) -> NotificationOutbox:
        event_id = uuid4()
        return NotificationOutboxService().enqueue(
            db=db,
            recipient_id=recipient_id,
            category="system",
            title=title,
            message=message,
            dedupe_key=f"system:{recipient_id}:{event_id}",
        )

    def create_system_notification_for_all_users(
        self,
        db: Session,
        title: str,
        message: str,
    ) -> int:
        users = db.query(User.id).all()

        if not users:
            return 0

        broadcast_id = uuid4()
        outbox_service = NotificationOutboxService()
        for user_id, in users:
            outbox_service.enqueue(
                db=db,
                recipient_id=user_id,
                category="system",
                title=title,
                message=message,
                dedupe_key=f"broadcast:{broadcast_id}:{user_id}",
                metadata={"broadcast_id": str(broadcast_id)},
                commit=False,
            )
        db.commit()
        return len(users)

    @staticmethod
    def build_list_response(
        notifications: list[Notification],
        total: int,
        unread_count: int,
        page: int,
        page_size: int,
    ) -> dict:
        total_pages = ceil(total / page_size) if total > 0 else 0

        return {
            "items": notifications,
            "total": total,
            "unread_count": unread_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
