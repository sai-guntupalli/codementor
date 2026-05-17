from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from supabase import create_client

from core.config import settings
from db.session import get_db
from models.users import User
from schemas.auth import AuthResponse, SignInRequest, SignUpRequest

router = APIRouter(prefix="/auth", tags=["auth"])


def _get_supabase():
    return create_client(settings.supabase_url, settings.supabase_key)


@router.post("/signup", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignUpRequest, db: Session = Depends(get_db)):
    sb = _get_supabase()
    try:
        response = sb.auth.sign_up({"email": body.email, "password": body.password})
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    if not response.user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Sign-up failed")

    existing = db.query(User).filter(User.id == response.user.id).first()
    is_new = existing is None
    if is_new:
        try:
            user = User(
                id=response.user.id,
                email=response.user.email or body.email,
                profile_level="student",
            )
            db.add(user)
            db.commit()
        except Exception as exc:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to create local user record: {exc}",
            ) from exc

    access_token = response.session.access_token if response.session else None
    refresh_token = response.session.refresh_token if response.session else None

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=str(response.user.id),
        is_new_user=is_new,
    )


@router.post("/login", response_model=AuthResponse)
def login(body: SignInRequest, db: Session = Depends(get_db)):
    del db
    sb = _get_supabase()
    try:
        response = sb.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc)) from exc

    if not response.user or not response.session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    return AuthResponse(
        access_token=response.session.access_token,
        refresh_token=response.session.refresh_token,
        user_id=str(response.user.id),
        is_new_user=False,
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout():
    return None
