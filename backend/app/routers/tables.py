from typing import Any

from fastapi import APIRouter, Body, Depends, Query
from sqlalchemy import insert, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.deps import get_db
from app.errors import (
    ConflictVersionError,
    DuplicateError,
    ForbiddenError,
    NotFoundError,
    ValidationError,
)
from app.models.catalog import BomCatalog, Supplier
from app.models.delivery import DeliverySchedule
from app.models.fat import (
    FatComment,
    FatCommentCode,
    FatHistory,
    FatMaster,
    FatRefDoc,
    MedCert,
)
from app.models.inventory import (
    DefectLog,
    IncomingHeader,
    IncomingLine,
    Inventory,
    InspectionCert,
    OutgoingLog,
)
from app.models.procurement import PoHeader, PoLine
from app.models.vessel import VesselBom, VesselDoc, VesselMaster, VesselNote
from app.services.locking import apply_optimistic_update, row_to_dict

router = APIRouter(prefix="/api")

# URL segment -> model. Writable via generic CRUD.
TABLE_WHITELIST: dict[str, Any] = {
    "vessel_master": VesselMaster,
    "vessel_bom": VesselBom,
    "vessel_notes": VesselNote,
    "vessel_docs": VesselDoc,
    "suppliers": Supplier,
    "bom_catalog": BomCatalog,
    "fat_master": FatMaster,
    "fat_history": FatHistory,
    "fat_comment": FatComment,
    "fat_comment_codes": FatCommentCode,
    "fat_ref_docs": FatRefDoc,
    "med_cert": MedCert,
}

# GET allowed, writes must go through domain (transaction) routers.
READONLY_TABLES: dict[str, Any] = {
    "po_header": PoHeader,
    "po_line": PoLine,
    "inventory": Inventory,
    "incoming_header": IncomingHeader,
    "incoming_line": IncomingLine,
    "inspection_cert": InspectionCert,
    "outgoing_log": OutgoingLog,
    "defect_log": DefectLog,
    "delivery_schedule": DeliverySchedule,
}

_ALL_READABLE = {**TABLE_WHITELIST, **READONLY_TABLES}


def _model_for_read(table: str):
    model = _ALL_READABLE.get(table)
    if model is None:
        raise NotFoundError(detail=f"알 수 없는 테이블: {table}")
    return model


def _model_for_write(table: str):
    if table in READONLY_TABLES:
        raise ForbiddenError(detail=f"{table}는 전용 엔드포인트로만 변경할 수 있습니다.")
    model = TABLE_WHITELIST.get(table)
    if model is None:
        raise NotFoundError(detail=f"알 수 없는 테이블: {table}")
    return model


def _writable_columns(model) -> set[str]:
    return {c.name for c in model.__table__.columns}


@router.get("/{table}")
def bulk_get(table: str, db: Session = Depends(get_db)) -> list[dict]:
    model = _model_for_read(table)
    rows = db.execute(select(model)).scalars().all()
    return [row_to_dict(r) for r in rows]


@router.post("/{table}", status_code=201)
def create_row(
    table: str,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
) -> dict:
    model = _model_for_write(table)
    cols = _writable_columns(model)
    reserved = {"id", "version", "created_at", "updated_at"}
    values = {k: v for k, v in payload.items() if k in cols and k not in reserved}
    if not values:
        raise ValidationError(detail="유효한 컬럼이 없습니다.")
    try:
        result = db.execute(insert(model).values(**values).returning(model.id))
        new_id = result.scalar_one()
        db.commit()
    except IntegrityError:
        db.rollback()
        raise DuplicateError(detail="유니크 제약 위반(중복 값).")
    obj = db.get(model, new_id)
    return row_to_dict(obj)


@router.patch("/{table}/{row_id}")
def patch_row(
    table: str,
    row_id: int,
    payload: dict = Body(...),
    db: Session = Depends(get_db),
) -> dict:
    model = _model_for_write(table)
    version = payload.get("version")
    if version is None:
        raise ValidationError(detail="version 필드는 필수입니다.")
    cols = _writable_columns(model)
    reserved = {"id", "version", "created_at", "updated_at"}
    changes = {k: v for k, v in payload.items() if k in cols and k not in reserved}
    try:
        obj = apply_optimistic_update(
            db, model, id_value=row_id, version=int(version), changes=changes
        )
        db.commit()
    except ConflictVersionError:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise DuplicateError(detail="유니크 제약 위반(중복 값).")
    return row_to_dict(obj)


@router.delete("/{table}/{row_id}")
def delete_row(
    table: str,
    row_id: int,
    version: int = Query(...),
    db: Session = Depends(get_db),
) -> dict:
    from sqlalchemy import delete as sa_delete

    model = _model_for_write(table)
    res = db.execute(
        sa_delete(model).where(model.id == row_id, model.version == version)
    )
    if res.rowcount == 0:
        current = db.get(model, row_id)
        db.rollback()
        if current is None:
            raise NotFoundError(detail=f"{table} id={row_id} 없음")
        raise ConflictVersionError(
            detail="다른 사용자가 먼저 수정했습니다.",
            current=row_to_dict(current),
        )
    db.commit()
    return {"ok": True}
