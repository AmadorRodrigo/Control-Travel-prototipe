from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import get_password_hash
from app.dependencies import (
    enforce_authenticated_read_rate_limit,
    enforce_authenticated_write_rate_limit,
    get_db,
    require_admin,
)
from app.models import User
from app.schemas import UserCreate, UserListResponse, UserRead, UserUpdate


router = APIRouter(prefix="/api/users", tags=["Usuários"])


@router.get("", response_model=UserListResponse)
def listar_usuarios(
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserListResponse:
    enforce_authenticated_read_rate_limit(request, current_user)
    users = db.query(User).order_by(User.username.asc()).all()
    return UserListResponse(items=users)


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def criar_usuario(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nome de usuário já está em uso.")
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já está em uso.")

    user = User(
        username=payload.username,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        is_active=True,
        is_admin=False,  # Never trust payload for admin status on creation
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=UserRead)
def atualizar_usuario(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> UserRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nenhum campo para atualizar.")

    if "username" in updates and updates["username"] != user.username:
        if db.query(User).filter(User.username == updates["username"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Nome de usuário já está em uso.")

    if "email" in updates and updates["email"] != user.email:
        if db.query(User).filter(User.email == updates["email"]).first():
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="E-mail já está em uso.")

    if "password" in updates:
        user.password_hash = get_password_hash(updates.pop("password"))
        # Invalidate all existing access tokens for this user
        user.token_version = (user.token_version + 1) % 2_147_483_647

    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_usuario(
    user_id: int,
    request: Request,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    enforce_authenticated_write_rate_limit(request, current_user)

    if user_id == current_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Não é possível excluir o próprio usuário.")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    db.delete(user)
    db.commit()
