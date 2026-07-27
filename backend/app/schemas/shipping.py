from pydantic import BaseModel, field_validator


class ShipCommitIn(BaseModel):
    mc_code: str
    vessel_id: str
    mid_cat: str | None = None
    pic: str | None = None
    note: str | None = None


class ShipCancelIn(BaseModel):
    reason: str

    @field_validator("reason")
    @classmethod
    def _reason_required(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("취소 사유(reason)는 필수입니다.")
        return v.strip()
