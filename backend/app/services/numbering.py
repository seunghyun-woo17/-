from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.procurement import PoCounter


def next_po_ref_no(db: Session, *, year: int | None = None) -> str:
    """Atomically allocate the next A-PO-YYNNNN reference for the given year.

    Locks (or creates) the po_counter row for the year with SELECT ... FOR
    UPDATE so concurrent callers serialize. The caller owns the transaction;
    this function only flushes, it does not commit.
    """
    if year is None:
        year = datetime.now(timezone.utc).year

    stmt = select(PoCounter).where(PoCounter.year == year).with_for_update()
    counter = db.execute(stmt).scalar_one_or_none()
    if counter is None:
        counter = PoCounter(year=year, last_seq=0)
        db.add(counter)
        db.flush()
        # re-lock the freshly inserted row
        counter = db.execute(stmt).scalar_one()

    counter.last_seq += 1
    db.flush()

    yy = f"{year % 100:02d}"
    return f"A-PO-{yy}{counter.last_seq:04d}"
