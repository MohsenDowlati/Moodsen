import os
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import MoodEntry, Notification, NotificationOutbox, User
from app.services.mood_service import MoodEntryService
from app.services.notification_outbox_service import NotificationOutboxService
from app.time_utils import local_now, local_today, utc_bounds_for_local_day

STREAK_MILESTONE_DAYS = int(os.getenv("STREAK_MILESTONE_DAYS", "7"))


class ReminderService:
    def __init__(self) -> None:
        self.outbox_service = NotificationOutboxService()
        self.mood_service = MoodEntryService()

    def user_has_mood_entry_today(
        self,
        db: Session,
        user: User,
    ) -> bool:
        return (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user.id,
                MoodEntry.entry_date == local_today(user.timezone),
            )
            .first()
            is not None
        )

    def notification_already_sent_today(
        self,
        db: Session,
        recipient_id: UUID,
        category: str,
        timezone_name: str,
    ) -> bool:
        today = local_today(timezone_name)
        today_start, tomorrow_start = utc_bounds_for_local_day(
            today,
            timezone_name,
        )
        return (
            db.query(Notification)
            .filter(
                Notification.recipient_id == recipient_id,
                Notification.category == category,
                Notification.created_at >= today_start,
                Notification.created_at < tomorrow_start,
            )
            .first()
            is not None
        )

    def send_daily_reminders(self, db: Session) -> int:
        users = (
            db.query(User)
            .filter(User.daily_reminders_enabled.is_(True))
            .all()
        )
        queued = 0
        for user in users:
            if user.reminder_time is None:
                continue
            now = local_now(user.timezone)
            if (now.hour, now.minute) < (
                user.reminder_time.hour,
                user.reminder_time.minute,
            ):
                continue
            if self.user_has_mood_entry_today(db, user):
                continue
            if self.notification_already_sent_today(
                db,
                user.id,
                "reminder",
                user.timezone,
            ):
                continue

            dedupe_key = f"reminder:{user.id}:{now.date().isoformat()}"
            if db.query(NotificationOutbox).filter(
                NotificationOutbox.dedupe_key == dedupe_key
            ).first() is not None:
                continue
            self.outbox_service.enqueue(
                db=db,
                recipient_id=user.id,
                category="reminder",
                title="Daily mood check-in",
                message="Take a moment to record how you feel today.",
                dedupe_key=dedupe_key,
                metadata={
                    "local_date": now.date().isoformat(),
                    "timezone": user.timezone,
                },
            )
            queued += 1
        return queued

    def send_streak_milestones(self, db: Session) -> int:
        """Compatibility backfill; normal milestones are mood-triggered."""
        if STREAK_MILESTONE_DAYS < 1:
            raise ValueError("STREAK_MILESTONE_DAYS must be at least 1")
        queued = 0
        for user in db.query(User).all():
            entries = self.mood_service.get_all_entries(db, user.id)
            current_streak = self.mood_service.calculate_current_streak(
                entries,
                local_today(user.timezone),
            )
            if (
                current_streak < STREAK_MILESTONE_DAYS
                or current_streak % STREAK_MILESTONE_DAYS != 0
                or not self.user_has_mood_entry_today(db, user)
            ):
                continue
            local_date = local_today(user.timezone)
            dedupe_key = (
                f"streak:{user.id}:{current_streak}:{local_date.isoformat()}"
            )
            if db.query(NotificationOutbox).filter(
                NotificationOutbox.dedupe_key == dedupe_key
            ).first() is not None:
                continue
            self.outbox_service.enqueue(
                db=db,
                recipient_id=user.id,
                category="streak_milestone",
                title="Congratulations!",
                message=f"You have reached a {current_streak}-day mood streak!",
                dedupe_key=dedupe_key,
                metadata={
                    "streak_days": current_streak,
                    "local_date": local_date.isoformat(),
                    "timezone": user.timezone,
                },
            )
            queued += 1
        return queued
