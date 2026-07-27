from fastapi import APIRouter, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_db
from app.errors import DuplicateError
from app.models.procurement import PoHeader, PoLine
from app.schemas.po import PoCreate
from app.services.locking import row_to_dict
from app.services.numbering import next_po_ref_no

router = APIRouter(prefix="/api")


@router.post("/po", status_code=201)
def create_po(payload: PoCreate, db: Session = Depends(get_db)) -> dict:
    try:
        ref = next_po_ref_no(db)
        header = PoHeader(
            po_ref_no=ref,
            supplier_code=payload.supplier_code,
            supplier_name=payload.supplier_name,
            supplier_email=payload.supplier_email,
            vessel_code=payload.vessel_code,
            vessel_code_no=payload.vessel_code,
            vessel_name=payload.vessel_name,
            issue_date=payload.issue_date,
            due_date=payload.due_date,
            status="OPEN",
            pic=payload.pic,
            terms=payload.terms,
            created_by="SCM",
        )
        db.add(header)
        db.flush()
        lines = []
        for i, line in enumerate(payload.lines, start=1):
            row = PoLine(
                po_id=ref,
                item_code=line.item_code,
                description=line.description,
                ordered_qty=line.ordered_qty,
                unit=line.unit,
                unit_price=line.unit_price,
                currency=line.currency,
                legacy_id=f"{ref}-L{i}",
            )
            db.add(row)
            lines.append(row)
        db.flush()
        result = {
            "po_ref_no": ref,
            "header": row_to_dict(header),
            "lines": [row_to_dict(x) for x in lines],
        }
        db.commit()
        return result
    except IntegrityError:
        db.rollback()
        raise DuplicateError(detail="PO 번호 중복 — 재발행이 필요합니다.")
    except Exception:
        db.rollback()
        raise
