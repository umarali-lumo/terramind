"""Authentication endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import APIError
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
def register(payload: RegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.scalars(
        select(User).where(User.email == payload.email.lower())
    ).first()
    if existing is not None:
        raise APIError(409, "conflict", "An account with this email already exists.")

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name,
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.scalars(
        select(User).where(User.email == payload.email.lower())
    ).first()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise APIError(401, "unauthorized", "Incorrect email or password.")
    return _token_response(user)


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_demo=user.is_demo,
    )


def _token_response(user: User) -> TokenResponse:
    token = create_access_token(str(user.id))
    return TokenResponse(
        access_token=token,
        expires_in_days=settings.access_token_expire_days,
        user=UserResponse(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            is_demo=user.is_demo,
        ),
    )
