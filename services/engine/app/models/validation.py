"""Field-specific validation messages for `type: validation-error` responses."""

from __future__ import annotations

from pydantic import ValidationError
from pydantic_core import ErrorDetails


def validation_message(exc: ValidationError) -> str:
    """One line per error: `<field>: <message>`; model-level errors name the field they cite."""
    return "; ".join(_line(error) for error in exc.errors())


def _line(error: ErrorDetails) -> str:
    field = ".".join(str(part) for part in error["loc"] if part != "body")
    message = error["msg"].removeprefix("Value error, ")
    return f"{field}: {message}" if field else message
