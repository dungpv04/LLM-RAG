#!/usr/bin/env python3
"""Create or promote an admin account in Supabase and public.users."""

import argparse
import sys
from pathlib import Path
from typing import Any, Optional

project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from app.db.dependencies import get_supabase_client
from app.db.repository import get_user_repository


def _get_attr(obj: Any, name: str, default: Any = None) -> Any:
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _find_auth_user_by_email(client: Any, email: str) -> Optional[Any]:
    """Find an auth user by email, scanning admin pages if needed."""
    page = 1
    per_page = 200

    while True:
        response = client.auth.admin.list_users(page=page, per_page=per_page)
        users = _get_attr(response, "users", []) or _get_attr(response, "data", [])
        if not users:
            return None

        for user in users:
            if str(_get_attr(user, "email", "")).lower() == email.lower():
                return user

        if len(users) < per_page:
            return None

        page += 1


def ensure_admin(email: str, password: str, full_name: Optional[str] = None) -> int:
    """Create the admin account if missing, otherwise promote and repair it."""
    client = get_supabase_client()
    user_repo = get_user_repository(client)

    auth_user = _find_auth_user_by_email(client, email)
    user_metadata = {"full_name": full_name} if full_name else {}
    app_metadata = {"role": "admin", "roles": ["admin"]}

    if auth_user is None:
        print(f"Admin account {email} not found. Creating it...")
        response = client.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": user_metadata,
            "app_metadata": app_metadata,
        })
        auth_user = _get_attr(response, "user")
        if not auth_user:
            print("Failed to create admin account: Supabase did not return a user.")
            return 1
        print("Admin account created in Supabase Auth.")
    else:
        user_id = _get_attr(auth_user, "id")
        print(f"Admin account {email} already exists. Promoting/repairing it...")
        update_payload = {
            "app_metadata": app_metadata,
        }
        if password:
            update_payload["password"] = password
        if user_metadata:
            update_payload["user_metadata"] = user_metadata

        client.auth.admin.update_user_by_id(str(user_id), update_payload)
        print("Auth metadata updated.")

    user_id = str(_get_attr(auth_user, "id"))
    resolved_name = full_name or _get_attr(auth_user, "user_metadata", {}).get("full_name")
    user_repo.upsert_user(
        user_id=user_id,
        email=email,
        full_name=resolved_name,
        role="admin",
    )
    print("public.users record upserted with admin role.")
    print(f"Admin ready: {email} ({user_id})")
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create an admin account if it does not exist, or promote it if it does."
    )
    parser.add_argument("--email", required=True, help="Admin email")
    parser.add_argument("--password", required=True, help="Admin password")
    parser.add_argument("--full-name", default=None, help="Optional admin full name")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    return ensure_admin(args.email, args.password, args.full_name)


if __name__ == "__main__":
    raise SystemExit(main())
