import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, engine
from app.models import Base
from app.models.procurement import PoHeader, PoLine, PoCounter


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_po_ref_no_unique_and_status_default():
    _fresh()
    s = SessionLocal()
    try:
        h = PoHeader(po_ref_no="A-PO-260001", supplier_code="VND-MRC-001")
        s.add(h)
        s.commit()
        s.refresh(h)
        assert h.status == "OPEN"
        s.add(PoHeader(po_ref_no="A-PO-260001", supplier_code="X"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_po_counter_year_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(PoCounter(year=2026, last_seq=0))
        s.commit()
        s.add(PoCounter(year=2026, last_seq=5))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_po_line_columns():
    _fresh()
    s = SessionLocal()
    try:
        line = PoLine(po_id="A-PO-260001", item_code="ITM-1", ordered_qty=3, unit="EA", unit_price=1000, currency="KRW")
        s.add(line)
        s.commit()
        s.refresh(line)
        assert line.ordered_qty == 3
        assert line.currency == "KRW"
    finally:
        s.close()
