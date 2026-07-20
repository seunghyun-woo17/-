"""Tests for app.services.locking helpers."""
import pytest

from app.database import SessionLocal, engine
from app.models import Base
from app.models.inventory import Inventory
from app.models.procurement import PoLine
from app.errors import ConflictVersionError, ConflictStateError, NotFoundError
from app.services.locking import apply_optimistic_update, conditional_status_update, row_to_dict
from tests.factories import make_inventory, make_po, make_supplier  # noqa: F401


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


# ---------------------------------------------------------------------------
# apply_optimistic_update
# ---------------------------------------------------------------------------

def test_apply_optimistic_update_happy_path():
    """Happy path: version increments, field is updated."""
    _fresh()
    s = SessionLocal()
    try:
        inv = make_inventory(s, mc="MC-L1", sn="SN-L1")
        s.commit()
        s.refresh(inv)
        assert inv.version == 1

        updated = apply_optimistic_update(
            s, Inventory, id_value=inv.id, version=1, changes={"rack_location": "R-9"}
        )
        s.commit()
        assert updated.rack_location == "R-9"
        assert updated.version == 2
    finally:
        s.close()


def test_apply_optimistic_update_stale_version_raises():
    """Stale version raises ConflictVersionError with current dict at version 2."""
    _fresh()
    s = SessionLocal()
    try:
        inv = make_inventory(s, mc="MC-L2", sn="SN-L2")
        s.commit()
        s.refresh(inv)

        # First update: version 1 -> 2
        apply_optimistic_update(
            s, Inventory, id_value=inv.id, version=1, changes={"rack_location": "R-9"}
        )
        s.commit()

        # Second update with stale version=1 -> conflict
        with pytest.raises(ConflictVersionError) as ei:
            apply_optimistic_update(
                s, Inventory, id_value=inv.id, version=1, changes={"rack_location": "R-0"}
            )
        assert ei.value.current is not None
        assert ei.value.current["version"] == 2
    finally:
        s.close()


def test_apply_optimistic_update_missing_id_raises():
    """Non-existent id raises NotFoundError."""
    _fresh()
    s = SessionLocal()
    try:
        with pytest.raises(NotFoundError):
            apply_optimistic_update(
                s, Inventory, id_value=999999, version=1, changes={"rack_location": "R-X"}
            )
    finally:
        s.close()


# ---------------------------------------------------------------------------
# conditional_status_update
# ---------------------------------------------------------------------------

def test_conditional_status_update_happy_path():
    """Happy path: status transitions, version increments."""
    _fresh()
    s = SessionLocal()
    try:
        inv = make_inventory(s, mc="MC-C1", sn="SN-C1", status="IN_STOCK")
        s.commit()
        s.refresh(inv)
        assert inv.version == 1

        updated = conditional_status_update(
            s, Inventory,
            id_value=inv.id,
            expected_status="IN_STOCK",
            changes={"status": "SHIPPED"},
        )
        s.commit()
        assert updated.status == "SHIPPED"
        assert updated.version == 2
    finally:
        s.close()


def test_conditional_status_update_wrong_status_raises():
    """Wrong expected_status raises ConflictStateError with current dict."""
    _fresh()
    s = SessionLocal()
    try:
        inv = make_inventory(s, mc="MC-C2", sn="SN-C2", status="IN_STOCK")
        s.commit()
        s.refresh(inv)

        # Transition to SHIPPED
        conditional_status_update(
            s, Inventory,
            id_value=inv.id,
            expected_status="IN_STOCK",
            changes={"status": "SHIPPED"},
        )
        s.commit()

        # Try again with wrong expected_status
        with pytest.raises(ConflictStateError) as ei:
            conditional_status_update(
                s, Inventory,
                id_value=inv.id,
                expected_status="IN_STOCK",
                changes={"status": "SHIPPED"},
            )
        assert ei.value.current is not None
        assert ei.value.current["status"] == "SHIPPED"
    finally:
        s.close()


def test_conditional_status_update_missing_id_raises():
    """Non-existent id raises NotFoundError."""
    _fresh()
    s = SessionLocal()
    try:
        with pytest.raises(NotFoundError):
            conditional_status_update(
                s, Inventory,
                id_value=999999,
                expected_status="IN_STOCK",
                changes={"status": "SHIPPED"},
            )
    finally:
        s.close()


# ---------------------------------------------------------------------------
# row_to_dict serialization
# ---------------------------------------------------------------------------

def test_row_to_dict_decimal_and_datetime():
    """Decimal -> float, datetime -> isoformat str."""
    _fresh()
    s = SessionLocal()
    try:
        make_supplier(s)
        make_po(s, ref="A-PO-260099", supplier_code="VND-MRC-001", lines=[("ITM-PRICE", 1)])
        # Add a PoLine with explicit unit_price
        line = PoLine(
            po_id="A-PO-260099",
            item_code="ITM-PRICE2",
            ordered_qty=3,
            unit="EA",
            currency="KRW",
            unit_price=1234.56,
        )
        s.add(line)
        s.commit()
        s.refresh(line)

        d = row_to_dict(line)
        assert isinstance(d["unit_price"], float), f"Expected float, got {type(d['unit_price'])}"
        assert abs(d["unit_price"] - 1234.56) < 0.001
        # created_at is a datetime -> isoformat string
        assert isinstance(d["created_at"], str)
        assert "T" in d["created_at"] or "-" in d["created_at"]
    finally:
        s.close()


