from fastapi import FastAPI

from app.errors import register_exception_handlers
from app.routers.health import router as health_router
from app.routers.tables import router as tables_router

app = FastAPI(title="SCMAUTO ERP API")

register_exception_handlers(app)
app.include_router(health_router)
app.include_router(tables_router)
