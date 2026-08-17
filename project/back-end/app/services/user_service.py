from datetime import datetime
from uuid import UUID

from pwdlib import PasswordHash
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

        for field, value in update_data.items():
            setattr(user, field, value)

        user.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(user)

        return user
