"""Authentication API endpoints backed by Supabase Auth."""

import re
from typing import Any, Dict, Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator

from app.core.auth import (
    AuthenticatedUser,
    get_current_user,
    to_authenticated_user,
)
from app.core.config import get_settings
from app.db.dependencies import get_supabase_auth_client, get_supabase_client


router = APIRouter(prefix="/auth", tags=["auth"])
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EmailPasswordRequest(BaseModel):
    """Base model for email/password auth requests."""

    email: str = Field(..., min_length=3)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        """Trim, lowercase, and validate an email address before Supabase."""
        email = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Enter a valid email address, for example user@example.com")
        return email


class SignUpRequest(EmailPasswordRequest):
    """Request body for account registration."""

    password: str = Field(..., min_length=6)
    full_name: Optional[str] = None


class LoginRequest(EmailPasswordRequest):
    """Request body for password login."""

    password: str


class RefreshRequest(BaseModel):
    """Request body for refreshing an access token."""

    refresh_token: Optional[str] = None


class AuthSessionResponse(BaseModel):
    """Auth response returned after signup or login."""

    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    expires_in: Optional[int] = None
    user: AuthenticatedUser


class MeResponse(BaseModel):
    """Current user response."""

    user: AuthenticatedUser


def _get_attr(obj: Any, name: str, default: Any = None) -> Any:
    """Read either object attributes or dictionary keys."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _set_auth_cookies(response: Response, session: Any) -> None:
    """Set HTTP-only auth cookies for browser clients and SSE."""
    access_token = _get_attr(session, "access_token")
    refresh_token = _get_attr(session, "refresh_token")
    expires_in = _get_attr(session, "expires_in", 3600) or 3600

    if access_token:
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="lax",
            max_age=int(expires_in),
        )

    if refresh_token:
        response.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,
        )


def _clear_auth_cookies(response: Response) -> None:
    """Clear auth and chat session cookies."""
    response.delete_cookie(key="access_token")
    response.delete_cookie(key="refresh_token")
    response.delete_cookie(key="session_id")


def _build_auth_response(auth_response: Any) -> AuthSessionResponse:
    """Convert Supabase auth response into API response."""
    user = _get_attr(auth_response, "user")
    session = _get_attr(auth_response, "session")

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authentication did not return a user",
        )

    return AuthSessionResponse(
        access_token=_get_attr(session, "access_token") if session else None,
        refresh_token=_get_attr(session, "refresh_token") if session else None,
        token_type=_get_attr(session, "token_type", "bearer") if session else "bearer",
        expires_in=_get_attr(session, "expires_in") if session else None,
        user=to_authenticated_user(user),
    )


@router.post("/signup", response_model=AuthSessionResponse, status_code=status.HTTP_201_CREATED)
async def signup(request: SignUpRequest, response: Response) -> AuthSessionResponse:
    """
    Create a Supabase Auth user.

    New accounts always receive the user role in public.users unless promoted later.
    """
    metadata: Dict[str, Any] = {}
    if request.full_name:
        metadata["full_name"] = request.full_name

    if get_settings().auth_email_confirm_on_signup:
        try:
            auth_response = get_supabase_auth_client().auth.sign_up({
                "email": request.email,
                "password": request.password,
                "options": {"data": metadata},
            })
        except Exception as e:
            detail = str(e)
            if "rate limit" in detail.lower():
                raise HTTPException(
                    status_code=429,
                    detail=(
                        "Supabase email confirmation rate limit exceeded. "
                        "Wait before retrying, or set AUTH_EMAIL_CONFIRM_ON_SIGNUP=false for local development."
                    ),
                )
            raise HTTPException(status_code=400, detail=detail)
    else:
        try:
            auth_response = get_supabase_client().auth.admin.create_user({
                "email": request.email,
                "password": request.password,
                "email_confirm": True,
                "user_metadata": metadata,
            })
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    session = _get_attr(auth_response, "session")
    if session:
        _set_auth_cookies(response, session)

    return _build_auth_response(auth_response)


@router.post("/login", response_model=AuthSessionResponse)
async def login(request: LoginRequest, response: Response) -> AuthSessionResponse:
    """Log in with email and password."""
    try:
        auth_response = get_supabase_auth_client().auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    session = _get_attr(auth_response, "session")
    if session:
        _set_auth_cookies(response, session)

    return _build_auth_response(auth_response)


@router.get("/me", response_model=MeResponse)
async def me(current_user: AuthenticatedUser = Depends(get_current_user)) -> MeResponse:
    """Return the current authenticated user."""
    return MeResponse(user=current_user)


@router.post("/refresh", response_model=AuthSessionResponse)
async def refresh_session(
    response: Response,
    request: Optional[RefreshRequest] = None,
    refresh_token: Optional[str] = Cookie(None),
) -> AuthSessionResponse:
    """Refresh the Supabase access token."""
    token = (request.refresh_token if request else None) or refresh_token
    if not token:
        raise HTTPException(status_code=400, detail="Refresh token is required")

    try:
        auth_response = get_supabase_auth_client().auth.refresh_session(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    session = _get_attr(auth_response, "session")
    if session:
        _set_auth_cookies(response, session)

    return _build_auth_response(auth_response)


@router.post("/logout")
async def logout(response: Response) -> Dict[str, str]:
    """Log out the current browser session."""
    _clear_auth_cookies(response)
    return {"message": "Logged out successfully"}
