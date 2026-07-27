from app.database import SessionLocal
from tests.factories import make_inventory, make_vessel


def _seed(status="IN_STOCK"):
    s = SessionLocal()
    try:
        make_vessel(s, legacy_id="V-1", name="A-VESSEL")
        make_inventory(s, mc="MC-1", sn="SN-1", status=status)
        s.commit()
    finally:
        s.close()


def test_commit_ship_transitions_and_logs(client):
    _seed()
    r = client.post("/api/shipping/commit", json={"mc_code": "MC-1", "vessel_id": "V-1", "mid_cat": "Main Rack"})
    assert r.status_code == 200
    j = r.json()
    assert j["inventory"]["status"] == "SHIPPED"
    assert j["inventory"]["vessel_assigned"] == "V-1"
    logs = client.get("/api/outgoing_log").json()
    assert len(logs) == 1
    assert logs[0]["action"] == "SHIPPED" and logs[0]["mid_cat"] == "Main Rack"


def test_double_ship_second_request_returns_409_conflict_state(client):
    _seed()
    first = client.post("/api/shipping/commit", json={"mc_code": "MC-1", "vessel_id": "V-1"})
    assert first.status_code == 200
    second = client.post("/api/shipping/commit", json={"mc_code": "MC-1", "vessel_id": "V-1"})
    assert second.status_code == 409
    body = second.json()
    assert body["error"] == "CONFLICT_STATE"
    assert body["current"]["status"] == "SHIPPED"
    # no duplicate log
    assert len(client.get("/api/outgoing_log").json()) == 1


def test_commit_ship_unknown_mc_404(client):
    _seed()
    r = client.post("/api/shipping/commit", json={"mc_code": "MC-NOPE", "vessel_id": "V-1"})
    assert r.status_code == 404


def test_commit_ship_defect_item_is_conflict_state(client):
    _seed(status="DEFECT")
    r = client.post("/api/shipping/commit", json={"mc_code": "MC-1", "vessel_id": "V-1"})
    assert r.status_code == 409
    assert r.json()["error"] == "CONFLICT_STATE"
    assert client.get("/api/outgoing_log").json() == []
