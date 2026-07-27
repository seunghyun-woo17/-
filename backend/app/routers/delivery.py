from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.deps import get_db
from app.models.delivery import DeliverySchedule
from app.schemas.delivery import DeliveryScheduleIn

router = APIRouter(prefix="/api")


@router.post("/delivery/schedule")
def upsert_schedule(payload: DeliveryScheduleIn, db: Session = Depends(get_db)) -> dict:
    try:
        upserted = 0
        for row in payload.rows:
            mid = (row.mid_cat or "").strip()
            if not mid:
                continue
            existing = db.execute(
                select(DeliverySchedule).where(
                    DeliverySchedule.vessel_id == payload.vessel_id,
                    DeliverySchedule.mid_cat == mid,
                )
            ).scalar_one_or_none()
            if existing is not None:
                existing.planned_date = row.planned_date
                existing.actual_date = row.actual_date
                existing.req_qty = row.req_qty
                existing.memo = row.memo
                existing.version += 1
            else:
                db.add(DeliverySchedule(
                    vessel_id=payload.vessel_id, mid_cat=mid,
                    planned_date=row.planned_date, actual_date=row.actual_date,
                    req_qty=row.req_qty, memo=row.memo,
                ))
            upserted += 1
        db.flush()
        db.commit()
        return {"upserted": upserted}
    except Exception:
        db.rollback()
        raise
