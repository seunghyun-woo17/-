from datetime import date

from pydantic import BaseModel, Field, field_validator


class PoLineIn(BaseModel):
    item_code: str
    description: str | None = None
    ordered_qty: int = 0
    unit: str = "EA"
    unit_price: float | None = None
    currency: str = "KRW"

    @field_validator("item_code")
    @classmethod
    def _item_code_required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("item_code는 필수입니다.")
        return v.strip()


class PoCreate(BaseModel):
    supplier_code: str
    supplier_name: str | None = None
    supplier_email: str | None = None
    vessel_code: str | None = None
    vessel_name: str | None = None
    issue_date: date | None = None
    due_date: date | None = None
    pic: str | None = None
    terms: list | dict | None = None
    lines: list[PoLineIn] = Field(min_length=1)
