from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=6, max_length=128)


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    is_active: bool


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


class PassageiroRead(PassageiroBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    criado_por_user_id: int


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
    status: str = Field(default="planejada", min_length=3, max_length=30)
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
