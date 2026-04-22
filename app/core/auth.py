"""Supabase authentication and authorization helpers."""

from typing import Any, Dict, Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.db.dependencies import get_supabase_auth_client


bearer_scheme = HTTPBearer(auto_error=False)


class AuthenticatedUser(BaseModel):
    """Authenticated Supabase user context used by route dependencies."""

    id: str
    email: Optional[str] = None
    role: str = "user"
    app_metadata: Dict[str, Any] = Field(default_factory=dict)
    user_metadata: Dict[str, Any] = Field(default_factory=dict)


def _get_attr(obj: Any, name: str, default: Any = None) -> Any:
    """Read either object attributes or dictionary keys."""
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _extract_role(user: Any) -> str:
    """Resolve application role from Supabase metadata."""
    app_metadata = _get_attr(user, "app_metadata", {}) or {}

    role = app_metadata.get("role") or "user"
    roles = app_metadata.get("roles") or []

    if role == "admin" or "admin" in roles:
        return "admin"

    return "user"


def _to_authenticated_user(user: Any) -> AuthenticatedUser:
    """Convert a Supabase user object into local auth context."""
    user_id = _get_attr(user, "id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user",
        )

    return AuthenticatedUser(
        id=str(user_id),
        email=_get_attr(user, "email"),
        role=_extract_role(user),
        app_metadata=_get_attr(user, "app_metadata", {}) or {},
        user_metadata=_get_attr(user, "user_metadata", {}) or {},
    )


def _token_from_request(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials],
    access_token: Optional[str],
) -> Optional[str]:
    """Get an access token from Authorization, auth cookie, or SSE query params."""
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials

    if access_token:
        return access_token

    query_token = request.query_params.get("access_token")
    if query_token:
        return query_token

    return None


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    access_token: Optional[str] = Cookie(None),
) -> AuthenticatedUser:
    """Require a valid Supabase access token."""
    token = _token_from_request(request, credentials, access_token)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        response = get_supabase_auth_client().auth.get_user(token)
        user = _get_attr(response, "user")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _to_authenticated_user(user)


async def require_admin(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AuthenticatedUser:
    """Require an authenticated admin user."""
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user
