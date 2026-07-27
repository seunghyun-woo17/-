from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.deps import get_db
from app.errors import NotFoundError
from app.models.inventory import Inventory, OutgoingLog
from app.schemas.inspection import InspectionCompleteIn
from app.services.locking import row_to_dict

router = APIRouter(prefix="/api")


@router.post("/inspection/{log_id}/complete")
def complete_inspection(log_id: str, payload: InspectionCompleteIn, db: Session = Depends(get_db)) -> dict:
    log = db.execute(
        select(OutgoingLog).where(
            OutgoingLog.log_id == log_id,
            OutgoingLog.action == "INSPECTION_REQUESTED",
        )
    ).scalar_one_or_none()
    if log is None:
        raise NotFoundError(detail=f"검사요청 로그 없음: {log_id}")
    try:
        log.completed = True
        log.completed_date = date.today()
        log.inspector = payload.inspector or ""
        log.result = payload.result
        log.inspection_memo = payload.inspection_memo
        log.version += 1
        new_status = "DEFECT" if payload.result == "FAIL" else "IN_STOCK"
        db.execute(
            update(Inventory)
            .where(Inventory.mc_code == log.inv_mc)
            .values(status=new_status, version=Inventory.version + 1)
        )
        db.flush()
        inv = db.execute(select(Inventory).where(Inventory.mc_code == log.inv_mc)).scalar_one_or_none()
        result = {
            "log": row_to_dict(log),
            "inventory": row_to_dict(inv) if inv is not None else None,
        }
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
