import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from dotenv import load_dotenv
from fastapi import  HTTPException, Request, Response, status
from pwdlib import PasswordHash
from starlette.middleware.base import BaseHTTPMiddleware

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "300")
)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").rstrip("/")
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "false").lower() == "true"

ACCESS_COOKIE_NAME = "access_token"
CSRF_COOKIE_NAME = "csrf_token"

def create_access_token(user_id: str, email: str) -> str:
    if not JWT_SECRET:
        raise RuntimeError("JWT_SECRET must be configured")
    now = datetime.now(timezone.utc)

    payload = {
        "sub": user_id,       # subject: user ID
        "email": email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
    }

    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict[str, Any]:
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication is not configured",
        )
    try:
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALGORITHM],
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token has expired",
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token",
        )


def set_auth_cookies(response: Response, access_token: str) -> None:

    csrf_token = secrets.token_urlsafe(32)

    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=csrf_token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/")
    response.delete_cookie(CSRF_COOKIE_NAME, path="/")



class JWTAuthMiddleware(BaseHTTPMiddleware):

    public_paths = {
        "/",
        "/auth/register",
        "/auth/login",
        "/auth/logout",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/health"
    }

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        if request.method == "OPTIONS":
            return await call_next(request)

        if path in self.public_paths:
            return await call_next(request)

        token = request.cookies.get(ACCESS_COOKIE_NAME)

        if not token:
            return Response(
                content='{"detail":"Not authenticated"}',
                status_code=status.HTTP_401_UNAUTHORIZED,
                media_type="application/json",
            )

        try:
            payload = decode_access_token(token)

            request.state.user = {
                "id": payload["sub"],
                "email": payload.get("email"),
            }

        except HTTPException as exc:
            return Response(
                content=f'{{"detail":"{exc.detail}"}}',
                status_code=exc.status_code,
                media_type="application/json",
            )

        if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
            csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
            csrf_header = request.headers.get("X-CSRF-Token")

            if (
                not csrf_cookie
                or not csrf_header
                or not hmac.compare_digest(csrf_cookie, csrf_header)
            ):
                return Response(
                    content='{"detail":"Invalid or missing CSRF token"}',
                    status_code=status.HTTP_403_FORBIDDEN,
                    media_type="application/json",
                )

        return await call_next(request)

