from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    # is_admin intentionally omitted — admin status is set only via PUT by an existing admin


class UserUpdate(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    email: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6, max_length=128)
    is_active: bool | None = None
    is_admin: bool | None = None


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=6, max_length=128)


class FirstAccessRequest(BaseModel):
    documento: str = Field(min_length=5, max_length=50)
    email: EmailStr
    new_password: str = Field(min_length=6, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    is_active: bool
    is_admin: bool


class UserListResponse(BaseModel):
    items: list[UserRead]


class AuthSessionResponse(TokenResponse):
    user: UserRead


class PassageiroBase(BaseModel):
    nome: str = Field(min_length=3, max_length=150)
    documento: str = Field(min_length=5, max_length=50)
    data_nascimento: date
    telefone: str = Field(min_length=8, max_length=30)
    contato_emergencia: str = Field(min_length=3, max_length=150)


class PassageiroCreate(PassageiroBase):
    pass


class PassageiroUpdate(BaseModel):
    nome: str | None = Field(default=None, min_length=3, max_length=150)
    documento: str | None = Field(default=None, min_length=5, max_length=50)
    data_nascimento: date | None = None
    telefone: str | None = Field(default=None, min_length=8, max_length=30)
    contato_emergencia: str | None = Field(default=None, min_length=3, max_length=150)
    linked_user_id: int | None = None


class PassageiroRead(PassageiroBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_por_user_id: int
    linked_user_id: int | None = None
    linked_user: "UserRead | None" = None


class PaginationMeta(BaseModel):
    page: int
    page_size: int
    total: int
    total_pages: int


class PassageiroListResponse(BaseModel):
    items: list[PassageiroRead]
    pagination: PaginationMeta


class AssentoBase(BaseModel):
    numero: int = Field(gt=0, le=99)
    andar: str = Field(min_length=1, max_length=20)


class AssentoRead(AssentoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    viagem_id: int
    passageiro_id: int | None
    passageiro_nome: str | None = None
    ocupado: bool
    reservado_em: datetime | None


class ReservaAssentoRequest(BaseModel):
    passageiro_id: int = Field(gt=0)
    numero: int = Field(gt=0, le=99)
    andar: str = Field(min_length=1, max_length=20)


class ViagemBase(BaseModel):
    titulo: str = Field(min_length=3, max_length=150)
    origem: str = Field(min_length=2, max_length=120)
    destino: str = Field(min_length=2, max_length=120)
    data_partida: datetime
    status: Literal["planejada", "em_andamento", "concluida", "cancelada"] = "planejada"
    capacidade_andar_inferior: int = Field(default=0, ge=0, le=80)
    capacidade_andar_superior: int = Field(default=0, ge=0, le=80)
    observacoes: str | None = Field(default=None, max_length=1000)


class ViagemCreate(ViagemBase):
    pass


class ViagemRead(ViagemBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_por_user_id: int
    created_at: datetime


class ViagemListResponse(BaseModel):
    items: list[ViagemRead]
    pagination: PaginationMeta


class AssentoComViagemRead(AssentoBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    viagem_id: int
    passageiro_id: int | None
    ocupado: bool
    reservado_em: datetime | None
    viagem: ViagemRead


class MinhaPoltronaResponse(BaseModel):
    passageiro: PassageiroRead
    assentos: list[AssentoComViagemRead]
