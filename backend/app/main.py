from fastapi import FastAPI

from app.errors import register_exception_handlers
from app.routers.health import router as health_router
from app.routers.incoming import router as incoming_router
from app.routers.inventory_ops import router as inventory_ops_router
from app.routers.po import router as po_router
from app.routers.shipping import router as shipping_router
from app.routers.tables import router as tables_router

app = FastAPI(title="SCMAUTO ERP API")

register_exception_handlers(app)
app.include_router(health_router)
app.include_router(po_router)
app.include_router(incoming_router)
app.include_router(shipping_router)
app.include_router(inventory_ops_router)
app.include_router(tables_router)
