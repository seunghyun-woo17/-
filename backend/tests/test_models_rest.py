import pytest
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal, engine
from app.models import Base
from app.models.delivery import DeliverySchedule
from app.models.fat import FatMaster, FatHistory, FatComment, FatCommentCode, FatRefDoc, MedCert
from app.models.file_object import FileObject


def _fresh():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def test_delivery_schedule_vessel_midcat_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(DeliverySchedule(vessel_id="V-1", mid_cat="Main Rack", req_qty=2))
        s.commit()
        s.add(DeliverySchedule(vessel_id="V-1", mid_cat="Main Rack", req_qty=9))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_fat_master_vessel_class_unique_and_class_column():
    _fresh()
    s = SessionLocal()
    try:
        f = FatMaster(vessel_id="V-1", class_="DNV", status="TARGET")
        s.add(f)
        s.commit()
        s.refresh(f)
        assert f.class_ == "DNV"
        assert FatMaster.__table__.c["class"] is not None  # DB column is "class"
        s.add(FatMaster(vessel_id="V-1", class_="DNV", status="TARGET"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()


def test_fat_comment_code_unique_and_file_object_cols():
    _fresh()
    s = SessionLocal()
    try:
        s.add(FatCommentCode(code="ELEC-0001", content="x", category="Technical"))
        s.commit()
        s.add(FatCommentCode(code="ELEC-0001", content="dup", category="Technical"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()
    # file_object schema present
    assert FileObject.__tablename__ == "file_object"
    assert "s3_key" in FileObject.__table__.c


def test_file_object_s3_key_unique():
    _fresh()
    s = SessionLocal()
    try:
        s.add(FileObject(s3_key="s3://bucket/key-A"))
        s.commit()
        s.add(FileObject(s3_key="s3://bucket/key-A"))
        with pytest.raises(IntegrityError):
            s.commit()
    finally:
        s.rollback()
        s.close()
