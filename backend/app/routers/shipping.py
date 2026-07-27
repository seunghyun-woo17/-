import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.deps import get_db
from app.errors import ConflictStateError, NotFoundError
from app.models.inventory import Inventory, OutgoingLog
from app.models.vessel import VesselMaster
from app.schemas.shipping import ShipCancelIn, ShipCommitIn
from app.services.locking import row_to_dict

router = APIRouter(prefix="/api")


def _gen_log_id() -> str:
    return f"OUT-{uuid.uuid4().hex[:12]}"


@router.post("/shipping/commit")
def commit_ship(payload: ShipCommitIn, db: Session = Depends(get_db)) -> dict:
    inv = db.execute(
        select(Inventory).where(Inventory.mc_code == payload.mc_code)
    ).scalar_one_or_none()
    if inv is None:
        raise NotFoundError(detail=f"재고 없음: {payload.mc_code}")
    vessel = db.execute(
        select(VesselMaster).where(VesselMaster.legacy_id == payload.vessel_id)
    ).scalar_one_or_none()
    if vessel is None:
        raise NotFoundError(detail=f"호선 없음: {payload.vessel_id}")
    # B1 vessel_master has no standardized display code column; the frontend used
    # vessel.vessel_code which does not exist server-side yet. Log an empty code
    # and rely on vessel_id/vessel_name; B4 wires a real code field.
    vcode = ""
    try:
        res = db.execute(
            update(Inventory)
            .where(Inventory.mc_code == payload.mc_code, Inventory.status == "IN_STOCK")
            .values(
                status="SHIPPED",
                vessel_assigned=payload.vessel_id,
                vessel_code_assigned=vcode,
                version=Inventory.version + 1,
            )
        )
        if res.rowcount == 0:
            current = db.execute(
                select(Inventory).where(Inventory.mc_code == payload.mc_code)
            ).scalar_one()
            db.rollback()
            raise ConflictStateError(
                detail=f"출고 불가 상태입니다(현재 {current.status}).",
                current=row_to_dict(current),
            )
        log_id = _gen_log_id()
        db.add(OutgoingLog(
            log_id=log_id, inv_mc=payload.mc_code, inv_sn=inv.serial_no, action="SHIPPED",
            vessel_id=payload.vessel_id, vessel_code=vcode, mid_cat=payload.mid_cat,
            pic=payload.pic or "", team="", date=date.today(),
            note=payload.note or (f"납품 출고 ({payload.mid_cat})" if payload.mid_cat else "납품 출고"),
        ))
        db.flush()
        updated = db.execute(
            select(Inventory).where(Inventory.mc_code == payload.mc_code)
        ).scalar_one()
        result = {"log_id": log_id, "inventory": row_to_dict(updated)}
        db.commit()
        return result
    except ConflictStateError:
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/shipping/{log_id}/cancel")
def cancel_ship(log_id: str, payload: ShipCancelIn, db: Session = Depends(get_db)) -> dict:
    orig = db.execute(
        select(OutgoingLog).where(OutgoingLog.log_id == log_id, OutgoingLog.action == "SHIPPED")
    ).scalar_one_or_none()
    if orig is None:
        raise NotFoundError(detail=f"출고 로그 없음: {log_id}")
    try:
        res = db.execute(
            update(Inventory)
            .where(Inventory.mc_code == orig.inv_mc, Inventory.status == "SHIPPED")
            .values(
                status="IN_STOCK",
                vessel_assigned=None,
                vessel_code_assigned=None,
                version=Inventory.version + 1,
            )
        )
        if res.rowcount == 0:
            current = db.execute(
                select(Inventory).where(Inventory.mc_code == orig.inv_mc)
            ).scalar_one_or_none()
            db.rollback()
            raise ConflictStateError(
                detail="이미 취소되었거나 출고 상태가 아닙니다.",
                current=row_to_dict(current) if current is not None else None,
            )
        cancel_log_id = _gen_log_id()
        db.add(OutgoingLog(
            log_id=cancel_log_id, inv_mc=orig.inv_mc, inv_sn=orig.inv_sn,
            action="SHIP_CANCELLED", vessel_id=orig.vessel_id, vessel_code=orig.vessel_code,
            mid_cat=orig.mid_cat, date=date.today(),
            note=f"출고 취소 (원본 {log_id})", cancel_of=log_id, cancel_reason=payload.reason,
        ))
        db.flush()
        updated = db.execute(
            select(Inventory).where(Inventory.mc_code == orig.inv_mc)
        ).scalar_one()
        result = {"cancel_log_id": cancel_log_id, "inventory": row_to_dict(updated)}
        db.commit()
        return result
    except ConflictStateError:
        raise
    except Exception:
        db.rollback()
        raise
