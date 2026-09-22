"""Field-specific validation messages for `type: validation-error` responses."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Any

from pydantic import ValidationError


def validation_message(exc: ValidationError) -> str:
    """One line per error: `<field>: <message>`; model-level errors name the field they cite."""
    return errors_message(exc.errors())


def errors_message(errors: Sequence[Mapping[str, Any]]) -> str:
    """Same rendering for FastAPI's RequestValidationError, whose `loc` starts with `body`."""
    return "; ".join(_line(error) for error in errors)


def _line(error: Mapping[str, Any]) -> str:
    field = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
    message = str(error.get("msg", "")).removeprefix("Value error, ")
    return f"{field}: {message}" if field else message
