from datetime import date, timedelta

from app.models import MoodEntry, User
from app.services.mood_service import MoodEntryService
from tests.conftest import csrf_headers_from_response, register_user


def test_create_and_get_today_mood(client, auth_headers):
    created = client.post(
        "/moods/today",
        json={"mood": "calm", "note": " Feeling good "},
        headers=auth_headers,
    )
    assert created.status_code == 201
    body = created.json()
    assert body["mood"] == "calm"
    assert body["note"] == "Feeling good"
    assert body["entry_date"] == date.today().isoformat()

    today = client.get("/moods/today")
    assert today.status_code == 200
    assert today.json()["id"] == body["id"]


def test_update_today_mood_returns_200(client, auth_headers):
    first = client.post(
        "/moods/today",
        json={"mood": "sad"},
        headers=auth_headers,
    )
    assert first.status_code == 201

    second = client.post(
        "/moods/today",
        json={"mood": "joyful", "note": "Better"},
        headers=auth_headers,
    )
    assert second.status_code == 200
    assert second.json()["mood"] == "joyful"
    assert second.json()["id"] == first.json()["id"]


def test_mood_statistics_and_pagination(client, auth_headers):
    client.post(
        "/moods/today",
        json={"mood": "motivated"},
        headers=auth_headers,
    )

    stats = client.get("/moods/statistics")
    assert stats.status_code == 200
    data = stats.json()
    assert data["total_entries"] == 1
    assert data["current_streak"] == 1
    assert data["most_common_mood"] == "motivated"
    assert data["mood_distribution"]["motivated"] == 1

    page = client.get("/moods/")
    assert page.status_code == 200
    assert page.json()["total"] == 1
    assert len(page.json()["items"]) == 1


def test_delete_mood_entry(client, auth_headers):
    created = client.post(
        "/moods/today",
        json={"mood": "anxious"},
        headers=auth_headers,
    )
    mood_id = created.json()["id"]

    deleted = client.delete(f"/moods/{mood_id}", headers=auth_headers)
    assert deleted.status_code == 204

    missing = client.get(f"/moods/{mood_id}")
    assert missing.status_code == 404


def test_user_cannot_access_another_users_mood(client):
    first = register_user(client, email="one@example.com")
    headers_one = csrf_headers_from_response(first)

    created = client.post(
        "/moods/today",
        json={"mood": "neutral"},
        headers=headers_one,
    )
    mood_id = created.json()["id"]

    client.post("/auth/logout")
    second = register_user(client, email="two@example.com", full_name="Two")
    assert second.status_code == 201

    response = client.get(f"/moods/{mood_id}")
    assert response.status_code == 404


def test_streak_calculations(db_session):
    service = MoodEntryService()
    user = User(
        email="streak@example.com",
        password_hash="hash",
        full_name="Streak User",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)

    today = date.today()
    for offset in range(3):
        db_session.add(
            MoodEntry(
                user_id=user.id,
                mood="calm",
                entry_date=today - timedelta(days=offset),
            )
        )
    db_session.commit()

    entries = service.get_all_entries(db_session, user.id)
    assert service.calculate_current_streak(entries) == 3
    assert service.calculate_longest_streak(entries) == 3

    service.update_user_streaks(db_session, user)
    assert user.current_streak == 3
    assert user.longest_streak == 3
