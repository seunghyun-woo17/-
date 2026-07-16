from datetime import date

from sqlalchemy import Date, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import LegacyIdMixin, PkMixin


class DeliverySchedule(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "delivery_schedule"

    vessel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    mid_cat: Mapped[str] = mapped_column(String(100), nullable=False)
    planned_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    actual_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    req_qty: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    memo: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("vessel_id", "mid_cat", name="uq_delivery_vessel_midcat"),
    )
