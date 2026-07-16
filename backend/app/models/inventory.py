from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import LegacyIdMixin, PkMixin


class Inventory(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "inventory"

    mc_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    item_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    item_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    serial_no: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)  # 전역 유니크 확정
    po_id: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    po_ref_no: Mapped[str | None] = mapped_column(String(30), nullable=True)
    supplier_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    incoming_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # IN_STOCK|SHIPPED|RENTED|INSPECTION_REQUESTED|DEFECT|SCRAPPED|RETURNED
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="IN_STOCK", index=True)
    rack_location: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vessel_assigned: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vessel_code_assigned: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cert_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    manual_entry: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class IncomingHeader(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "incoming_header"

    incoming_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    po_id: Mapped[str | None] = mapped_column(String(30), nullable=True, index=True)
    po_ref_no: Mapped[str | None] = mapped_column(String(30), nullable=True)
    incoming_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    ordered_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_scanned: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inspector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # COMPLETE|SHORT|OVER
    vessel: Mapped[str | None] = mapped_column(String(100), nullable=True)


class IncomingLine(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "incoming_line"

    incoming_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mc_code: Mapped[str] = mapped_column(String(64), nullable=False)
    item_code: Mapped[str] = mapped_column(String(100), nullable=False)
    serial_no: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class InspectionCert(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "inspection_cert"

    cert_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    incoming_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)  # 입고 건당 1건
    po_id: Mapped[str | None] = mapped_column(String(30), nullable=True)
    cert_no: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issued_by: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issued_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class OutgoingLog(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "outgoing_log"

    log_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    inv_mc: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    inv_sn: Mapped[str | None] = mapped_column(String(120), nullable=True)
    # SHIPPED|RENTED|INSPECTION_REQUESTED|RETURNED|SHIP_CANCELLED
    action: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    vessel_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    vessel_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mid_cat: Mapped[str | None] = mapped_column(String(100), nullable=True)
    pic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    team: Mapped[str | None] = mapped_column(String(50), nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    completed_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    inspector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    result: Mapped[str | None] = mapped_column(String(10), nullable=True)  # PASS|FAIL
    inspection_memo: Mapped[str | None] = mapped_column(Text, nullable=True)
    cancel_of: Mapped[str | None] = mapped_column(String(64), nullable=True)  # 원본 log_id (취소 이력)
    cancel_reason: Mapped[str | None] = mapped_column(Text, nullable=True)


class DefectLog(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "defect_log"

    defect_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    inv_mc: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    serial_no: Mapped[str | None] = mapped_column(String(120), nullable=True)
    item_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)  # RETURN|REPAIR|SCRAP|HOLD
    supplier_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    action_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    result_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)
