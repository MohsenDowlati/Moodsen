from datetime import datetime
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import Notification, User


class NotificationService:
    def create_notification(
        self,
        db: Session,
        recipient_id: UUID | str,
        category: str,
        title: str,
        message: str,
    ) -> Notification:
        notification = Notification(
            recipient_id=UUID(str(recipient_id)),
            category=category,
            title=title.strip(),
            message=message.strip(),
        )

        db.add(notification)
        db.commit()
        db.refresh(notification)

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

    def mark_as_read(
        self,
        db: Session,
        notification: Notification,
    ) -> Notification:
        if notification.read_at is None:
            notification.read_at = datetime.utcnow()
            db.commit()
            db.refresh(notification)

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
        return updated_count

    def delete_notification(
        self,
        db: Session,
        notification: Notification,
    ) -> None:
        db.delete(notification)
        db.commit()

    def create_system_notification_for_user(
        self,
        db: Session,
        recipient_id: UUID,
        title: str,
        message: str,
    ) -> Notification:
        return self.create_notification(
            db=db,
            recipient_id=recipient_id,
            category="system",
            title=title,
            message=message,
        )

    def create_system_notification_for_all_users(
        self,
        db: Session,
        title: str,
        message: str,
    ) -> int:
        users = db.query(User.id).all()

        notifications = [
            Notification(
                recipient_id=user_id,
                category="system",
                title=title.strip(),
                message=message.strip(),
            )
            for (user_id,) in users
        ]

        if not notifications:
            return 0

        db.bulk_save_objects(notifications)
        db.commit()

        return len(notifications)

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
