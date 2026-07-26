# tests/test_incoming_complete.py
from app.database import SessionLocal
from tests.factories import make_po, make_supplier


def _seed_po():
    s = SessionLocal()
    try:
        make_supplier(s, code="VND-MRC-001")
        make_po(s, ref="A-PO-260001", supplier_code="VND-MRC-001", lines=[("ITM-1", 2)])
        s.commit()
    finally:
        s.close()


def _body(sns):
    return {
        "po_ref_no": "A-PO-260001",
        "inspector": "우승현",
        "items": [{"mc": f"MC-{i}", "item": "ITM-1", "sn": sn, "vnd": "VND-MRC-001"} for i, sn in enumerate(sns, 1)],
    }


def test_complete_creates_header_lines_inventory_and_sets_po_complete(client):
    _seed_po()
    r = client.post("/api/incoming/complete", json=_body(["SN-1", "SN-2"]))
    assert r.status_code == 201
    j = r.json()
    assert j["status"] == "COMPLETE"
    assert j["inventory_count"] == 2
    inv = client.get("/api/inventory").json()
    assert {x["serial_no"] for x in inv} == {"SN-1", "SN-2"}
    assert all(x["status"] == "IN_STOCK" for x in inv)
    heads = client.get("/api/po_header").json()
    assert heads[0]["status"] == "COMPLETE"


def test_short_delivery_sets_po_partial(client):
    _seed_po()
    r = client.post("/api/incoming/complete", json=_body(["SN-1"]))
    assert r.json()["status"] == "SHORT"
    assert client.get("/api/po_header").json()[0]["status"] == "PARTIAL"


def test_duplicate_serial_rolls_back_everything(client):
    _seed_po()
    client.post("/api/incoming/complete", json=_body(["SN-1"]))
    before_inv = len(client.get("/api/inventory").json())
    before_hdr = len(client.get("/api/incoming_header").json())
    # SN-1 already exists globally -> 409 DUPLICATE, nothing new committed
    r = client.post("/api/incoming/complete", json=_body(["SN-1", "SN-9"]))
    assert r.status_code == 409
    assert r.json()["error"] == "DUPLICATE"
    assert len(client.get("/api/inventory").json()) == before_inv
    assert len(client.get("/api/incoming_header").json()) == before_hdr
    # SN-9 must NOT have leaked in
    assert all(x["serial_no"] != "SN-9" for x in client.get("/api/inventory").json())
