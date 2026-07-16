# app/models/catalog.py
from datetime import date

from sqlalchemy import Date, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import LegacyIdMixin, PkMixin


class Supplier(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "suppliers"

    supplier_code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    supplier_name: Mapped[str] = mapped_column(String(200), nullable=False)
    supplier_email: Mapped[str | None] = mapped_column(String(200), nullable=True)
    supplier_tel: Mapped[str | None] = mapped_column(String(50), nullable=True)


class BomCatalog(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "bom_catalog"

    groups: Mapped[list | None] = mapped_column(JSON, nullable=True)
    product_codes: Mapped[list | None] = mapped_column(JSON, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    uploaded_at: Mapped[date | None] = mapped_column(Date, nullable=True)
