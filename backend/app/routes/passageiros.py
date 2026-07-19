import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from math import ceil
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.dependencies import (
    enforce_authenticated_read_rate_limit,
    enforce_authenticated_write_rate_limit,
    get_current_user,
    get_db,
)
from app.models import IdempotencyKey, Passageiro, User
from app.schemas import PassageiroCreate, PassageiroListResponse, PassageiroRead, PassageiroUpdate, PaginationMeta


router = APIRouter(prefix="/api/passageiros", tags=["Passageiros"])

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$",
    re.IGNORECASE,
)


def _validate_idempotency_key(key: str | None) -> None:
    if key and not _UUID_RE.match(key):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Idempotency-Key deve ser um UUID v4 válido.",
        )


def build_passageiro_request_hash(payload: PassageiroCreate) -> str:
    serialized_payload = json.dumps(
        payload.model_dump(mode="json"),
        sort_keys=True,
        ensure_ascii=False,
    )
    return hashlib.sha256(serialized_payload.encode("utf-8")).hexdigest()


@router.get("", response_model=PassageiroListResponse)
def listar_passageiros(
    request: Request,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=settings.default_page_size, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PassageiroListResponse:
    enforce_authenticated_read_rate_limit(request, current_user)

    if page_size > settings.max_page_size:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"O page_size máximo permitido é {settings.max_page_size}.",
        )

    query = (
        db.query(Passageiro)
        .options(joinedload(Passageiro.linked_user))
        .filter(Passageiro.criado_por_user_id == current_user.id)
        .order_by(Passageiro.nome.asc())
    )
    total = query.count()
    total_pages = ceil(total / page_size) if total else 0
    offset = (page - 1) * page_size
    passageiros = query.offset(offset).limit(page_size).all()

    return PassageiroListResponse(
        items=passageiros,
        pagination=PaginationMeta(
            page=page,
            page_size=page_size,
            total=total,
            total_pages=total_pages,
        ),
    )


@router.post("", response_model=PassageiroRead, status_code=status.HTTP_201_CREATED)
def criar_passageiro(
    payload: PassageiroCreate,
    request: Request,
    response: Response,
    idempotency_key: Annotated[str | None, Header(alias="Idempotency-Key")] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PassageiroRead:
    enforce_authenticated_write_rate_limit(request, current_user)
    _validate_idempotency_key(idempotency_key)

    active_idempotency_record = None
    payload_hash = build_passageiro_request_hash(payload)
    now = datetime.now(timezone.utc)

    if idempotency_key:
        existing_idempotency_record = (
            db.query(IdempotencyKey)
            .filter(
                IdempotencyKey.user_id == current_user.id,
                IdempotencyKey.resource == "passageiro:create",
                IdempotencyKey.key == idempotency_key,
            )
            .first()
        )

        if existing_idempotency_record and existing_idempotency_record.expires_at <= now:
            db.delete(existing_idempotency_record)
            db.flush()
        else:
            active_idempotency_record = existing_idempotency_record

    if active_idempotency_record:
        if active_idempotency_record.request_hash != payload_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A chave de idempotência já foi usada com outro payload.",
            )

        passenger = (
            db.query(Passageiro)
            .filter(Passageiro.id == active_idempotency_record.passageiro_id)
            .first()
        )
        if passenger:
            response.status_code = status.HTTP_200_OK
            return passenger

    documento_ja_cadastrado = (
        db.query(Passageiro)
        .filter(Passageiro.documento == payload.documento)
        .first()
    )
    if documento_ja_cadastrado:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um passageiro com este documento.",
        )

    passageiro = Passageiro(
        **payload.model_dump(),
        criado_por_user_id=current_user.id,
    )
    db.add(passageiro)
    db.flush()

    if idempotency_key:
        idempotency_record = IdempotencyKey(
            user_id=current_user.id,
            resource="passageiro:create",
            key=idempotency_key,
            request_hash=payload_hash,
            response_status_code=status.HTTP_201_CREATED,
            passageiro_id=passageiro.id,
            expires_at=now + timedelta(minutes=settings.idempotency_ttl_minutes),
        )
        db.add(idempotency_record)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()

        if not idempotency_key:
            raise

        persisted_idempotency_record = (
            db.query(IdempotencyKey)
            .filter(
                IdempotencyKey.user_id == current_user.id,
                IdempotencyKey.resource == "passageiro:create",
                IdempotencyKey.key == idempotency_key,
            )
            .first()
        )

        if (
            persisted_idempotency_record
            and persisted_idempotency_record.request_hash == payload_hash
            and persisted_idempotency_record.passageiro_id
        ):
            passenger = (
                db.query(Passageiro)
                .filter(Passageiro.id == persisted_idempotency_record.passageiro_id)
                .first()
            )
            if passenger:
                response.status_code = status.HTTP_200_OK
                return passenger

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Conflito ao processar a requisição. Tente novamente.",
        )

    db.refresh(passageiro)
    return passageiro


@router.get("/{passageiro_id}", response_model=PassageiroRead)
def obter_passageiro(
    passageiro_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PassageiroRead:
    enforce_authenticated_read_rate_limit(request, current_user)

    passageiro = (
        db.query(Passageiro)
        .options(joinedload(Passageiro.linked_user))
        .filter(
            Passageiro.id == passageiro_id,
            Passageiro.criado_por_user_id == current_user.id,
        )
        .first()
    )
    if not passageiro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passageiro não encontrado.")

    return passageiro


@router.put("/{passageiro_id}", response_model=PassageiroRead)
def atualizar_passageiro(
    passageiro_id: int,
    payload: PassageiroUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PassageiroRead:
    enforce_authenticated_write_rate_limit(request, current_user)

    passageiro = (
        db.query(Passageiro)
        .options(joinedload(Passageiro.linked_user))
        .filter(
            Passageiro.id == passageiro_id,
            Passageiro.criado_por_user_id == current_user.id,
        )
        .first()
    )
    if not passageiro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passageiro não encontrado.")

    updates = payload.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Nenhum campo para atualizar.")

    if "linked_user_id" in updates and updates["linked_user_id"] is not None:
        linked_user = db.query(User).filter(User.id == updates["linked_user_id"]).first()
        if not linked_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuário não encontrado.")

    if "documento" in updates and updates["documento"] != passageiro.documento:
        conflito = (
            db.query(Passageiro)
            .filter(
                Passageiro.documento == updates["documento"],
                Passageiro.id != passageiro_id,
            )
            .first()
        )
        if conflito:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe um passageiro com este documento.")

    for field, value in updates.items():
        setattr(passageiro, field, value)

    db.commit()
    db.refresh(passageiro)
    return passageiro


@router.delete("/{passageiro_id}", status_code=status.HTTP_204_NO_CONTENT)
def deletar_passageiro(
    passageiro_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    enforce_authenticated_write_rate_limit(request, current_user)

    passageiro = (
        db.query(Passageiro)
        .filter(
            Passageiro.id == passageiro_id,
            Passageiro.criado_por_user_id == current_user.id,
        )
        .first()
    )
    if not passageiro:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Passageiro não encontrado.")

    db.query(IdempotencyKey).filter(IdempotencyKey.passageiro_id == passageiro_id).delete()
    db.delete(passageiro)
    db.commit()
