import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.middleware import FRONTEND_ORIGIN, JWTAuthMiddleware
from app.routers.mood import router as mood_router
from app.routers.notification import router as notification_router
from app.routers.user import router as users_router
from app.routers.leaderboard import router as leaderboard_router


def _is_testing() -> bool:
    return os.getenv("TESTING", "").lower() in {"1", "true", "yes"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)

    yield


app = FastAPI(
    title="Moodsen API",
    description="API for users, authentication, mood entries, and mood statistics.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)

app.add_middleware(JWTAuthMiddleware)


@app.get(
    "/health",
    tags=["Health"],
)
def health_check():
    return {
        "status": "ok",
        "message": "Mood Tracker API is running",
    }


app.include_router(
    users_router,
    prefix="",
    tags=["Users"],
)

app.include_router(
    mood_router,
    prefix="/moods",
    tags=["Mood Entries"],
)

app.include_router(
    notification_router,
    prefix="/notifications",
    tags=["Notifications"],
)

app.include_router(
    leaderboard_router,
    prefix="/leaderboard",
    tags=["Leaderboard"],
)
