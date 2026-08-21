from datetime import datetime

from apscheduler.schedulers.background import BackgroundScheduler

from app.jobs.notification_job import run_notification_jobs
from app.time_utils import APP_TIMEZONE


scheduler = BackgroundScheduler(
    timezone=APP_TIMEZONE,
)


def start_scheduler() -> None:
    if scheduler.running:
        return

    scheduler.add_job(
        run_notification_jobs,
        trigger="interval",
        minutes=1,
        id="notification_jobs",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
        next_run_time=datetime.now(APP_TIMEZONE),
    )

    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
