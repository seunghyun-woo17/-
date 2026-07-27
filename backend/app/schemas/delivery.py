from datetime import date

from pydantic import BaseModel, Field


class DeliveryRowIn(BaseModel):
    mid_cat: str
    planned_date: date | None = None
    actual_date: date | None = None
    req_qty: int = 0
    memo: str | None = None


class DeliveryScheduleIn(BaseModel):
    vessel_id: str
    rows: list[DeliveryRowIn] = Field(default_factory=list)
