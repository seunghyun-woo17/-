from pydantic import BaseModel, field_validator


class InspectionCompleteIn(BaseModel):
    result: str
    inspector: str | None = None
    inspection_memo: str | None = None

    @field_validator("result")
    @classmethod
    def _valid_result(cls, v: str) -> str:
        if v not in {"PASS", "FAIL"}:
            raise ValueError("result는 PASS 또는 FAIL 이어야 합니다.")
        return v
