"""Consistent API error handling."""

from __future__ import annotations

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class APIError(Exception):
    """Domain error carrying a machine-readable code."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
    ) -> None:
        self.status_code = status_code
        self.code = code
        self.message = message
        super().__init__(message)


def not_found(resource: str, identifier: object = None) -> APIError:
    label = f" '{identifier}'" if identifier is not None else ""
    return APIError(
        status.HTTP_404_NOT_FOUND,
        "not_found",
        f"{resource}{label} was not found.",
    )


def forbidden(message: str = "You do not have access to this resource.") -> APIError:
    return APIError(status.HTTP_403_FORBIDDEN, "forbidden", message)


def bad_request(message: str, code: str = "invalid_request") -> APIError:
    return APIError(status.HTTP_400_BAD_REQUEST, code, message)


def register_exception_handlers(app) -> None:  # noqa: ANN001
    """Attach uniform JSON error responses to the application."""

    @app.exception_handler(APIError)
    async def _api_error(_: Request, exc: APIError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": exc.code, "message": exc.message}},
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail = exc.detail if isinstance(exc.detail, str) else "Request failed."
        code = {
            400: "invalid_request",
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            409: "conflict",
            413: "payload_too_large",
            422: "validation_error",
            503: "service_unavailable",
        }.get(exc.status_code, "error")
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": code, "message": detail}},
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(
        _: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        first = exc.errors()[0] if exc.errors() else {}
        field = ".".join(
            str(part)
            for part in first.get("loc", [])
            if part not in ("body", "query", "path")
        )
        message = first.get("msg", "Invalid request payload.")
        if field:
            message = f"{field}: {message}"
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={"error": {"code": "validation_error", "message": message}},
        )
