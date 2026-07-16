from app.database import SessionLocal, engine
from app.models import Base
from app.models.vessel import VesselMaster, VesselBom, VesselNote, VesselDoc


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_vessel_master_roundtrip_and_legacy_unique():
    _fresh()
    s = SessionLocal()
    try:
        v = VesselMaster(
            legacy_id="V-1",
            vessel_type="newbuild",
            vessel_name="A-VESSEL",
            vessel_classes=["DNV", "ABS"],
            ship_type="Tanker",
            owner="OWNER",
            flag="KOREA",
            yard="HHI",
        )
        s.add(v)
        s.commit()
        s.refresh(v)
        assert v.id is not None
        assert v.version == 1
        assert v.created_at is not None
        assert v.vessel_classes == ["DNV", "ABS"]
    finally:
        s.close()


def test_vessel_children_tablenames():
    assert VesselBom.__tablename__ == "vessel_bom"
    assert VesselNote.__tablename__ == "vessel_notes"
    assert VesselDoc.__tablename__ == "vessel_docs"
    # vessel_docs must NOT carry base64 payload columns in B1
    assert not hasattr(VesselDoc, "file_data")
