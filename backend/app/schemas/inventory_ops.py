from datetime import date

from pydantic import BaseModel, field_validator

_ACTION_ALLOWED = {"RENTED", "INSPECTION_REQUESTED"}
_DEFECT_ALLOWED = {"RETURN", "REPAIR", "SCRAP", "HOLD"}


class InventoryActionIn(BaseModel):
    action: str
    team: str | None = None
    due_date: date | None = None
    vessel_id: str | None = None
    pic: str | None = None
    note: str | None = None

    @field_validator("action")
    @classmethod
    def _valid_action(cls, v: str) -> str:
        if v not in _ACTION_ALLOWED:
            raise ValueError(f"action은 {_ACTION_ALLOWED} 중 하나여야 합니다.")
        return v


class ReturnIn(BaseModel):
    note: str | None = None


class DefectIn(BaseModel):
    action: str
    supplier_code: str | None = None
    memo: str | None = None

    @field_validator("action")
    @classmethod
    def _valid_defect(cls, v: str) -> str:
        if v not in _DEFECT_ALLOWED:
            raise ValueError(f"action은 {_DEFECT_ALLOWED} 중 하나여야 합니다.")
        return v
