# app/routers/incoming.py
import uuid
from datetime import date

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_db
from app.errors import DuplicateError, NotFoundError, ValidationError
from app.models.inventory import (
    IncomingHeader,
    IncomingLine,
    InspectionCert,
    Inventory,
)
from app.models.procurement import PoHeader, PoLine
from app.schemas.incoming import CertIn, IncomingCompleteIn
from app.services.locking import row_to_dict

router = APIRouter(prefix="/api")


def _gen_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


@router.post("/incoming/complete", status_code=201)
def complete_incoming(payload: IncomingCompleteIn, db: Session = Depends(get_db)) -> dict:
    ref = payload.po_ref_no or payload.po_id
    if not ref:
        raise ValidationError(detail="po_ref_no 또는 po_id가 필요합니다.")
    header_po = db.execute(select(PoHeader).where(PoHeader.po_ref_no == ref)).scalar_one_or_none()
    if header_po is None:
        raise NotFoundError(detail=f"PO 없음: {ref}")
    po_lines = db.execute(select(PoLine).where(PoLine.po_id == ref)).scalars().all()
    ordered = sum(l.ordered_qty for l in po_lines)
    scanned = len(payload.items)
    status = "COMPLETE" if scanned == ordered else ("SHORT" if scanned < ordered else "OVER")
    desc_by_item = {l.item_code: l.description for l in po_lines}
    inc_id = _gen_id("INC")
    try:
        db.add(IncomingHeader(
            incoming_id=inc_id, po_id=ref, po_ref_no=ref, incoming_date=date.today(),
            ordered_qty=ordered, total_scanned=scanned, inspector=payload.inspector,
            status=status, vessel=header_po.vessel_code,
        ))
        for i, it in enumerate(payload.items, start=1):
            db.add(IncomingLine(
                incoming_id=inc_id, mc_code=it.mc, item_code=it.item, serial_no=it.sn,
                legacy_id=f"{inc_id}-{i}",
            ))
            db.add(Inventory(
                mc_code=it.mc, item_code=it.item, item_name=desc_by_item.get(it.item),
                serial_no=it.sn, po_id=ref, po_ref_no=ref, supplier_code=it.vnd,
                incoming_date=it.date or date.today(), status="IN_STOCK",
                vessel_assigned=header_po.vessel_code,
            ))
        db.execute(
            update(PoHeader)
            .where(PoHeader.po_ref_no == ref)
            .values(status="COMPLETE" if scanned >= ordered else "PARTIAL",
                    version=PoHeader.version + 1)
        )
        db.flush()
        hdr = db.execute(select(IncomingHeader).where(IncomingHeader.incoming_id == inc_id)).scalar_one()
        result = {
            "incoming_id": inc_id,
            "status": status,
            "header": row_to_dict(hdr),
            "lines_count": scanned,
            "inventory_count": scanned,
        }
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        raise DuplicateError(detail="S/N(serial_no) 또는 mc_code 중복 — 입고 취소.")
    except Exception:
        db.rollback()
        raise
