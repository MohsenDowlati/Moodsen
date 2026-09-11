import os
from datetime import datetime, timedelta
from uuid import UUID, uuid4

from sqlalchemy.orm import Session

from app.models import NotificationOutbox

NOTIFICATION_TOPIC = os.getenv(
    "KAFKA_NOTIFICATION_TOPIC",
    "moodsen.notification.requested",
)


class NotificationOutboxService:
    def enqueue(
        self,
        db: Session,
        recipient_id: UUID,
        category: str,
        title: str,
        message: str,
        dedupe_key: str,
        metadata: dict | None = None,
        commit: bool = True,
    ) -> NotificationOutbox:
        existing = db.query(NotificationOutbox).filter(
            NotificationOutbox.dedupe_key == dedupe_key
        ).first()
        if existing is not None:
            return existing

        event_id = uuid4()
        occurred_at = datetime.utcnow()
        row = NotificationOutbox(
            id=event_id,
            topic=NOTIFICATION_TOPIC,
            event_key=str(recipient_id),
            dedupe_key=dedupe_key,
            payload={
                "version": 1,
                "event_id": str(event_id),
                "recipient_id": str(recipient_id),
                "category": category,
                "title": title.strip(),
                "message": message.strip(),
                "dedupe_key": dedupe_key,
                "metadata": metadata or {},
                "occurred_at": occurred_at.isoformat(),
            },
        )
        db.add(row)
        if commit:
            db.commit()
            db.refresh(row)
        else:
            db.flush()
        return row

    def pending(self, db: Session, limit: int = 100) -> list[NotificationOutbox]:
        return (
            db.query(NotificationOutbox)
            .filter(
                NotificationOutbox.published_at.is_(None),
                NotificationOutbox.next_attempt_at <= datetime.utcnow(),
            )
            .order_by(NotificationOutbox.created_at.asc())
            .limit(limit)
            .all()
        )

    def mark_published(self, db: Session, row: NotificationOutbox) -> None:
        row.published_at = datetime.utcnow()
        row.last_error = None
        db.commit()

    def mark_failed(
        self,
        db: Session,
        row: NotificationOutbox,
        error: Exception,
    ) -> None:
        row.attempts += 1
        delay = min(2 ** min(row.attempts, 8), 300)
        row.next_attempt_at = datetime.utcnow() + timedelta(seconds=delay)
        row.last_error = str(error)[:2000]
        db.commit()

    def purge_published(self, db: Session, retention_days: int = 7) -> int:
        cutoff = datetime.utcnow() - timedelta(days=retention_days)
        deleted = (
            db.query(NotificationOutbox)
            .filter(
                NotificationOutbox.published_at.is_not(None),
                NotificationOutbox.published_at < cutoff,
            )
            .delete(synchronize_session=False)
        )
        db.commit()
        return deleted
