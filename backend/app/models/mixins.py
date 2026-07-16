from sqlalchemy import BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column


class PkMixin:
    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )


class LegacyIdMixin:
    """Preserves the original client-side uid() string for QR / cross-refs."""

    legacy_id: Mapped[str | None] = mapped_column(
        String(64),
        unique=True,
        nullable=True,
    )
