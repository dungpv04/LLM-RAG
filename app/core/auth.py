"""Supabase authentication and authorization helpers."""

from typing import Any, Dict, Literal, Optional

from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field

from app.db.dependencies import get_supabase_auth_client, get_supabase_client
from app.db.repository import get_user_repository


bearer_scheme = HTTPBearer(auto_error=False)
Role = Literal["admin", "user"]


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


def _extract_role_from_metadata(user: Any) -> Role:
    """Resolve application role from Supabase auth metadata."""
    app_metadata = _get_attr(user, "app_metadata", {}) or {}
    role = app_metadata.get("role") or "user"
    roles = app_metadata.get("roles") or []

    if role == "admin" or "admin" in roles:
        return "admin"
    return "user"


def sync_user_record_from_supabase_user(
    user: Any,
    default_role: Role = "user",
) -> Dict[str, Any]:
    """
    Ensure a public.users record exists for a Supabase auth user.

    Existing admin users keep their admin role even if the auth metadata is stale.
    """
    user_id = _get_attr(user, "id")
    email = _get_attr(user, "email")
    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Supabase user is missing required identity fields",
        )

    user_metadata = _get_attr(user, "user_metadata", {}) or {}
    full_name = user_metadata.get("full_name") or user_metadata.get("name")

    user_repo = get_user_repository(get_supabase_client())
    existing = user_repo.get_by_id(str(user_id))

    role: Role = default_role
    if existing and existing.get("role") == "admin":
        role = "admin"
    elif _extract_role_from_metadata(user) == "admin":
        role = "admin"

    return user_repo.upsert_user(
        user_id=str(user_id),
        email=str(email),
        full_name=str(full_name) if full_name else None,
        role=role,
    )


def to_authenticated_user(user: Any) -> AuthenticatedUser:
    """Convert a Supabase user object into local auth context backed by public.users."""
    user_id = _get_attr(user, "id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authenticated user",
        )

    app_user = sync_user_record_from_supabase_user(
        user,
        default_role=_extract_role_from_metadata(user),
    )

    return AuthenticatedUser(
        id=str(user_id),
        email=_get_attr(user, "email"),
        role=str(app_user.get("role") or "user"),
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

    return to_authenticated_user(user)


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
