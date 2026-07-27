import pytest

from app.database import SessionLocal
import app.routers.shipping as shipping_mod
from app.models.inventory import OutgoingLog
from tests.factories import make_inventory, make_vessel


def _seed():
    s = SessionLocal()
    try:
        make_vessel(s, legacy_id="V-1")
        make_inventory(s, mc="MC-1", sn="SN-1", status="IN_STOCK")
        s.commit()
    finally:
        s.close()


def test_shipping_commit_rolls_back_inventory_when_log_insert_fails(client, monkeypatch):
    _seed()

    # Force a failure AFTER the inventory conditional UPDATE, BEFORE commit,
    # by making OutgoingLog construction raise inside the router.
    class Boom(Exception):
        pass

    orig_log = shipping_mod.OutgoingLog

    def exploding_log(*args, **kwargs):
        raise Boom("simulated failure mid-transaction")

    monkeypatch.setattr(shipping_mod, "OutgoingLog", exploding_log)

    with pytest.raises(Boom):
        # TestClient re-raises server exceptions by default (raise_server_exceptions=True)
        client.post("/api/shipping/commit", json={"mc_code": "MC-1", "vessel_id": "V-1"})

    monkeypatch.setattr(shipping_mod, "OutgoingLog", orig_log)

    # inventory must still be IN_STOCK (UPDATE rolled back) and no log written
    inv = client.get("/api/inventory").json()
    assert inv[0]["status"] == "IN_STOCK"
    assert inv[0]["vessel_assigned"] is None
    assert client.get("/api/outgoing_log").json() == []


def test_full_suite_smoke_all_endpoints_registered(client):
    # sanity: every domain route exists (not 404 for a well-formed but empty call path)
    assert client.get("/api/suppliers").status_code == 200
    assert client.get("/api/inventory").status_code == 200
    assert client.get("/api/outgoing_log").status_code == 200
    assert client.get("/api/po_header").status_code == 200
    assert client.get("/api/delivery_schedule").status_code == 200
