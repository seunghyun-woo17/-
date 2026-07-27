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


@router.post("/incoming/{incoming_id}/cert")
def upsert_cert(incoming_id: str, payload: CertIn, db: Session = Depends(get_db)) -> dict:
    hdr = db.execute(
        select(IncomingHeader).where(IncomingHeader.incoming_id == incoming_id)
    ).scalar_one_or_none()
    if hdr is None:
        raise NotFoundError(detail=f"입고 건 없음: {incoming_id}")
    try:
        existing = db.execute(
            select(InspectionCert).where(InspectionCert.incoming_id == incoming_id)
        ).scalar_one_or_none()
        if existing is not None:
            if payload.cert_no is not None:
                existing.cert_no = payload.cert_no
            if payload.issued_by is not None:
                existing.issued_by = payload.issued_by
            if payload.issued_date is not None:
                existing.issued_date = payload.issued_date
            existing.version += 1
            db.flush()
            cert_id = existing.cert_id
            stamped = db.execute(
                select(Inventory).where(Inventory.cert_id == cert_id)
            ).scalars().all()
            result = {"cert_id": cert_id, "stamped_count": len(stamped)}
            db.commit()
            return result

        cert_id = _gen_id("CERT")
        db.add(InspectionCert(
            cert_id=cert_id, incoming_id=incoming_id, po_id=hdr.po_id,
            cert_no=payload.cert_no or "미입력",
            issued_by=payload.issued_by or "미입력",
            issued_date=payload.issued_date,
        ))
        sns = [
            r.serial_no
            for r in db.execute(
                select(IncomingLine).where(IncomingLine.incoming_id == incoming_id)
            ).scalars().all()
        ]
        stamped_count = 0
        if sns:
            res = db.execute(
                update(Inventory)
                .where(Inventory.serial_no.in_(sns))
                .values(cert_id=cert_id, version=Inventory.version + 1)
            )
            stamped_count = res.rowcount
        db.flush()
        result = {"cert_id": cert_id, "stamped_count": stamped_count}
        db.commit()
        return result
    except Exception:
        db.rollback()
        raise
