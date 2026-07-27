# tests/test_incoming_cert.py
from app.database import SessionLocal
from tests.factories import make_po, make_supplier


def _seed_and_receive(client):
    s = SessionLocal()
    try:
        make_supplier(s, code="VND-MRC-001")
        make_po(s, ref="A-PO-260001", supplier_code="VND-MRC-001", lines=[("ITM-1", 2)])
        s.commit()
    finally:
        s.close()
    body = {"po_ref_no": "A-PO-260001", "inspector": "우승현",
            "items": [{"mc": "MC-1", "item": "ITM-1", "sn": "SN-1", "vnd": "VND-MRC-001"},
                      {"mc": "MC-2", "item": "ITM-1", "sn": "SN-2", "vnd": "VND-MRC-001"}]}
    return client.post("/api/incoming/complete", json=body).json()["incoming_id"]


def test_cert_creates_and_stamps_all_serials(client):
    inc_id = _seed_and_receive(client)
    r = client.post(f"/api/incoming/{inc_id}/cert",
                    json={"cert_no": "C-100", "issued_by": "KR", "issued_date": "2026-07-16"})
    assert r.status_code == 200
    j = r.json()
    assert j["stamped_count"] == 2
    inv = client.get("/api/inventory").json()
    assert all(x["cert_id"] == j["cert_id"] for x in inv)
    certs = client.get("/api/inspection_cert").json()
    assert len(certs) == 1 and certs[0]["cert_no"] == "C-100"


def test_cert_upsert_updates_existing_without_new_row(client):
    inc_id = _seed_and_receive(client)
    first = client.post(f"/api/incoming/{inc_id}/cert", json={"cert_no": "C-1"}).json()
    second = client.post(f"/api/incoming/{inc_id}/cert", json={"cert_no": "C-2", "issued_by": "ABS"})
    assert second.status_code == 200
    assert second.json()["cert_id"] == first["cert_id"]  # same cert row
    certs = client.get("/api/inspection_cert").json()
    assert len(certs) == 1 and certs[0]["cert_no"] == "C-2" and certs[0]["issued_by"] == "ABS"


def test_cert_unknown_incoming_404(client):
    r = client.post("/api/incoming/INC-nope/cert", json={"cert_no": "C-1"})
    assert r.status_code == 404
