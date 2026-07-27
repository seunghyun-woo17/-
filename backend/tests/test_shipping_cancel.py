from app.database import SessionLocal
from tests.factories import make_inventory, make_vessel


def _ship(client):
    s = SessionLocal()
    try:
        make_vessel(s, legacy_id="V-1")
        make_inventory(s, mc="MC-1", sn="SN-1", status="IN_STOCK")
        s.commit()
    finally:
        s.close()
    return client.post("/api/shipping/commit", json={"mc_code": "MC-1", "vessel_id": "V-1"}).json()["log_id"]


def test_cancel_returns_stock_and_appends_audit_log(client):
    log_id = _ship(client)
    r = client.post(f"/api/shipping/{log_id}/cancel", json={"reason": "오배송 정정"})
    assert r.status_code == 200
    j = r.json()
    assert j["inventory"]["status"] == "IN_STOCK"
    logs = client.get("/api/outgoing_log").json()
    # original SHIPPED log kept + new cancel log = 2 rows
    assert len(logs) == 2
    actions = {l["action"] for l in logs}
    assert actions == {"SHIPPED", "SHIP_CANCELLED"}
    cancel = next(l for l in logs if l["action"] == "SHIP_CANCELLED")
    assert cancel["cancel_of"] == log_id
    assert cancel["cancel_reason"] == "오배송 정정"


def test_cancel_requires_reason(client):
    log_id = _ship(client)
    r = client.post(f"/api/shipping/{log_id}/cancel", json={"reason": ""})
    assert r.status_code == 422


def test_cancel_unknown_log_404(client):
    _ship(client)
    r = client.post("/api/shipping/OUT-nope/cancel", json={"reason": "x"})
    assert r.status_code == 404


def test_double_cancel_second_is_conflict_state(client):
    log_id = _ship(client)
    assert client.post(f"/api/shipping/{log_id}/cancel", json={"reason": "a"}).status_code == 200
    second = client.post(f"/api/shipping/{log_id}/cancel", json={"reason": "b"})
    assert second.status_code == 409
    assert second.json()["error"] == "CONFLICT_STATE"
    # exactly one cancel log added (no third row)
    logs = client.get("/api/outgoing_log").json()
    assert sum(1 for l in logs if l["action"] == "SHIP_CANCELLED") == 1
