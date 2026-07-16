# tests/test_models_catalog.py
import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, engine
from app.models import Base
from app.models.catalog import Supplier, BomCatalog


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_supplier_code_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(Supplier(supplier_code="VND-MRC-001", supplier_name="MRC"))
        s.commit()
        s.add(Supplier(supplier_code="VND-MRC-001", supplier_name="DUP"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_bom_catalog_stores_json_groups():
    _fresh()
    s = SessionLocal()
    try:
        c = BomCatalog(
            groups=[{"gubun": "G1", "model": "M1", "items": []}],
            product_codes=[{"code": "P1", "gubun": "G1", "model": "M1"}],
            file_name="BOM.xlsx",
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        assert c.groups[0]["gubun"] == "G1"
        assert c.product_codes[0]["code"] == "P1"
    finally:
        s.close()
