# tests/test_tables_generic.py
def test_bulk_get_returns_array(client):
    r = client.get("/api/suppliers")
    assert r.status_code == 200
    assert r.json() == []


def test_post_then_get_supplier(client):
    r = client.post("/api/suppliers", json={"supplier_code": "VND-1", "supplier_name": "ACME"})
    assert r.status_code == 201
    body = r.json()
    assert body["supplier_code"] == "VND-1"
    assert body["version"] == 1
    assert body["id"] >= 1
    lst = client.get("/api/suppliers").json()
    assert len(lst) == 1 and lst[0]["supplier_code"] == "VND-1"


def test_duplicate_business_id_returns_409(client):
    client.post("/api/suppliers", json={"supplier_code": "VND-DUP", "supplier_name": "A"})
    r = client.post("/api/suppliers", json={"supplier_code": "VND-DUP", "supplier_name": "B"})
    assert r.status_code == 409
    assert r.json()["error"] == "DUPLICATE"


def test_patch_optimistic_lock_conflict_returns_current(client):
    created = client.post("/api/suppliers", json={"supplier_code": "VND-X", "supplier_name": "A"}).json()
    sid = created["id"]
    # first patch succeeds, bumps version 1 -> 2
    ok = client.patch(f"/api/suppliers/{sid}", json={"version": 1, "supplier_name": "B"})
    assert ok.status_code == 200 and ok.json()["version"] == 2
    # stale patch with version 1 -> 409 CONFLICT_VERSION with current
    stale = client.patch(f"/api/suppliers/{sid}", json={"version": 1, "supplier_name": "C"})
    assert stale.status_code == 409
    j = stale.json()
    assert j["error"] == "CONFLICT_VERSION"
    assert j["current"]["version"] == 2
    assert j["current"]["supplier_name"] == "B"


def test_delete_requires_version(client):
    created = client.post("/api/suppliers", json={"supplier_code": "VND-D", "supplier_name": "A"}).json()
    sid = created["id"]
    bad = client.request("DELETE", f"/api/suppliers/{sid}", params={"version": 999})
    assert bad.status_code == 409
    good = client.request("DELETE", f"/api/suppliers/{sid}", params={"version": 1})
    assert good.status_code == 200
    assert client.get("/api/suppliers").json() == []


def test_write_blocked_on_readonly_table(client):
    # inventory writes must go through domain routers, not generic CRUD
    r = client.post("/api/inventory", json={"mc_code": "MC-1", "item_code": "I", "serial_no": "S"})
    assert r.status_code == 403
    assert r.json()["error"] == "FORBIDDEN"


def test_unknown_table_404(client):
    assert client.get("/api/not_a_table").status_code == 404
