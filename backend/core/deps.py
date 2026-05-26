import uuid
from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.orm import Session

from core.config import settings
from db.session import get_db
from models.users import User

security = HTTPBearer(auto_error=False)

_DECODE_OPTS = {"verify_exp": True, "verify_aud": True}


@lru_cache
def _jwks_client() -> PyJWKClient | None:
    if not settings.supabase_url:
        return None
    base = settings.supabase_url.rstrip("/")
    return PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")


def _decode_with_audience_fallback(
    token: str,
    key: str,
    algorithms: list[str],
) -> dict:
    try:
        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            audience="authenticated",
            options=_DECODE_OPTS,
        )
    except jwt.InvalidAudienceError:
        return jwt.decode(
            token,
            key,
            algorithms=algorithms,
            options={**_DECODE_OPTS, "verify_aud": False},
        )


def _decode_hs256(token: str) -> dict:
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_JWT_SECRET is not configured on the server",
        )
    return _decode_with_audience_fallback(
        token,
        settings.supabase_jwt_secret,
        ["HS256"],
    )


def _decode_jwks(token: str, algorithm: str) -> dict:
    client = _jwks_client()
    if client is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="SUPABASE_URL is not configured on the server",
        )
    signing_key = client.get_signing_key_from_jwt(token)
    return _decode_with_audience_fallback(
        token,
        signing_key.key,
        [algorithm],
    )


def _decode_supabase_jwt(token: str) -> dict:
    try:
        algorithm = jwt.get_unverified_header(token).get("alg", "HS256")
        if algorithm == "HS256":
            return _decode_hs256(token)
        return _decode_jwks(token, algorithm)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired — please sign in again",
        ) from None
    except jwt.InvalidSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token — check SUPABASE_JWT_SECRET matches your Supabase project",
        ) from None
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        ) from None


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(security)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
        )

    token = credentials.credentials
    payload = _decode_supabase_jwt(token)

    supabase_user_id = payload.get("sub")
    if not supabase_user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    user_id = (
        supabase_user_id
        if isinstance(supabase_user_id, uuid.UUID)
        else uuid.UUID(str(supabase_user_id))
    )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


def require_admin(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user
