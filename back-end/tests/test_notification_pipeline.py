from datetime import date, datetime, timedelta

import pytest

from app.models import MoodEntry, NotificationOutbox, User
from app.schemas.mood import MoodEntryCreateOrUpdate
from app.services.kafka_service import _validate_notification_event
from app.services.mood_service import MoodEntryService


def test_notification_event_contract_validation():
    from uuid import uuid4

    event = {
        "version": 1,
        "event_id": str(uuid4()),
        "recipient_id": str(uuid4()),
        "category": "reminder",
        "title": "Check in",
        "message": "Record your mood",
        "dedupe_key": "reminder:user:2026-09-08",
        "occurred_at": datetime(2026, 9, 8, 12, 0).isoformat(),
    }
    assert _validate_notification_event(event) == event

    with pytest.raises(ValueError):
        _validate_notification_event({**event, "version": 2})


def test_milestone_is_enqueued_with_mood_transaction(db_session, monkeypatch):
    today = date(2026, 9, 8)
    monkeypatch.setattr(
        "app.services.mood_service.local_today",
        lambda _timezone=None: today,
    )
    monkeypatch.setattr(
        "app.services.kafka_service.publish_streak_updated",
        lambda *_args, **_kwargs: None,
    )
    user = User(
        email="streak@example.com",
        password_hash="hash",
        full_name="Streak User",
        timezone="UTC",
    )
    db_session.add(user)
    db_session.flush()
    for offset in range(1, 7):
        db_session.add(
            MoodEntry(
                user_id=user.id,
                mood="calm",
                entry_date=today - timedelta(days=offset),
            )
        )
    db_session.commit()

    MoodEntryService().create_or_update_today(
        db_session,
        user,
        MoodEntryCreateOrUpdate(mood="joyful", note=None),
    )

    outbox = db_session.query(NotificationOutbox).one()
    assert outbox.payload["category"] == "streak_milestone"
    assert outbox.payload["metadata"]["streak_days"] == 7


def test_current_streak_uses_explicit_user_day():
    entries = [
        MoodEntry(entry_date=date(2026, 9, 7), mood="calm"),
        MoodEntry(entry_date=date(2026, 9, 6), mood="calm"),
    ]
    service = MoodEntryService()
    assert service.calculate_current_streak(entries, date(2026, 9, 8)) == 2
    assert service.calculate_current_streak(entries, date(2026, 9, 9)) == 0
