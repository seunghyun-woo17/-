from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.errors import ConflictStateError, ConflictVersionError, NotFoundError


def row_to_dict(obj) -> dict:
    result: dict = {}
    for col in obj.__table__.columns:
        value = getattr(obj, col.name)
        if isinstance(value, (datetime, date)):
            value = value.isoformat()
        elif isinstance(value, Decimal):
            value = float(value)
        result[col.name] = value
    return result


def _reload(db: Session, model, id_value):
    return db.get(model, id_value)


def apply_optimistic_update(db, model, *, id_value, version: int, changes: dict):
    """WHERE id AND version conditional update; rowcount=0 -> 409 CONFLICT_VERSION."""
    payload = dict(changes)
    payload["version"] = version + 1
    stmt = (
        update(model)
        .where(model.id == id_value, model.version == version)
        .values(**payload)
    )
    res = db.execute(stmt)
    if res.rowcount == 0:
        current = _reload(db, model, id_value)
        if current is None:
            raise NotFoundError(detail=f"{model.__tablename__} id={id_value} 없음")
        raise ConflictVersionError(
            detail="다른 사용자가 먼저 수정했습니다.",
            current=row_to_dict(current),
        )
    db.flush()
    return _reload(db, model, id_value)


def conditional_status_update(db, model, *, id_value, expected_status: str, changes: dict):
    """WHERE id AND status=expected; rowcount=0 -> 409 CONFLICT_STATE (or 404)."""
    payload = dict(changes)
    payload["version"] = model.version + 1
    stmt = (
        update(model)
        .where(model.id == id_value, model.status == expected_status)
        .values(**payload)
    )
    res = db.execute(stmt)
    if res.rowcount == 0:
        current = _reload(db, model, id_value)
        if current is None:
            raise NotFoundError(detail=f"{model.__tablename__} id={id_value} 없음")
        raise ConflictStateError(
            detail=f"상태 전이 불가(현재 {current.status}, 기대 {expected_status}).",
            current=row_to_dict(current),
        )
    db.flush()
    return _reload(db, model, id_value)
