import json
import logging
import os
import threading
import time
from datetime import datetime
from uuid import UUID

from app.database import SessionLocal
from app.services.leaderboard_service import LeaderboardService
from app.services.notification_outbox_service import (
    NOTIFICATION_TOPIC,
    NotificationOutboxService,
)
from app.services.notification_service import NotificationService

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_STREAK_TOPIC", "moodsen.streak.updated")
KAFKA_NOTIFICATION_DLQ_TOPIC = os.getenv(
    "KAFKA_NOTIFICATION_DLQ_TOPIC",
    "moodsen.notification.dead-letter",
)
KAFKA_ENABLED = os.getenv("KAFKA_ENABLED", "false").lower() in {"1", "true", "yes"}


def publish_streak_updated(user_id: UUID, streak_days: int) -> None:
    if not KAFKA_ENABLED:
        return
    try:
        from kafka import KafkaProducer

        producer = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            request_timeout_ms=1000,
        )
        producer.send(
            KAFKA_TOPIC,
            {
                "user_id": str(user_id),
                "streak_days": streak_days,
                "score": streak_days,
                "occurred_at": datetime.utcnow().isoformat(),
            },
        )
        producer.flush(timeout=1)
        producer.close()
    except Exception:
        logger.warning("Unable to publish streak event to Kafka", exc_info=True)


def start_leaderboard_consumer() -> threading.Thread | None:
    if not KAFKA_ENABLED:
        return None

    def consume() -> None:
        try:
            from kafka import KafkaConsumer

            consumer = KafkaConsumer(
                KAFKA_TOPIC,
                bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
                group_id="moodsen-leaderboard",
                auto_offset_reset="earliest",
                enable_auto_commit=True,
                value_deserializer=lambda value: json.loads(value.decode("utf-8")),
            )
            for message in consumer:
                payload = message.value
                db = SessionLocal()
                try:
                    LeaderboardService().upsert_score(
                        db,
                        UUID(payload["user_id"]),
                        int(payload["streak_days"]),
                        int(payload.get("score", payload["streak_days"])),
                    )
                finally:
                    db.close()
        except Exception:
            logger.warning("Leaderboard Kafka consumer stopped", exc_info=True)

    thread = threading.Thread(target=consume, name="leaderboard-kafka-consumer", daemon=True)
    thread.start()
    return thread


def relay_notification_outbox_once() -> int:
    if not KAFKA_ENABLED:
        return 0

    from kafka import KafkaProducer

    service = NotificationOutboxService()
    db = SessionLocal()
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
        key_serializer=lambda value: value.encode("utf-8"),
        value_serializer=lambda value: json.dumps(value).encode("utf-8"),
        acks="all",
        retries=5,
    )
    published = 0
    try:
        for row in service.pending(db):
            try:
                producer.send(
                    row.topic,
                    key=row.event_key,
                    value=row.payload,
                ).get(timeout=10)
                service.mark_published(db, row)
                published += 1
            except Exception as error:
                db.rollback()
                row = db.get(type(row), row.id)
                if row is not None:
                    service.mark_failed(db, row, error)
                logger.warning("Notification outbox publish failed", exc_info=True)
        return published
    finally:
        producer.flush(timeout=5)
        producer.close()
        db.close()


def start_notification_outbox_relay() -> threading.Thread | None:
    if not KAFKA_ENABLED:
        return None

    def relay() -> None:
        while True:
            try:
                relay_notification_outbox_once()
            except Exception:
                logger.exception("Notification outbox relay iteration failed")
            time.sleep(1)

    thread = threading.Thread(
        target=relay,
        name="notification-outbox-relay",
        daemon=True,
    )
    thread.start()
    return thread


def _validate_notification_event(payload: dict) -> dict:
    required = {
        "event_id",
        "recipient_id",
        "category",
        "title",
        "message",
        "dedupe_key",
        "occurred_at",
    }
    missing = required.difference(payload)
    if missing:
        raise ValueError(f"Missing notification event fields: {sorted(missing)}")
    if payload.get("version") != 1:
        raise ValueError("Unsupported notification event version")
    if payload["category"] not in {"reminder", "streak_milestone", "system"}:
        raise ValueError("Unsupported notification category")
    if not isinstance(payload["title"], str) or not payload["title"].strip():
        raise ValueError("Notification title must be a non-empty string")
    if len(payload["title"].strip()) > 255:
        raise ValueError("Notification title is too long")
    if not isinstance(payload["message"], str) or not payload["message"].strip():
        raise ValueError("Notification message must be a non-empty string")
    if (
        not isinstance(payload["dedupe_key"], str)
        or not payload["dedupe_key"]
        or len(payload["dedupe_key"]) > 255
    ):
        raise ValueError("Invalid notification dedupe key")
    if not isinstance(payload.get("metadata", {}), dict):
        raise ValueError("Notification metadata must be an object")
    datetime.fromisoformat(payload["occurred_at"])
    UUID(str(payload["event_id"]))
    UUID(str(payload["recipient_id"]))
    return payload


def start_notification_consumer() -> threading.Thread | None:
    if not KAFKA_ENABLED:
        return None

    def consume() -> None:
        from kafka import KafkaConsumer, KafkaProducer, TopicPartition

        consumer = KafkaConsumer(
            NOTIFICATION_TOPIC,
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            group_id="moodsen-notifications",
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )
        dlq = KafkaProducer(
            bootstrap_servers=KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda value: json.dumps(value).encode("utf-8"),
            acks="all",
        )
        for message in consumer:
            db = SessionLocal()
            try:
                payload = _validate_notification_event(message.value)
                NotificationService().create_notification(
                    db=db,
                    recipient_id=payload["recipient_id"],
                    category=payload["category"],
                    title=payload["title"],
                    message=payload["message"],
                    source_event_id=UUID(payload["event_id"]),
                    dedupe_key=payload["dedupe_key"],
                )
                consumer.commit()
            except (KeyError, TypeError, ValueError) as error:
                db.rollback()
                logger.error("Invalid notification event: %s", error)
                dlq.send(
                    KAFKA_NOTIFICATION_DLQ_TOPIC,
                    {
                        "payload": message.value,
                        "error": str(error),
                        "failed_at": datetime.utcnow().isoformat(),
                    },
                ).get(timeout=10)
                consumer.commit()
            except Exception:
                db.rollback()
                logger.exception("Transient notification consumption failure")
                consumer.seek(
                    TopicPartition(message.topic, message.partition),
                    message.offset,
                )
                time.sleep(2)
            finally:
                db.close()

    thread = threading.Thread(
        target=consume,
        name="notification-kafka-consumer",
        daemon=True,
    )
    thread.start()
    return thread
