import os
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo


APP_TIMEZONE = ZoneInfo(os.getenv("APP_TIMEZONE", "UTC"))


def get_timezone(timezone_name: str | None = None) -> ZoneInfo:
    if not timezone_name:
        return APP_TIMEZONE
    try:
        return ZoneInfo(timezone_name)
    except (KeyError, ValueError):
        return APP_TIMEZONE


def local_now(timezone_name: str | None = None) -> datetime:
    return datetime.now(get_timezone(timezone_name))


def local_today(timezone_name: str | None = None) -> date:
    return local_now(timezone_name).date()


def utc_bounds_for_local_day(
    day: date,
    timezone_name: str | None = None,
) -> tuple[datetime, datetime]:
    timezone_value = get_timezone(timezone_name)
    start = datetime.combine(day, time.min, tzinfo=timezone_value)
    end = start + timedelta(days=1)
    return start.astimezone(timezone.utc).replace(tzinfo=None), end.astimezone(
        timezone.utc
    ).replace(tzinfo=None)
