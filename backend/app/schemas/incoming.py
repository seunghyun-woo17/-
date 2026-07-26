# app/schemas/incoming.py
from datetime import date as DateType
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class IncomingItemIn(BaseModel):
    mc: str
    item: str
    sn: str
    vnd: Optional[str] = None
    date: Optional[DateType] = None  # incoming_date per item (alias kept for wire compat)

    @field_validator("mc", "item", "sn")
    @classmethod
    def _required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("mc/item/sn은 필수입니다.")
        return v.strip()


class IncomingCompleteIn(BaseModel):
    po_id: Optional[str] = None
    po_ref_no: Optional[str] = None
    inspector: str
    items: list[IncomingItemIn] = Field(min_length=1)

    @field_validator("inspector")
    @classmethod
    def _inspector_required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("inspector는 필수입니다.")
        return v.strip()


class CertIn(BaseModel):
    cert_no: Optional[str] = None
    issued_by: Optional[str] = None
    issued_date: Optional[DateType] = None
