def test_upsert_inserts_new_rows(client):
    body = {"vessel_id": "V-1", "rows": [
        {"mid_cat": "Main Rack", "req_qty": 2, "planned_date": "2026-08-01"},
        {"mid_cat": "Sub Rack", "req_qty": 5},
    ]}
    r = client.post("/api/delivery/schedule", json=body)
    assert r.status_code == 200
    assert r.json()["upserted"] == 2
    rows = client.get("/api/delivery_schedule").json()
    assert {x["mid_cat"] for x in rows} == {"Main Rack", "Sub Rack"}


def test_upsert_updates_existing_same_key(client):
    client.post("/api/delivery/schedule", json={"vessel_id": "V-1", "rows": [{"mid_cat": "Main Rack", "req_qty": 2}]})
    client.post("/api/delivery/schedule", json={"vessel_id": "V-1", "rows": [{"mid_cat": "Main Rack", "req_qty": 9, "memo": "updated"}]})
    rows = client.get("/api/delivery_schedule").json()
    main = [x for x in rows if x["mid_cat"] == "Main Rack"]
    assert len(main) == 1  # not duplicated
    assert main[0]["req_qty"] == 9 and main[0]["memo"] == "updated"


def test_empty_mid_cat_row_is_skipped(client):
    r = client.post("/api/delivery/schedule", json={"vessel_id": "V-1", "rows": [{"mid_cat": "  ", "req_qty": 1}]})
    assert r.json()["upserted"] == 0
    assert client.get("/api/delivery_schedule").json() == []


def test_missing_vessel_id_422(client):
    r = client.post("/api/delivery/schedule", json={"rows": [{"mid_cat": "X"}]})
    assert r.status_code == 422
