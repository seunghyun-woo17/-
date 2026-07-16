from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin, VersionMixin
from app.models.mixins import PkMixin


class FileObject(Base, PkMixin, TimestampMixin, VersionMixin):
    """S3 attachment metadata. Populated in B3; schema created now."""

    __tablename__ = "file_object"

    s3_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    doc_type: Mapped[str | None] = mapped_column(String(30), nullable=True)  # cert|coc|trade|vessel_doc|fat_ref|...
    content_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    size: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    table_ref: Mapped[str | None] = mapped_column(String(64), nullable=True)  # 참조 테이블명
    record_id: Mapped[str | None] = mapped_column(String(64), nullable=True)  # 참조 업무 id
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")  # PENDING|CONFIRMED
