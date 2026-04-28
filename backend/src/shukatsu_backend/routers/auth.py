from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session

from ..auth import create_access_token, find_user_by_credentials, get_current_user
from ..database import get_session
from ..models import User
from ..schemas import LoginRequest, LoginResponse, SignupRequest, UserOut, UserUpdate


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/signup", response_model=LoginResponse)
def signup(payload: SignupRequest, session: Session = Depends(get_session)):
    existing = find_user_by_credentials(session, payload.first_name, payload.birthday)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="同じ名前と生年月日のアカウントが既に存在します。ログインしてください。",
        )
    user = User(
        first_name=payload.first_name,
        birthday=payload.birthday,
        display_name=payload.display_name,
        email=payload.email,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    token = create_access_token(user)
    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, session: Session = Depends(get_session)):
    user = find_user_by_credentials(session, payload.first_name, payload.birthday)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="名前と生年月日が一致するアカウントが見つかりません",
        )
    token = create_access_token(user)
    return LoginResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut.model_validate(user)


@router.patch("/me", response_model=UserOut)
def update_me(
    payload: UserUpdate,
    user: User = Depends(get_current_user),
    session: Session = Depends(get_session),
):
    if payload.display_name is not None:
        user.display_name = payload.display_name
    if payload.email is not None:
        user.email = str(payload.email) if payload.email else None
    session.add(user)
    session.commit()
    session.refresh(user)
    return UserOut.model_validate(user)
