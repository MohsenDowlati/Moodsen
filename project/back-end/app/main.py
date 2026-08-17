import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app.middleware import FRONTEND_ORIGIN, JWTAuthMiddleware
from app.routers.mood import router as mood_router
from app.routers.notification import router as notification_router
from app.routers.user import router as users_router
from app.scheduler import start_scheduler, stop_scheduler


def _is_testing() -> bool:
    return os.getenv("TESTING", "").lower() in {"1", "true", "yes"}


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)

    if not _is_testing():
        start_scheduler()

    yield

    if not _is_testing():
        stop_scheduler()


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
    allow_methods=["*"],
    allow_headers=["*"],
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
