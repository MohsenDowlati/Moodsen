from datetime import datetime
from uuid import UUID

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models import LeaderboardScore, User


class LeaderboardService:

    def upsert_score(
        self,
        db: Session,
        user_id: UUID,
        streak_days: int,
        score: int | None = None,
    ) -> LeaderboardScore:
        row = db.query(LeaderboardScore).filter(
            LeaderboardScore.user_id == user_id
        ).first()
        if row is None:
            row = LeaderboardScore(user_id=user_id)
            db.add(row)
        row.streak_days = max(streak_days, 0)
        row.score = max(score if score is not None else streak_days, 0)
        row.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(row)
        return row

    def _rows(self, db: Session):
        return (
            db.query(LeaderboardScore, User)
            .join(User, User.id == LeaderboardScore.user_id)
            .order_by(desc(LeaderboardScore.score), desc(LeaderboardScore.streak_days), User.full_name.asc())
            .all()
        )

    def get_leaderboard(
        self,
        db: Session,
        current_user_id: UUID,
        limit: int = 50,
    ) -> dict:
        # Backfill missing materialized rows so newly registered users are visible.
        users = db.query(User).all()
        existing = {
            row.user_id
            for row in db.query(LeaderboardScore).all()
        }
        missing = [
            LeaderboardScore(
                user_id=user.id,
                score=user.current_streak,
                streak_days=user.current_streak,
            )
            for user in users
            if user.id not in existing
        ]
        if missing:
            db.add_all(missing)
            db.commit()

        rows = self._rows(db)
        rank_by_id = {user.id: index + 1 for index, (_, user) in enumerate(rows)}
        entries = []
        for score, user in rows[:limit]:
            entries.append(
                {
                    "rank": rank_by_id[user.id],
                    "user_id": user.id,
                    "full_name": user.full_name,
                    "score": score.score,
                    "streak_days": score.streak_days,
                    "is_current_user": user.id == current_user_id,
                    "updated_at": score.updated_at,
                }
            )

        current = next(
            (
                {
                    "rank": rank_by_id[user.id],
                    "user_id": user.id,
                    "full_name": user.full_name,
                    "score": score.score,
                    "streak_days": score.streak_days,
                    "is_current_user": True,
                    "updated_at": score.updated_at,
                }
                for score, user in rows
                if user.id == current_user_id
            ),
            None,
        )
        if current is None:
            raise ValueError("Current user is missing from leaderboard")
        return {
            "items": entries,
            "current_user": current,
            "total_users": len(rows),
        }
