from calendar import monthrange
from collections import Counter
from datetime import date, timedelta
from math import ceil
from uuid import UUID

from sqlalchemy.orm import Session

from app.models import MoodEntry
from app.models import User
from app.schemas.mood import (
    MoodEntryCreateOrUpdate,
    MoodEntryUpdate,
)

MOOD_SCORES: dict[str, int] = {
    "angry": 1,
    "sad": 2,
    "anxious": 3,
    "neutral": 4,
    "calm": 5,
    "motivated": 6,
    "joyful": 7,
}

WEEKDAY_NAMES = [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
]


class MoodEntryService:
    def get_today_entry(
        self,
        db: Session,
        user_id: UUID,
    ) -> MoodEntry | None:
        """Return the authenticated user's mood entry for today, if present."""
        return (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user_id,
                MoodEntry.entry_date == date.today(),
            )
            .first()
        )

    def get_by_id_for_user(
        self,
        db: Session,
        user_id: UUID,
        mood_entry_id: UUID,
    ) -> MoodEntry | None:
        """
        Return an entry only when it belongs to `user_id`.

        This is important: never query an entry solely by ID for endpoints
        accessible to normal users. Otherwise, one user could modify or read
        another user's mood entry by guessing its UUID.
        """
        return (
            db.query(MoodEntry)
            .filter(
                MoodEntry.id == mood_entry_id,
                MoodEntry.user_id == user_id,
            )
            .first()
        )

    def create_or_update_today(
        self,
        db: Session,
        user: User,
        payload: MoodEntryCreateOrUpdate,
    ) -> tuple[MoodEntry, bool]:
        """
        Create today's mood entry, or update it if it already exists.

        Returns:
            tuple[MoodEntry, bool]:
                - `(entry, True)`  when a new entry was created
                - `(entry, False)` when today's existing entry was updated

        This implements a "one mood entry per user per day" rule.
        Ideally, also enforce this in PostgreSQL with a unique constraint on:

            (user_id, entry_date)
        """
        today = date.today()

        entry = (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user.id,
                MoodEntry.entry_date == today,
            )
            .first()
        )

        created = entry is None
        normalized_note = payload.note.strip() if payload.note else None

        if created:
            entry = MoodEntry(
                user_id=user.id,
                mood=payload.mood,
                note=normalized_note,
                entry_date=today,
            )
            db.add(entry)

        else:
            entry.mood = payload.mood
            entry.note = normalized_note

        db.commit()
        db.refresh(entry)

        self.update_user_streaks(db, user)

        return entry, created

    def update_entry(
        self,
        db: Session,
        user: User,
        entry: MoodEntry,
        payload: MoodEntryUpdate,
    ) -> MoodEntry:
        """
        Update values explicitly supplied in the request body.

        Before calling this method, find `entry` with `get_by_id_for_user()`.
        That ensures the entry belongs to the authenticated user.
        """
        update_data = payload.model_dump(exclude_unset=True)

        for field_name, value in update_data.items():
            if field_name == "note" and value is not None:
                # An empty/whitespace-only note becomes NULL in PostgreSQL.
                value = value.strip() or None

            setattr(entry, field_name, value)

        db.commit()
        db.refresh(entry)

        # Needed particularly if entry_date is allowed to change in UserUpdate.
        self.update_user_streaks(db, user)

        return entry

    def delete_entry(
        self,
        db: Session,
        user: User,
        entry: MoodEntry,
    ) -> None:
        """
        Delete an already ownership-checked mood entry.

        Call this only after getting the entry via `get_by_id_for_user`.
        """
        db.delete(entry)
        db.commit()

        # A deletion can break a current or historical streak.
        self.update_user_streaks(db, user)

    def get_recent_entries(
        self,
        db: Session,
        user_id: UUID,
        days: int,
    ) -> list[MoodEntry]:
        """
        Return entries from the last `days` calendar days, inclusive of today.

        Example for days=7:

            [today - 6 days, ..., yesterday, today]
        """
        if days < 1:
            raise ValueError("Days must be at least 1")

        end_date = date.today()
        start_date = end_date - timedelta(days=days - 1)

        return (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user_id,
                MoodEntry.entry_date >= start_date,
                MoodEntry.entry_date <= end_date,
            )
            .order_by(MoodEntry.entry_date.desc())
            .all()
        )

    def get_month_entries(
        self,
        db: Session,
        user_id: UUID,
        year: int,
        month: int,
    ) -> list[MoodEntry]:
        """Return all entries belonging to a user in the specified month."""
        if not 1 <= month <= 12:
            raise ValueError("Month must be between 1 and 12")

        first_day = date(year, month, 1)
        last_day = date(year, month, monthrange(year, month)[1])

        return (
            db.query(MoodEntry)
            .filter(
                MoodEntry.user_id == user_id,
                MoodEntry.entry_date >= first_day,
                MoodEntry.entry_date <= last_day,
            )
            .order_by(MoodEntry.entry_date.asc())
            .all()
        )

    def get_all_entries(
        self,
        db: Session,
        user_id: UUID,
    ) -> list[MoodEntry]:
        """
        Return every mood entry for the user in chronological order.

        Used for all-time statistics and streak calculations.
        """
        return (
            db.query(MoodEntry)
            .filter(MoodEntry.user_id == user_id)
            .order_by(MoodEntry.entry_date.asc())
            .all()
        )

    def get_all_entries_paginated(
        self,
        db: Session,
        user_id: UUID,
        page: int,
        page_size: int,
    ) -> tuple[list[MoodEntry], int]:
        """
        Return one page of entries and the total number of entries.

        Pagination is 1-indexed:
        - page=1 gives the first page.
        """
        if page < 1:
            raise ValueError("Page must be at least 1")

        if page_size < 1:
            raise ValueError("Page size must be at least 1")

        query = (
            db.query(MoodEntry)
            .filter(MoodEntry.user_id == user_id)
        )

        total = query.count()

        entries = (
            query.order_by(MoodEntry.entry_date.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        return entries, total

    def get_paginated_result(
        self,
        db: Session,
        user_id: UUID,
        page: int,
        page_size: int,
    ) -> dict:
        """
        Return paginated entries plus metadata convenient for API responses.
        """
        entries, total = self.get_all_entries_paginated(
            db=db,
            user_id=user_id,
            page=page,
            page_size=page_size,
        )

        total_pages = ceil(total / page_size) if total > 0 else 0

        return {
            "items": entries,
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_previous": page > 1,
        }

    def calculate_current_streak(
        self,
        entries: list[MoodEntry],
    ) -> int:
        """
        Calculate the active consecutive-day streak.

        A current streak requires an entry today.

        Examples:
        - entries today, yesterday, two days ago: 3
        - entry yesterday but none today: 0
        """
        entry_dates = {entry.entry_date for entry in entries}

        current_day = date.today()

        if current_day not in entry_dates:
            return 0

        streak = 0

        while current_day in entry_dates:
            streak += 1
            current_day -= timedelta(days=1)

        return streak

    def calculate_longest_streak(
        self,
        entries: list[MoodEntry],
    ) -> int:
        """Calculate the largest sequence of consecutive entry dates."""
        if not entries:
            return 0

        # A set ensures duplicate dates cannot affect the calculation.
        sorted_dates = sorted({entry.entry_date for entry in entries})

        longest_streak = 1
        current_streak = 1

        for previous_date, current_date in zip(
            sorted_dates,
            sorted_dates[1:],
        ):
            if current_date == previous_date + timedelta(days=1):
                current_streak += 1
                longest_streak = max(longest_streak, current_streak)
            else:
                current_streak = 1

        return longest_streak

    def update_user_streaks(
        self,
        db: Session,
        user: User,
    ) -> User:
        """
        Recalculate and save streak fields held on the User model.

        Your User table contains:

            current_streak
            longest_streak
        """
        entries = self.get_all_entries(db, user.id)

        user.current_streak = self.calculate_current_streak(entries)
        user.longest_streak = self.calculate_longest_streak(entries)

        db.commit()
        db.refresh(user)

        return user

    def most_common_mood(
        self,
        entries: list[MoodEntry],
    ) -> str | None:
        """
        Return the most frequently recorded mood.

        When multiple moods have the same frequency, alphabetical order gives
        deterministic behavior.
        """
        if not entries:
            return None

        counts = Counter(entry.mood for entry in entries)

        return sorted(
            counts.items(),
            key=lambda item: (-item[1], item[0]),
        )[0][0]

    def calculate_average_mood_score(
        self,
        entries: list[MoodEntry],
    ) -> float | None:
        """
        Compute the mean of the explicit MOOD_SCORES mapping.

        This is an application-defined measure, not an intrinsic mathematical
        average of qualitative mood labels.
        """
        if not entries:
            return None

        scores = [
            MOOD_SCORES[entry.mood]
            for entry in entries
            if entry.mood in MOOD_SCORES
        ]

        if not scores:
            return None

        return round(sum(scores) / len(scores), 2)

    def calculate_best_weekday(
        self,
        entries: list[MoodEntry],
    ) -> str | None:
        """
        Return the weekday having the largest average mood score.

        If scores tie, the earliest weekday is selected:
        Monday, then Tuesday, ..., then Sunday.
        """
        if not entries:
            return None

        scores_by_weekday: dict[int, list[int]] = {
            weekday: [] for weekday in range(7)
        }

        for entry in entries:
            mood_score = MOOD_SCORES.get(entry.mood)

            if mood_score is not None:
                weekday_index = entry.entry_date.weekday()
                scores_by_weekday[weekday_index].append(mood_score)

        weekday_averages: list[tuple[int, float]] = []

        for weekday_index, scores in scores_by_weekday.items():
            if scores:
                weekday_averages.append(
                    (weekday_index, sum(scores) / len(scores))
                )

        if not weekday_averages:
            return None

        # max retains the first matching element in a tie. Since indexes occur
        # from 0 to 6, Monday wins a tie against later weekdays.
        best_weekday_index, _ = max(
            weekday_averages,
            key=lambda item: item[1],
        )

        return WEEKDAY_NAMES[best_weekday_index]

    def get_mood_distribution(
        self,
        entries: list[MoodEntry],
    ) -> dict[str, int]:
        """
        Count entries per mood category.

        All known moods are returned, including categories with zero entries.
        This makes frontend chart rendering predictable.
        """
        counts = Counter(entry.mood for entry in entries)

        return {
            mood: counts.get(mood, 0)
            for mood in MOOD_SCORES
        }

    def build_statistics(
        self,
        entries: list[MoodEntry],
    ) -> dict:
        """
        Build a reusable analytics result for any entry range:
        weekly, monthly, yearly, or all-time.
        """
        return {
            "total_entries": len(entries),
            "current_streak": self.calculate_current_streak(entries),
            "longest_streak": self.calculate_longest_streak(entries),
            "most_common_mood": self.most_common_mood(entries),
            "average_mood_score": self.calculate_average_mood_score(entries),
            "best_weekday": self.calculate_best_weekday(entries),
            "mood_distribution": self.get_mood_distribution(entries),
        }
