import logging
import azure.functions as func
import structlog

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import (
    health,
    dashboards,
    query,
    permissions,
    users,
    auth,
    admin,
    activity,
    actions,
    generate,
)

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

# ── FastAPI application ───────────────────────────────────────
fastapi_app = FastAPI(title="SOC Portal API", version="0.1.0")

fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        [settings.FRONTEND_ORIGIN] if settings.ENVIRONMENT == "production" else ["*"]
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

fastapi_app.include_router(health.router, prefix="/api")
fastapi_app.include_router(auth.router)  # auth routes already carry /api prefix
fastapi_app.include_router(dashboards.router, prefix="/api")
fastapi_app.include_router(query.router, prefix="/api")
fastapi_app.include_router(permissions.router, prefix="/api")
fastapi_app.include_router(users.router, prefix="/api")
fastapi_app.include_router(admin.router, prefix="/api")
fastapi_app.include_router(activity.router, prefix="/api")
fastapi_app.include_router(actions.router, prefix="/api")
fastapi_app.include_router(generate.router, prefix="/api")

# ── Azure Functions ASGI wrapper (Flex Consumption) ──────────
# Exposes fastapi_app as an Azure Function HTTP trigger.
# For local development use: uvicorn function_app:fastapi_app --port 7071
app = func.AsgiFunctionApp(
    app=fastapi_app,
    http_auth_level=func.AuthLevel.ANONYMOUS,
)
