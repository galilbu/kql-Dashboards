import logging
import structlog

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import health, dashboards, query, permissions, users

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

app = FastAPI(title="KQL Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        [settings.FRONTEND_ORIGIN] if settings.ENVIRONMENT == "production" else ["*"]
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api")
app.include_router(dashboards.router, prefix="/api")
app.include_router(query.router, prefix="/api")
app.include_router(permissions.router, prefix="/api")
app.include_router(users.router, prefix="/api")
