from datetime import datetime
from time import sleep
from uuid import UUID

from pwdlib import PasswordHash
from sqlalchemy.exc import OperationalError
from sqlalchemy import update as sql_update
from sqlalchemy.orm import Session

from app.models import User
from app.schemas.user import UserRegister, UserUpdate

password_hasher = PasswordHash.recommended()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(plain_password: str, password_hash: str) -> bool:
    return password_hasher.verify(plain_password, password_hash)

class UserService:
    def get_by_id(self, db: Session, user_id: UUID) -> User | None:
        return (
            db.query(User)
            .filter(User.id == user_id)
            .first()
        )

    def get_by_email(self, db: Session, email: str) -> User | None:
        return (
            db.query(User)
            .filter(User.email == email)
            .first()
        )

    def register(self, db: Session, payload: UserRegister) -> User:

        email = str(payload.email).lower().strip()

        existing_user = self.get_by_email(db, email)

        if existing_user is not None:
            raise ValueError("An account with this email already exists")

        user = User(
            email=email,
            password_hash=hash_password(payload.password),
            full_name=payload.full_name.strip(),
        )

        db.add(user)
        db.commit()
        db.refresh(user)

        return user

    def authenticate(
        self,
        db: Session,
        email: str,
        password: str,
    ) -> User | None:

        user = self.get_by_email(db, email.lower().strip())

        if user is None:
            return None

        if not verify_password(password, user.password_hash):
            return None

        return user

    def update(
        self,
        db: Session,
        user: User,
        payload: UserUpdate,
    ) -> User:
        update_data = payload.model_dump(exclude_unset=True)
        if not update_data:
            return user

        for attempt in range(5):
            try:
                values = {
                    **update_data,
                    "updated_at": datetime.utcnow(),
                }
                # Issue a narrow SQL UPDATE instead of flushing the whole
                # possibly-stale ORM object. This lets the scheduler update
                # streak columns concurrently without overwriting them.
                db.execute(
                    sql_update(User)
                    .where(User.id == user.id)
                    .values(**values)
                )
                db.commit()
                db.expire(user)
                db.refresh(user)
                return user
            except OperationalError as error:
                db.rollback()

                # MariaDB error 1020 means another transaction changed the
                # row after this session read it. Refresh the object and
                # reapply only this request's fields before retrying.
                original = getattr(error, "orig", None)
                error_code = original.args[0] if getattr(original, "args", ()) else None
                if error_code != 1020 or attempt == 4:
                    raise

                sleep(0.05 * (attempt + 1))

        raise RuntimeError("Unable to update user after concurrent changes")
