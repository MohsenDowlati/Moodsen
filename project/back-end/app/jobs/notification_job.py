from app.database import SessionLocal
from app.services.reminder_service import ReminderService


def run_notification_jobs() -> None:
    db = SessionLocal()

    try:
        reminder_service = ReminderService()

        reminder_count = reminder_service.send_daily_reminders(db)
        streak_count = reminder_service.send_streak_milestones(db)

        print(
            "Notification job completed: "
            f"{reminder_count} reminders, "
            f"{streak_count} streak milestones."
        )

    except Exception as error:
        db.rollback()
        print(f"Notification job failed: {error}")

    finally:
        db.close()
