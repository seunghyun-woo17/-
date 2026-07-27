import pytest

from app.database import SessionLocal
from tests.factories import make_inventory


def _seed(mc="MC-1", sn="SN-1", status="IN_STOCK"):
    s = SessionLocal()
    try:
        make_inventory(s, mc=mc, sn=sn, status=status)
        s.commit()
    finally:
        s.close()


def test_action_rented_transitions_and_logs(client):
    _seed()
    r = client.post("/api/inventory/MC-1/action", json={"action": "RENTED", "team": "QC"})
    assert r.status_code == 200
    assert r.json()["inventory"]["status"] == "RENTED"
    logs = client.get("/api/outgoing_log").json()
    assert logs[0]["action"] == "RENTED" and logs[0]["team"] == "QC"


def test_action_rejects_bad_action(client):
    _seed()
    r = client.post("/api/inventory/MC-1/action", json={"action": "SHIPPED"})
    assert r.status_code == 422  # SHIPPED must use shipping/commit


def test_action_on_non_in_stock_is_conflict(client):
    _seed(status="SHIPPED")
    r = client.post("/api/inventory/MC-1/action", json={"action": "RENTED"})
    assert r.status_code == 409
    assert r.json()["error"] == "CONFLICT_STATE"


def test_return_rental_restores_stock(client):
    _seed(status="RENTED")
    r = client.post("/api/inventory/MC-1/return", json={})
    assert r.status_code == 200
    assert r.json()["inventory"]["status"] == "IN_STOCK"
    logs = client.get("/api/outgoing_log").json()
    assert logs[0]["action"] == "RETURNED"


def test_return_when_not_rented_conflict(client):
    _seed(status="IN_STOCK")
    r = client.post("/api/inventory/MC-1/return", json={})
    assert r.status_code == 409


def test_defect_scrap_sets_scrapped_and_logs(client):
    _seed(status="DEFECT")
    r = client.post("/api/inventory/MC-1/defect", json={"action": "SCRAP", "memo": "파손"})
    assert r.status_code == 200
    assert r.json()["inventory"]["status"] == "SCRAPPED"
    dlog = client.get("/api/defect_log").json()
    assert dlog[0]["action"] == "SCRAP" and dlog[0]["result_date"] is None


def test_defect_return_restores_stock_with_result_date(client):
    _seed(status="DEFECT")
    r = client.post("/api/inventory/MC-1/defect", json={"action": "RETURN", "supplier_code": "VND-1"})
    assert r.json()["inventory"]["status"] == "IN_STOCK"
    dlog = client.get("/api/defect_log").json()
    assert dlog[0]["result_date"] is not None


def test_defect_unknown_mc_404(client):
    r = client.post("/api/inventory/MC-NOPE/defect", json={"action": "SCRAP"})
    assert r.status_code == 404
