from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    """Base class for application errors returned as structured JSON."""

    def __init__(
        self,
        code: str,
        status_code: int,
        detail: str,
        current=None,
    ) -> None:
        self.code = code
        self.status_code = status_code
        self.detail = detail
        self.current = current
        super().__init__(detail)


class ValidationError(AppError):
    def __init__(self, detail: str, current=None) -> None:
        super().__init__(
            code="VALIDATION",
            status_code=422,
            detail=detail,
            current=current,
        )


class ConflictVersionError(AppError):
    def __init__(self, detail: str, current=None) -> None:
        super().__init__(
            code="CONFLICT_VERSION",
            status_code=409,
            detail=detail,
            current=current,
        )


class ConflictStateError(AppError):
    def __init__(self, detail: str, current=None) -> None:
        super().__init__(
            code="CONFLICT_STATE",
            status_code=409,
            detail=detail,
            current=current,
        )


class DuplicateError(AppError):
    def __init__(self, detail: str, current=None) -> None:
        super().__init__(
            code="DUPLICATE",
            status_code=409,
            detail=detail,
            current=current,
        )


class NotFoundError(AppError):
    def __init__(self, detail: str, current=None) -> None:
        super().__init__(
            code="NOT_FOUND",
            status_code=404,
            detail=detail,
            current=current,
        )


class ForbiddenError(AppError):
    def __init__(self, detail: str, current=None) -> None:
        super().__init__(
            code="FORBIDDEN",
            status_code=403,
            detail=detail,
            current=current,
        )


def _app_error_body(exc: AppError) -> dict:
    body: dict = {"error": exc.code, "detail": exc.detail}
    if exc.current is not None:
        body["current"] = exc.current
    return body


async def _app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=_app_error_body(exc),
    )


async def _request_validation_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content={"error": "VALIDATION", "detail": exc.errors()},
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, _app_error_handler)
    app.add_exception_handler(RequestValidationError, _request_validation_handler)
