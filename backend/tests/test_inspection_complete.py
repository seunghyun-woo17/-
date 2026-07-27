from app.database import SessionLocal
from tests.factories import make_inventory


def _seed_inspection_request(client):
    # put an item into INSPECTION_REQUESTED via the inventory action endpoint
    s = SessionLocal()
    try:
        make_inventory(s, mc="MC-1", sn="SN-1", status="IN_STOCK")
        s.commit()
    finally:
        s.close()
    log_id = client.post("/api/inventory/MC-1/action", json={"action": "INSPECTION_REQUESTED"}).json()["log_id"]
    return log_id


def test_complete_pass_restores_in_stock(client):
    log_id = _seed_inspection_request(client)
    r = client.post(f"/api/inspection/{log_id}/complete",
                    json={"result": "PASS", "inspector": "QC1", "inspection_memo": "ok"})
    assert r.status_code == 200
    j = r.json()
    assert j["log"]["completed"] is True
    assert j["log"]["result"] == "PASS"
    assert j["inventory"]["status"] == "IN_STOCK"


def test_complete_fail_sets_defect(client):
    log_id = _seed_inspection_request(client)
    r = client.post(f"/api/inspection/{log_id}/complete", json={"result": "FAIL", "inspector": "QC1"})
    assert r.status_code == 200
    assert r.json()["inventory"]["status"] == "DEFECT"
    assert r.json()["log"]["completed_date"] is not None


def test_complete_unknown_log_404(client):
    r = client.post("/api/inspection/OUT-nope/complete", json={"result": "PASS"})
    assert r.status_code == 404


def test_complete_bad_result_422(client):
    log_id = _seed_inspection_request(client)
    r = client.post(f"/api/inspection/{log_id}/complete", json={"result": "MAYBE"})
    assert r.status_code == 422
