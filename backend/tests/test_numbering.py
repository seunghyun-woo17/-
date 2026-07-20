from app.database import SessionLocal, engine
from app.models import Base
from app.models.procurement import PoCounter
from app.services.numbering import next_po_ref_no


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_first_number_is_0001_for_year():
    _fresh()
    s = SessionLocal()
    try:
        ref = next_po_ref_no(s, year=2026)
        s.commit()
        assert ref == "A-PO-260001"
    finally:
        s.close()


def test_sequential_no_gaps_same_year():
    _fresh()
    s = SessionLocal()
    try:
        refs = [next_po_ref_no(s, year=2026) for _ in range(3)]
        s.commit()
        assert refs == ["A-PO-260001", "A-PO-260002", "A-PO-260003"]
        row = s.query(PoCounter).filter_by(year=2026).one()
        assert row.last_seq == 3
    finally:
        s.close()


def test_year_reset():
    _fresh()
    s = SessionLocal()
    try:
        next_po_ref_no(s, year=2026)
        s.commit()
        ref2027 = next_po_ref_no(s, year=2027)
        s.commit()
        assert ref2027 == "A-PO-270001"
    finally:
        s.close()
