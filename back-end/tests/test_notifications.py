from app.models import Notification
from app.services.notification_service import NotificationService
from tests.conftest import csrf_headers_from_response, register_user


def test_list_and_mark_notifications(client, auth_headers, db_session):
    me = client.get("/me")
    user_id = me.json()["id"]

    service = NotificationService()
    service.create_notification(
        db=db_session,
        recipient_id=user_id,
        category="system",
        title="Hello",
        message="Welcome",
    )
    service.create_notification(
        db=db_session,
        recipient_id=user_id,
        category="reminder",
        title="Check in",
        message="Record your mood",
    )

    listing = client.get("/notifications")
    assert listing.status_code == 200
    body = listing.json()
    assert body["total"] == 2
    assert body["unread_count"] == 2
    assert body["page"] == 1
    assert len(body["items"]) == 2

    notification_id = body["items"][0]["id"]

    marked = client.patch(
        f"/notifications/{notification_id}/read",
        headers=auth_headers,
    )
    assert marked.status_code == 200
    assert marked.json()["read_at"] is not None

    all_read = client.patch("/notifications/read-all", headers=auth_headers)
    assert all_read.status_code == 200
    assert all_read.json()["updated_count"] >= 1

    listing_after = client.get("/notifications")
    assert listing_after.json()["unread_count"] == 0


def test_delete_notification(client, auth_headers, db_session):
    me = client.get("/me")
    user_id = me.json()["id"]

    notification = NotificationService().create_notification(
        db=db_session,
        recipient_id=user_id,
        category="system",
        title="Temp",
        message="Delete me",
    )

    deleted = client.delete(
        f"/notifications/{notification.id}",
        headers=auth_headers,
    )
    assert deleted.status_code == 200
    assert deleted.json()["message"] == "Notification deleted"

    assert client.get("/notifications").json()["total"] == 0


def test_clear_all_notifications(client, auth_headers, db_session):
    user_id = client.get("/me").json()["id"]
    service = NotificationService()
    for index in range(3):
        service.create_notification(
            db=db_session,
            recipient_id=user_id,
            category="system",
            title=f"Notice {index}",
            message="Clear me",
        )

    response = client.delete("/notifications", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"deleted_count": 3}
    assert client.get("/notifications").json()["total"] == 0


def test_kafka_event_idempotency(db_session):
    from uuid import uuid4

    from app.models import User

    user = User(
        email="events@example.com",
        password_hash="hash",
        full_name="Event User",
    )
    db_session.add(user)
    db_session.commit()
    event_id = uuid4()
    service = NotificationService()

    first = service.create_notification(
        db_session,
        user.id,
        "system",
        "Once",
        "Only once",
        source_event_id=event_id,
        dedupe_key=f"system:{event_id}",
    )
    second = service.create_notification(
        db_session,
        user.id,
        "system",
        "Once",
        "Only once",
        source_event_id=event_id,
        dedupe_key=f"system:{event_id}",
    )

    assert first.id == second.id
    assert db_session.query(Notification).count() == 1


def test_cannot_read_another_users_notification(client, db_session):
    first = register_user(client, email="owner@example.com")
    owner_id = first.json()["user"]["id"]

    notification = NotificationService().create_notification(
        db=db_session,
        recipient_id=owner_id,
        category="system",
        title="Private",
        message="Only for owner",
    )

    client.post("/auth/logout")
    second = register_user(client, email="other@example.com", full_name="Other")
    headers = csrf_headers_from_response(second)

    response = client.patch(
        f"/notifications/{notification.id}/read",
        headers=headers,
    )
    assert response.status_code == 404
