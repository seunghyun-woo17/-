from datetime import date

from sqlalchemy.orm import Session

from app.models.catalog import Supplier
from app.models.inventory import Inventory
from app.models.procurement import PoHeader, PoLine
from app.models.vessel import VesselMaster


def make_supplier(db: Session, code: str = "VND-MRC-001", name: str = "MRC") -> Supplier:
    s = Supplier(supplier_code=code, supplier_name=name, supplier_email="a@b.com")
    db.add(s)
    db.flush()
    return s


def make_vessel(db: Session, legacy_id: str = "V-1", name: str = "A-VESSEL") -> VesselMaster:
    v = VesselMaster(legacy_id=legacy_id, vessel_type="newbuild", vessel_name=name, vessel_classes=["DNV"])
    db.add(v)
    db.flush()
    return v


def make_po(db: Session, ref: str = "A-PO-260001", supplier_code: str = "VND-MRC-001", lines=None) -> PoHeader:
    h = PoHeader(po_ref_no=ref, supplier_code=supplier_code, status="OPEN", vessel_code="VC-1")
    db.add(h)
    db.flush()
    for i, (code, qty) in enumerate(lines or [("ITM-1", 2)], start=1):
        db.add(PoLine(po_id=ref, item_code=code, ordered_qty=qty, unit="EA", currency="KRW", legacy_id=f"{ref}-L{i}"))
    db.flush()
    return h


def make_inventory(db: Session, mc: str = "MC-1", sn: str = "SN-1", status: str = "IN_STOCK", item_code: str = "ITM-1") -> Inventory:
    inv = Inventory(mc_code=mc, item_code=item_code, serial_no=sn, status=status, incoming_date=date(2026, 7, 16))
    db.add(inv)
    db.flush()
    return inv
