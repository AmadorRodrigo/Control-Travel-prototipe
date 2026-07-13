from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session, joinedload

from app.dependencies import enforce_authenticated_read_rate_limit, get_current_user, get_db
from app.models import Assento, Passageiro, User
from app.schemas import MinhaPoltronaResponse


router = APIRouter(prefix="/api/me", tags=["Minha conta"])


@router.get("/poltrona", response_model=MinhaPoltronaResponse)
def minha_poltrona(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MinhaPoltronaResponse:
    enforce_authenticated_read_rate_limit(request, current_user)

    passageiro = (
        db.query(Passageiro)
        .options(joinedload(Passageiro.linked_user))
        .filter(Passageiro.linked_user_id == current_user.id)
        .first()
    )
    if not passageiro:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nenhum cadastro de passageiro vinculado a este usuário.",
        )

    assentos = (
        db.query(Assento)
        .options(joinedload(Assento.viagem))
        .filter(Assento.passageiro_id == passageiro.id)
        .all()
    )

    return MinhaPoltronaResponse(passageiro=passageiro, assentos=assentos)
