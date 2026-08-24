import json
import logging
import os
import threading
from datetime import datetime
from uuid import UUID

from app.database import SessionLocal
from app.services.leaderboard_service import LeaderboardService

logger = logging.getLogger(__name__)

KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "localhost:9092")
KAFKA_TOPIC = os.getenv("KAFKA_STREAK_TOPIC", "moodsen.streak.updated")
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
