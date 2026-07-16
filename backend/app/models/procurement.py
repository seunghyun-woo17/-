from datetime import date

from sqlalchemy import Date, Integer, JSON, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import LegacyIdMixin, PkMixin


class PoHeader(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "po_header"

    po_ref_no: Mapped[str] = mapped_column(String(30), nullable=False, unique=True)
    vessel_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    supplier_code: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    supplier_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    supplier_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    vessel_code_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vessel_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    issue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="OPEN")  # OPEN|PARTIAL|COMPLETE|CANCELLED
    pic: Mapped[str | None] = mapped_column(String(100), nullable=True)
    terms: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)


class PoLine(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "po_line"

    po_id: Mapped[str] = mapped_column(String(30), nullable=False, index=True)  # -> PoHeader.po_ref_no
    item_code: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    ordered_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unit: Mapped[str | None] = mapped_column(String(20), nullable=True, default="EA")
    unit_price: Mapped[float | None] = mapped_column(Numeric(18, 2), nullable=True)
    currency: Mapped[str | None] = mapped_column(String(10), nullable=True, default="KRW")


class PoCounter(Base, TimestampMixin):
    __tablename__ = "po_counter"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)
    last_seq: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("year", name="uq_po_counter_year"),)
