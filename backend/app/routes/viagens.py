from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.dependencies import (
    enforce_authenticated_read_rate_limit,
    enforce_authenticated_write_rate_limit,
    get_current_user,
    get_db,
)
from app.models import Assento, Passageiro, User, Viagem
from app.schemas import (
    AssentoRead,
    PaginationMeta,
    ReservaAssentoRequest,
    ViagemCreate,
    ViagemListResponse,
    ViagemRead,
    ViagemUpdate,
)


router = APIRouter(prefix="/api/viagens", tags=["Viagens"])


def build_assentos_for_viagem(viagem_id: int, inferior: int, superior: int) -> list[Assento]:
    assentos: list[Assento] = []

    for numero in range(1, inferior + 1):
        assentos.append(Assento(viagem_id=viagem_id, numero=numero, andar="inferior"))

    for numero in range(1, superior + 1):
        assentos.append(Assento(viagem_id=viagem_id, numero=numero, andar="superior"))

    return assentos


@router.get("", response_model=ViagemListResponse)
def listar_viagens(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=settings.default_page_size, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ViagemListResponse:
    enforce_authenticated_read_rate_limit(request, current_user)

    if page_size > settings.max_page_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"O page_size máximo permitido é {settings.max_page_size}.",
        )

    query = (
        db.query(Viagem)
        .filter(Viagem.criado_por_user_id == current_user.id)
        .order_by(Viagem.data_partida.asc())
    )
    total = query.count()
    total_pages = ceil(total / page_size) if total else 0
    viagens = query.offset((page - 1) * page_size).limit(page_size).all()

    return ViagemListResponse(
        items=viagens,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.post("", response_model=ViagemRead, status_code=status.HTTP_201_CREATED)
def criar_viagem(
    payload: ViagemCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ViagemRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    capacidade_total = payload.capacidade_andar_inferior + payload.capacidade_andar_superior
    if capacidade_total <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A viagem precisa ter pelo menos um assento configurado.",
        )

    viagem = Viagem(
        **payload.model_dump(),
        criado_por_user_id=current_user.id,
    )
    db.add(viagem)
    db.flush()

    for assento in build_assentos_for_viagem(
        viagem.id,
        payload.capacidade_andar_inferior,
        payload.capacidade_andar_superior,
    ):
        db.add(assento)

    db.commit()
    db.refresh(viagem)
    return viagem


@router.put("/{viagem_id}", response_model=ViagemRead)
def atualizar_viagem(
    viagem_id: int,
    payload: ViagemUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ViagemRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    viagem = (
        db.query(Viagem)
        .filter(Viagem.id == viagem_id, Viagem.criado_por_user_id == current_user.id)
        .first()
    )
    if not viagem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Viagem não encontrada.")

    data = payload.model_dump(exclude_unset=True)

    new_inf = data.pop("capacidade_andar_inferior", None)
    new_sup = data.pop("capacidade_andar_superior", None)

    for field, value in data.items():
        setattr(viagem, field, value)

    if new_inf is not None and new_inf != viagem.capacidade_andar_inferior:
        current_inf = viagem.capacidade_andar_inferior
        if new_inf < current_inf:
            occupied = db.query(Assento).filter(
                Assento.viagem_id == viagem_id,
                Assento.andar == "inferior",
                Assento.numero > new_inf,
                Assento.passageiro_id.isnot(None),
            ).count()
            if occupied:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Não é possível reduzir: {occupied} assento(s) ocupado(s) seriam removidos.",
                )
            db.query(Assento).filter(
                Assento.viagem_id == viagem_id,
                Assento.andar == "inferior",
                Assento.numero > new_inf,
            ).delete()
        else:
            for numero in range(current_inf + 1, new_inf + 1):
                db.add(Assento(viagem_id=viagem_id, numero=numero, andar="inferior"))
        viagem.capacidade_andar_inferior = new_inf

    if new_sup is not None and new_sup != viagem.capacidade_andar_superior:
        current_sup = viagem.capacidade_andar_superior
        if new_sup < current_sup:
            occupied = db.query(Assento).filter(
                Assento.viagem_id == viagem_id,
                Assento.andar == "superior",
                Assento.numero > new_sup,
                Assento.passageiro_id.isnot(None),
            ).count()
            if occupied:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Não é possível reduzir: {occupied} assento(s) ocupado(s) seriam removidos.",
                )
            db.query(Assento).filter(
                Assento.viagem_id == viagem_id,
                Assento.andar == "superior",
                Assento.numero > new_sup,
            ).delete()
        else:
            for numero in range(current_sup + 1, new_sup + 1):
                db.add(Assento(viagem_id=viagem_id, numero=numero, andar="superior"))
        viagem.capacidade_andar_superior = new_sup

    db.commit()
    db.refresh(viagem)
    return viagem


@router.get("/{viagem_id}/assentos", response_model=list[AssentoRead])
def listar_assentos_por_viagem(
    viagem_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssentoRead]:
    enforce_authenticated_read_rate_limit(request, current_user)

    viagem = (
        db.query(Viagem)
        .filter(Viagem.id == viagem_id, Viagem.criado_por_user_id == current_user.id)
        .first()
    )
    if not viagem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Viagem não encontrada.")

    assentos = (
        db.query(Assento)
        .options(joinedload(Assento.passageiro))
        .filter(Assento.viagem_id == viagem_id)
        .order_by(Assento.andar.asc(), Assento.numero.asc())
        .all()
    )
    return assentos


@router.post("/{viagem_id}/assentos/reservar", response_model=AssentoRead)
def reservar_assento(
    viagem_id: int,
    payload: ReservaAssentoRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssentoRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    viagem = (
        db.query(Viagem)
        .filter(Viagem.id == viagem_id, Viagem.criado_por_user_id == current_user.id)
        .first()
    )
    if not viagem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Viagem não encontrada.")

    passageiro = (
        db.query(Passageiro)
        .filter(
            Passageiro.id == payload.passageiro_id,
            Passageiro.criado_por_user_id == current_user.id,
        )
        .first()
    )
    if not passageiro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passageiro não encontrado.")

    assento = db.execute(
        select(Assento)
        .where(
            Assento.viagem_id == viagem_id,
            Assento.numero == payload.numero,
            Assento.andar == payload.andar,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if not assento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assento não encontrado.")

    if assento.passageiro_id and assento.passageiro_id != payload.passageiro_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este assento já está reservado para outro passageiro.",
        )

    assento_existente_do_passageiro = db.execute(
        select(Assento)
        .where(
            Assento.viagem_id == viagem_id,
            Assento.passageiro_id == payload.passageiro_id,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if assento_existente_do_passageiro and assento_existente_do_passageiro.id != assento.id:
        assento_existente_do_passageiro.liberar()

    assento.reservar_para(payload.passageiro_id)
    db.commit()
    db.refresh(assento)
    return assento


@router.delete("/{viagem_id}/assentos/{assento_id}/reserva", response_model=AssentoRead)
def liberar_assento(
    viagem_id: int,
    assento_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssentoRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    assento = db.execute(
        select(Assento)
        .join(Viagem, Viagem.id == Assento.viagem_id)
        .where(
            Assento.id == assento_id,
            Assento.viagem_id == viagem_id,
            Viagem.criado_por_user_id == current_user.id,
        )
        .with_for_update()
    ).scalar_one_or_none()

    if not assento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assento não encontrado.")

    assento.liberar()
    db.commit()
    db.refresh(assento)
    return assento
