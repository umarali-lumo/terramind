"""FastAPI dependencies: auth, ownership scoping."""

from __future__ import annotations

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError, forbidden, not_found
from app.core.security import decode_access_token
from app.db.models import Farm, Field, User

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise APIError(401, "unauthorized", "Authentication required.")

    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise APIError(401, "unauthorized", "Invalid or expired token.")

    user = db.get(User, int(payload["sub"]))
    if user is None:
        raise APIError(401, "unauthorized", "User no longer exists.")
    return user


def get_farm_or_404(
    farm_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Farm:
    farm = db.get(Farm, farm_id)
    if farm is None:
        raise not_found("Farm", farm_id)
    if farm.user_id != user.id:
        raise forbidden()
    return farm


def get_field_or_404(
    field_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Field:
    field = db.get(Field, field_id)
    if field is None:
        raise not_found("Field", field_id)
    if field.farm.user_id != user.id:
        raise forbidden()
    return field
