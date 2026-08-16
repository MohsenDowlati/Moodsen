from apscheduler.schedulers.background import BackgroundScheduler

from app.jobs.notification_job import run_notification_jobs


scheduler = BackgroundScheduler(
    timezone="UTC",
)


def start_scheduler() -> None:

    scheduler.add_job(
        run_notification_jobs,
        trigger="interval",
        minutes=1,
        id="notification_jobs",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
