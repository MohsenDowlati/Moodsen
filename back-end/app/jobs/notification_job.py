import logging

from app.database import SessionLocal
from app.services.reminder_service import ReminderService

logger = logging.getLogger(__name__)


def run_notification_jobs() -> tuple[int, int]:
    """Run notification work once and return created counts.

    The return value makes the job directly testable and keeps all commits
    inside the service transaction boundaries.
    """
    db = SessionLocal()

    try:
        reminder_service = ReminderService()

        reminder_count = reminder_service.send_daily_reminders(db)
        streak_count = reminder_service.send_streak_milestones(db)

        logger.info(
            "Notification job completed: %s reminders, %s streak milestones",
            reminder_count,
            streak_count,
        )
        return reminder_count, streak_count

    except Exception as error:
        db.rollback()
        logger.exception("Notification job failed")
        raise RuntimeError("Notification job failed") from error

    finally:
        db.close()
