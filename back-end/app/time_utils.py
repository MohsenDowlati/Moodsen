import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "UTC"))


def local_now() -> datetime:
    return datetime.now(APP_TIMEZONE)


def local_today() -> date:
    return local_now().date()


def utc_bounds_for_local_day(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=APP_TIMEZONE)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc).replace(tzinfo=None), end.astimezone(
        timezone.utc
    ).replace(tzinfo=None)
