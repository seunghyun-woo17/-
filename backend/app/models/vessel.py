from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Integer, JSON, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import LegacyIdMixin, PkMixin


class VesselMaster(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "vessel_master"

    vessel_type: Mapped[str] = mapped_column(String(20), nullable=False)  # newbuild|retrofit
    shipping_company: Mapped[str | None] = mapped_column(String(200), nullable=True)
    vessel_name: Mapped[str] = mapped_column(String(200), nullable=False)
    vessel_classes: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["DNV","ABS"]
    ship_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    owner: Mapped[str | None] = mapped_column(String(200), nullable=True)
    flag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    yard: Mapped[str | None] = mapped_column(String(100), nullable=True)
    imo_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    contract_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    products: Mapped[list | None] = mapped_column(JSON, nullable=True)
    registered_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    # CX/OP scalars (CLAUDE.md 호선 중심 확장)
    supply_product: Mapped[str | None] = mapped_column(String(200), nullable=True)
    construction_cost: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    dl_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_delivery_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    series_no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    seatrial_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    seatrial_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    commission_start: Mapped[date | None] = mapped_column(Date, nullable=True)
    commission_end: Mapped[date | None] = mapped_column(Date, nullable=True)
    cxop_remark: Mapped[str | None] = mapped_column(Text, nullable=True)


class VesselBom(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "vessel_bom"

    vessel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)  # -> VesselMaster.legacy_id
    item_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    item_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    required_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    gubun: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model: Mapped[str | None] = mapped_column(String(100), nullable=True)
    mid_cat: Mapped[str | None] = mapped_column(String(100), nullable=True)
    registered_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    shortage_ack: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    shortage_ack_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class VesselNote(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "vessel_notes"

    vessel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(30), nullable=False)  # 품질|납기|SW|기타|CX|OP|...
    content: Mapped[str] = mapped_column(Text, nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    verified_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    verified_at: Mapped[date | None] = mapped_column(Date, nullable=True)


class VesselDoc(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "vessel_docs"

    vessel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    doc_type: Mapped[str] = mapped_column(String(30), nullable=False)  # FAT|SW_INSTALL|ETC
    doc_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    uploaded_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uploaded_at: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
