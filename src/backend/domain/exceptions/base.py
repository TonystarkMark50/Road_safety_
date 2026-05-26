from __future__ import annotations

from typing import Any, Dict, Optional


class AppException(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        code: str = "internal_error",
        details: Optional[Dict[str, Any]] = None,
    ):
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "detail": self.message,
            "code": self.code,
            "details": self.details,
        }


class NotFoundException(AppException):
    def __init__(self, entity: str, entity_id: Any = None):
        msg = f"{entity} not found"
        if entity_id is not None:
            msg += f": {entity_id}"
        super().__init__(
            message=msg,
            status_code=404,
            code="not_found",
            details={"entity": entity, "entity_id": str(entity_id) if entity_id else None},
        )


class UnauthorizedException(AppException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(message=message, status_code=401, code="unauthorized")


class ForbiddenException(AppException):
    def __init__(self, message: str = "Insufficient permissions"):
        super().__init__(message=message, status_code=403, code="forbidden")


class ValidationException(AppException):
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        super().__init__(
            message=message,
            status_code=422,
            code="validation_error",
            details=details,
        )


class ConflictException(AppException):
    def __init__(self, message: str):
        super().__init__(message=message, status_code=409, code="conflict")


class RateLimitException(AppException):
    def __init__(self, retry_after: int = 60):
        super().__init__(
            message=f"Rate limit exceeded. Try again in {retry_after} seconds.",
            status_code=429,
            code="rate_limited",
            details={"retry_after": retry_after},
        )


class SecurityException(AppException):
    def __init__(self, message: str = "Security check failed"):
        super().__init__(message=message, status_code=403, code="security_error")


class ExternalServiceException(AppException):
    def __init__(self, message: str = "External service error"):
        super().__init__(message=message, status_code=502, code="external_service_error")
