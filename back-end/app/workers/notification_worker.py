import logging
import signal
import threading

from app.database import Base, engine
from app.scheduler import start_scheduler, stop_scheduler
from app.services.kafka_service import (
    start_leaderboard_consumer,
    start_notification_consumer,
    start_notification_outbox_relay,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    Base.metadata.create_all(bind=engine)
    stopped = threading.Event()

    def stop(_signum=None, _frame=None) -> None:
        stopped.set()

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)

    start_scheduler()
    start_notification_outbox_relay()
    start_notification_consumer()
    start_leaderboard_consumer()
    logger.info("Moodsen notification worker started")
    try:
        while not stopped.wait(1):
            pass
    finally:
        stop_scheduler()
        logger.info("Moodsen notification worker stopped")


if __name__ == "__main__":
    main()
