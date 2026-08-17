from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies.auth import get_current_user
from app.middleware import (
    clear_auth_cookies,
    create_access_token,
    set_auth_cookies,
)
from app.models import User
from app.schemas.user import (
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
    UserUpdate,
)
from app.services.user_service import UserService

router = APIRouter()
user_service = UserService()


@router.post(
    "/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserRegister,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    try:
        user = user_service.register(db, payload)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(error),
        )

    token = create_access_token(str(user.id), user.email)
    set_auth_cookies(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/auth/login",
    response_model=TokenResponse,
)
def login(
    payload: UserLogin,
    response: Response,
    db: Annotated[Session, Depends(get_db)],
):
    user = user_service.authenticate(
        db=db,
        email=str(payload.email),
        password=payload.password,
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    token = create_access_token(str(user.id), user.email)
    set_auth_cookies(response, token)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": user,
    }


@router.post(
    "/auth/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
def logout(response: Response):
    clear_auth_cookies(response)
    response.status_code = status.HTTP_204_NO_CONTENT



@router.get(
    "/me",
    response_model=UserResponse,
)
def get_my_profile(
    current_user: Annotated[User, Depends(get_current_user)],
):
    return current_user


@router.patch(
    "/me",
    response_model=UserResponse,
)
def update_my_profile(
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_current_user)],
):
    return user_service.update(
        db=db,
        user=current_user,
        payload=payload,
    )
