import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.deps import get_db
from app.errors import ConflictStateError, NotFoundError
from app.models.inventory import DefectLog, Inventory, OutgoingLog
from app.schemas.inventory_ops import DefectIn, InventoryActionIn, ReturnIn
from app.services.locking import row_to_dict

router = APIRouter(prefix="/api")


def _gen(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _require_inv(db: Session, mc: str) -> Inventory:
    inv = db.execute(select(Inventory).where(Inventory.mc_code == mc)).scalar_one_or_none()
    if inv is None:
        raise NotFoundError(detail=f"재고 없음: {mc}")
    return inv


def _conditional_transition(db: Session, mc: str, expected: str, new_status: str, extra: dict) -> None:
    values = {"status": new_status, "version": Inventory.version + 1, **extra}
    res = db.execute(
        update(Inventory).where(Inventory.mc_code == mc, Inventory.status == expected).values(**values)
    )
    if res.rowcount == 0:
        current = db.execute(select(Inventory).where(Inventory.mc_code == mc)).scalar_one()
        db.rollback()
        raise ConflictStateError(
            detail=f"상태 전이 불가(현재 {current.status}, 기대 {expected}).",
            current=row_to_dict(current),
        )


@router.post("/inventory/{mc}/action")
def inventory_action(mc: str, payload: InventoryActionIn, db: Session = Depends(get_db)) -> dict:
    inv = _require_inv(db, mc)
    try:
        extra = {}
        if payload.vessel_id:
            extra["vessel_assigned"] = payload.vessel_id
        _conditional_transition(db, mc, "IN_STOCK", payload.action, extra)
        log_id = _gen("OUT")
        db.add(OutgoingLog(
            log_id=log_id, inv_mc=mc, inv_sn=inv.serial_no, action=payload.action,
            vessel_id=payload.vessel_id or "", team=payload.team or "", pic=payload.pic or "",
            due_date=payload.due_date, date=date.today(), note=payload.note or "",
        ))
        db.flush()
        updated = db.execute(select(Inventory).where(Inventory.mc_code == mc)).scalar_one()
        result = {"log_id": log_id, "inventory": row_to_dict(updated)}
        db.commit()
        return result
    except ConflictStateError:
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/inventory/{mc}/return")
def inventory_return(mc: str, payload: ReturnIn, db: Session = Depends(get_db)) -> dict:
    inv = _require_inv(db, mc)
    try:
        _conditional_transition(db, mc, "RENTED", "IN_STOCK", {})
        log_id = _gen("OUT")
        db.add(OutgoingLog(
            log_id=log_id, inv_mc=mc, inv_sn=inv.serial_no, action="RETURNED",
            date=date.today(), note=payload.note or "대여 반납 — 재고 복귀",
        ))
        db.flush()
        updated = db.execute(select(Inventory).where(Inventory.mc_code == mc)).scalar_one()
        result = {"log_id": log_id, "inventory": row_to_dict(updated)}
        db.commit()
        return result
    except ConflictStateError:
        raise
    except Exception:
        db.rollback()
        raise


@router.post("/inventory/{mc}/defect")
def inventory_defect(mc: str, payload: DefectIn, db: Session = Depends(get_db)) -> dict:
    inv = _require_inv(db, mc)
    today = date.today()
    if payload.action in ("RETURN", "REPAIR"):
        target_status = "IN_STOCK"
        result_date = today
    elif payload.action == "SCRAP":
        target_status = "SCRAPPED"
        result_date = None
    else:  # HOLD
        target_status = None
        result_date = None
    try:
        db.add(DefectLog(
            defect_id=_gen("DEF"), inv_mc=mc, serial_no=inv.serial_no, item_code=inv.item_code,
            action=payload.action, supplier_code=payload.supplier_code,
            action_date=today, result_date=result_date, memo=payload.memo,
        ))
        if target_status is not None:
            db.execute(
                update(Inventory)
                .where(Inventory.mc_code == mc)
                .values(status=target_status, version=Inventory.version + 1)
            )
        db.flush()
        updated = db.execute(select(Inventory).where(Inventory.mc_code == mc)).scalar_one()
        result: dict = {"defect_id": None, "inventory": row_to_dict(updated)}
        last = db.execute(
            select(DefectLog).where(DefectLog.inv_mc == mc).order_by(DefectLog.id.desc())
        ).scalars().first()
        result["defect_id"] = last.defect_id if last else None
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
