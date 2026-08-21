import os
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import MoodEntry, Notification, User
from app.services.notification_service import NotificationService
from app.services.mood_service import MoodEntryService
from app.time_utils import local_now, local_today, utc_bounds_for_local_day

STREAK_MILESTONE_DAYS = int(os.getenv("STREAK_MILESTONE_DAYS", "7"))


class ReminderService:
    def __init__(self) -> None:
        self.notification_service = NotificationService()
        self.mood_service = MoodEntryService()

    def user_has_mood_entry_today(
        self,
        db: Session,
        user_id: UUID,
    ) -> bool:
        entry = (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user_id,
                MoodEntry.entry_date == local_today(),
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
        today_start, tomorrow_start = utc_bounds_for_local_day(local_today())

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
        now = local_now()
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

            # Treat the configured time as a local wall-clock time. Allow a
            # delayed scheduler run to deliver the reminder later that day;
            # the daily dedupe check still guarantees one notification.
            reminder_time = user.reminder_time
            if (current_hour, current_minute) < (
                reminder_time.hour,
                reminder_time.minute,
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

        users = db.query(User).all()
        notifications_created = 0

        for user in users:
            # Streak columns can be stale after imports, manual edits, or a
            # process restart. Recalculate from entries before evaluating a
            # milestone so the job is self-healing.
            entries = self.mood_service.get_all_entries(db, user.id)
            current_streak = self.mood_service.calculate_current_streak(entries)
            longest_streak = self.mood_service.calculate_longest_streak(entries)
            if (
                user.current_streak != current_streak
                or user.longest_streak != longest_streak
            ):
                user.current_streak = current_streak
                user.longest_streak = longest_streak
                db.commit()

            if current_streak < STREAK_MILESTONE_DAYS or (
                current_streak % STREAK_MILESTONE_DAYS != 0
            ):
                continue
            if not self.user_has_mood_entry_today(db, user.id):
                # A milestone is emitted when the user completes the
                # milestone day, not repeatedly while yesterday's streak is
                # still visible.
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
                    f"{current_streak}-day mood streak!"
                ),
            )
            notifications_created += 1

        return notifications_created
