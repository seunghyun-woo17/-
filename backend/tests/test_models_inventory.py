import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, engine
from app.models import Base
from app.models.inventory import (
    Inventory, IncomingHeader, IncomingLine, InspectionCert, OutgoingLog, DefectLog,
)


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_inventory_serial_and_mc_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(Inventory(mc_code="MC-1", item_code="ITM", serial_no="SN-1", status="IN_STOCK"))
        s.commit()
        s.add(Inventory(mc_code="MC-2", item_code="ITM", serial_no="SN-1", status="IN_STOCK"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_inventory_status_default_in_stock_and_cols():
    _fresh()
    s = SessionLocal()
    try:
        inv = Inventory(mc_code="MC-9", item_code="ITM", serial_no="SN-9")
        s.add(inv)
        s.commit()
        s.refresh(inv)
        assert inv.status == "IN_STOCK"
        assert inv.cert_id is None
        assert inv.manual_entry is False
    finally:
        s.close()


def test_business_id_uniques_present():
    _fresh()
    s = SessionLocal()
    try:
        s.add(InspectionCert(cert_id="CERT-1", incoming_id="INC-1"))
        s.add(OutgoingLog(log_id="OUT-1", inv_mc="MC-1", action="SHIPPED"))
        s.add(DefectLog(defect_id="DEF-1", inv_mc="MC-1", action="SCRAP"))
        s.commit()
        # duplicate cert_id rejected
        s.add(InspectionCert(cert_id="CERT-1", incoming_id="INC-2"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_inventory_mc_code_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(Inventory(mc_code="MCX-1", item_code="ITM", serial_no="SN-A1", status="IN_STOCK"))
        s.commit()
        s.add(Inventory(mc_code="MCX-1", item_code="ITM", serial_no="SN-A2", status="IN_STOCK"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_inspection_cert_incoming_id_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(InspectionCert(cert_id="CERTX-1", incoming_id="INCX-1"))
        s.commit()
        s.add(InspectionCert(cert_id="CERTX-2", incoming_id="INCX-1"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_outgoing_and_defect_id_unique():
    # duplicate log_id
    _fresh()
    s = SessionLocal()
    try:
        s.add(OutgoingLog(log_id="LOGX-1", inv_mc="MC-X", action="SHIPPED"))
        s.commit()
        s.add(OutgoingLog(log_id="LOGX-1", inv_mc="MC-X", action="SHIPPED"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()

    # duplicate defect_id
    _fresh()
    s = SessionLocal()
    try:
        s.add(DefectLog(defect_id="DEFX-1", inv_mc="MC-X", action="SCRAP"))
        s.commit()
        s.add(DefectLog(defect_id="DEFX-1", inv_mc="MC-X", action="SCRAP"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()
