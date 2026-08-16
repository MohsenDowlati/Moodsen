from datetime import datetime, time

from app.models import User
from app.services.reminder_service import ReminderService


def test_send_daily_reminders_for_matching_time(db_session, monkeypatch):
    fixed_now = datetime(2026, 8, 15, 9, 0, 0)

    class FixedDateTime(datetime):
        @classmethod
        def utcnow(cls):
            return fixed_now

        @classmethod
        def combine(cls, d, t, tzinfo=None):
            return datetime.combine(d, t, tzinfo)

    monkeypatch.setattr(
        "app.services.reminder_service.datetime",
        FixedDateTime,
    )
    monkeypatch.setattr(
        "app.services.reminder_service.date",
        fixed_now.date().__class__,
    )

    user = User(
        email="remind@example.com",
        password_hash="hash",
        full_name="Remind User",
        daily_reminders_enabled=True,
        reminder_time=time(9, 0),
    )
    db_session.add(user)
    db_session.commit()

    service = ReminderService()
    created = service.send_daily_reminders(db_session)
    assert created == 1

    # Idempotent for the same day/category
    created_again = service.send_daily_reminders(db_session)
    assert created_again == 0


def test_skip_reminder_when_mood_already_logged(
    db_session,
    monkeypatch,
):
    fixed_now = datetime(2026, 8, 15, 9, 0, 0)

    class FixedDateTime(datetime):
        @classmethod
        def utcnow(cls):
            return fixed_now

    monkeypatch.setattr(
        "app.services.reminder_service.datetime",
        FixedDateTime,
    )

    user = User(
        email="done@example.com",
        password_hash="hash",
        full_name="Done User",
        daily_reminders_enabled=True,
        reminder_time=time(9, 0),
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    from app.models import MoodEntry

    db_session.add(
        MoodEntry(
            user_id=user.id,
            mood="calm",
            entry_date=fixed_now.date(),
        )
    )
    db_session.commit()

    created = ReminderService().send_daily_reminders(db_session)
    assert created == 0
