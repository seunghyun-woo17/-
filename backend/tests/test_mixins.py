from sqlalchemy import BigInteger, String
from sqlalchemy.orm import MappedColumn
from app.models.mixins import PkMixin, LegacyIdMixin


def test_pk_mixin_defines_bigint_autoincrement_id():
    # MappedColumn.column gives the underlying Column before declarative binding
    mc = PkMixin.__dict__["id"]
    assert isinstance(mc, MappedColumn)
    col = mc.column
    assert col.type.__class__ is BigInteger
    assert col.primary_key is True
    assert col.autoincrement is True


def test_legacy_id_is_unique_nullable_string():
    mc = LegacyIdMixin.__dict__["legacy_id"]
    assert isinstance(mc, MappedColumn)
    col = mc.column
    assert col.type.__class__ is String
    assert col.unique is True
    assert col.nullable is True
