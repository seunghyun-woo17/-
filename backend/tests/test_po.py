from app.database import SessionLocal
from tests.factories import make_supplier


def _seed_supplier():
    s = SessionLocal()
    try:
        make_supplier(s, code="VND-MRC-001")
        s.commit()
    finally:
        s.close()


def test_create_po_allocates_ref_and_lines(client):
    _seed_supplier()
    body = {
        "supplier_code": "VND-MRC-001",
        "supplier_name": "MRC",
        "vessel_code": "VC-1",
        "vessel_name": "A-VESSEL",
        "issue_date": "2026-07-16",
        "due_date": "2026-08-01",
        "pic": "우승현",
        "lines": [
            {"item_code": "ITM-1", "description": "Radar", "ordered_qty": 2, "unit": "EA", "unit_price": 1000},
            {"item_code": "ITM-2", "description": "GPS", "ordered_qty": 3, "unit": "EA", "unit_price": 500},
        ],
    }
    r = client.post("/api/po", json=body)
    assert r.status_code == 201
    j = r.json()
    assert j["po_ref_no"].startswith("A-PO-")
    assert j["header"]["status"] == "OPEN"
    assert len(j["lines"]) == 2
    assert j["lines"][0]["po_id"] == j["po_ref_no"]
    # persisted & visible via generic GET
    heads = client.get("/api/po_header").json()
    assert len(heads) == 1
    lines = client.get("/api/po_line").json()
    assert {l["item_code"] for l in lines} == {"ITM-1", "ITM-2"}


def test_create_po_requires_at_least_one_line(client):
    _seed_supplier()
    r = client.post("/api/po", json={"supplier_code": "VND-MRC-001", "lines": []})
    assert r.status_code == 422


def test_create_po_rollback_on_bad_line_leaves_no_partial(client):
    _seed_supplier()
    # duplicate item within same request is allowed; force failure via missing item_code
    r = client.post("/api/po", json={
        "supplier_code": "VND-MRC-001",
        "lines": [{"item_code": "", "ordered_qty": 1}],
    })
    assert r.status_code == 422
    assert client.get("/api/po_header").json() == []
    assert client.get("/api/po_line").json() == []
