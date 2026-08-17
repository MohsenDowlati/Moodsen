import os
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import MoodEntry, Notification, User
from app.services.notification_service import NotificationService

STREAK_MILESTONE_DAYS = int(os.getenv("STREAK_MILESTONE_DAYS", "7"))


class ReminderService:
    def __init__(self) -> None:
        self.notification_service = NotificationService()

    def user_has_mood_entry_today(
        self,
        db: Session,
        user_id: UUID,
    ) -> bool:
        entry = (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user_id,
                MoodEntry.entry_date == date.today(),
            )
            .first()
        )
        return entry is not None

    def notification_already_sent_today(
        self,
        db: Session,
        recipient_id: UUID,
        category: str,
    ) -> bool:
        today_start = datetime.combine(date.today(), datetime.min.time())
        tomorrow_start = today_start + timedelta(days=1)

        notification = (
            db.query(Notification)
            .filter(
                Notification.recipient_id == recipient_id,
                Notification.category == category,
                Notification.created_at >= today_start,
                Notification.created_at < tomorrow_start,
            )
            .first()
        )
        return notification is not None

    def send_daily_reminders(self, db: Session) -> int:
        now = datetime.utcnow()
        current_hour = now.hour
        current_minute = now.minute

        users = (
            db.query(User)
            .filter(User.daily_reminders_enabled.is_(True))
            .all()
        )

        notifications_created = 0

        for user in users:
            if user.reminder_time is None:
                continue

            if (
                user.reminder_time.hour != current_hour
                or user.reminder_time.minute != current_minute
            ):
                continue

            if self.user_has_mood_entry_today(db, user.id):
                continue

            if self.notification_already_sent_today(
                db=db,
                recipient_id=user.id,
                category="reminder",
            ):
                continue

            self.notification_service.create_notification(
                db=db,
                recipient_id=user.id,
                category="reminder",
                title="Daily mood check-in",
                message="Take a moment to record how you feel today.",
            )
            notifications_created += 1

        return notifications_created

    def send_streak_milestones(self, db: Session) -> int:
        if STREAK_MILESTONE_DAYS < 1:
            raise ValueError("STREAK_MILESTONE_DAYS must be at least 1")

        users = db.query(User).filter(User.current_streak > 0).all()
        notifications_created = 0

        for user in users:
            if user.current_streak % STREAK_MILESTONE_DAYS != 0:
                continue

            if self.notification_already_sent_today(
                db=db,
                recipient_id=user.id,
                category="streak_milestone",
            ):
                continue

            self.notification_service.create_notification(
                db=db,
                recipient_id=user.id,
                category="streak_milestone",
                title="Congratulations!",
                message=(
                    f"You have reached a "
                    f"{user.current_streak}-day mood streak!"
                ),
            )
            notifications_created += 1

        return notifications_created
