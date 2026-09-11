"""Add notification outbox, idempotency, and user timezone."""

from alembic import op
import sqlalchemy as sa
import os

revision = "20260908_01"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if "users" not in inspector.get_table_names():
        from app.database import Base
        from app import models  # noqa: F401

        Base.metadata.create_all(bind=op.get_bind())
        return

    default_timezone = os.getenv("APP_TIMEZONE", "UTC")
    op.add_column(
        "users",
        sa.Column(
            "timezone",
            sa.String(length=64),
            nullable=False,
            server_default=default_timezone,
        ),
    )
    op.add_column(
        "notifications",
        sa.Column("source_event_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "notifications",
        sa.Column("dedupe_key", sa.String(length=255), nullable=True),
    )
    op.create_unique_constraint(
        "uq_notifications_source_event_id", "notifications", ["source_event_id"]
    )
    op.create_unique_constraint(
        "uq_notifications_dedupe_key", "notifications", ["dedupe_key"]
    )
    op.create_table(
        "notification_outbox",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("topic", sa.String(length=255), nullable=False),
        sa.Column("event_key", sa.String(length=255), nullable=False),
        sa.Column("dedupe_key", sa.String(length=255), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("next_attempt_at", sa.DateTime(), nullable=False),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dedupe_key", name="uq_notification_outbox_dedupe_key"),
    )
    op.create_index(
        "ix_notification_outbox_next_attempt_at",
        "notification_outbox",
        ["next_attempt_at"],
    )
    op.create_index(
        "ix_notification_outbox_published_at",
        "notification_outbox",
        ["published_at"],
    )


def downgrade() -> None:
    op.drop_table("notification_outbox")
    op.drop_constraint("uq_notifications_dedupe_key", "notifications", type_="unique")
    op.drop_constraint(
        "uq_notifications_source_event_id", "notifications", type_="unique"
    )
    op.drop_column("notifications", "dedupe_key")
    op.drop_column("notifications", "source_event_id")
    op.drop_column("users", "timezone")
