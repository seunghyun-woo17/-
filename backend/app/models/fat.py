from datetime import date

from sqlalchemy import Date, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import LegacyIdMixin, PkMixin


class FatMaster(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "fat_master"

    vessel_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    class_: Mapped[str] = mapped_column("class", String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="TARGET")
    scm_ready_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    scm_ready_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    scm_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    fat_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    applied_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    inspector: Mapped[str | None] = mapped_column(String(100), nullable=True)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    product: Mapped[str | None] = mapped_column(String(200), nullable=True)
    flag: Mapped[str | None] = mapped_column(String(100), nullable=True)
    yard: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sn: Mapped[str | None] = mapped_column(String(120), nullable=True)

    __table_args__ = (
        UniqueConstraint("vessel_id", "class", name="uq_fat_vessel_class"),
    )


class FatHistory(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "fat_history"

    fat_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # comment|doc|status
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_by: Mapped[str | None] = mapped_column(String(100), nullable=True)


class FatComment(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "fat_comment"

    fat_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)  # Technical|Surveyor
    status: Mapped[str | None] = mapped_column(String(20), nullable=True)  # OBT 전|진행중|완료
    assignee: Mapped[str | None] = mapped_column(String(100), nullable=True)
    reg_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    done_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    source: Mapped[str | None] = mapped_column(String(20), nullable=True)  # excel|manual
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)


class FatCommentCode(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "fat_comment_codes"

    code: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)


class FatRefDoc(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "fat_ref_docs"

    class_: Mapped[str] = mapped_column("class", String(20), nullable=False, index=True)
    doc_title: Mapped[str | None] = mapped_column(String(300), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(300), nullable=True)
    uploaded_by: Mapped[str | None] = mapped_column(String(100), nullable=True)
    uploaded_at: Mapped[date | None] = mapped_column(Date, nullable=True)


class MedCert(Base, PkMixin, LegacyIdMixin, TimestampMixin, VersionMixin):
    __tablename__ = "med_cert"

    no: Mapped[str | None] = mapped_column(String(50), nullable=True)
    order_old: Mapped[str | None] = mapped_column(String(100), nullable=True)
    cert_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    order_new: Mapped[str | None] = mapped_column(String(100), nullable=True)
    medf_cert_new: Mapped[str | None] = mapped_column(String(100), nullable=True)
    sn: Mapped[str | None] = mapped_column(String(120), nullable=True)
    audit: Mapped[str | None] = mapped_column(String(100), nullable=True)
    obt_fat: Mapped[str | None] = mapped_column(String(100), nullable=True)
    medf_status: Mapped[str | None] = mapped_column(String(100), nullable=True)
    hull_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    shipyard: Mapped[str | None] = mapped_column(String(100), nullable=True)
    dl_vessel: Mapped[str | None] = mapped_column(String(100), nullable=True)
    medb_cert_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    remark: Mapped[str | None] = mapped_column(Text, nullable=True)
