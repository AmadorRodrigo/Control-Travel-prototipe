from datetime import date, datetime, timezone

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    passageiros: Mapped[list["Passageiro"]] = relationship(
        back_populates="criado_por",
        cascade="all, delete-orphan",
        foreign_keys="Passageiro.criado_por_user_id",
    )
    viagens: Mapped[list["Viagem"]] = relationship(
        back_populates="criado_por",
        cascade="all, delete-orphan",
    )
    idempotency_keys: Mapped[list["IdempotencyKey"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    refresh_sessions: Mapped[list["RefreshSession"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )


class Passageiro(Base):
    __tablename__ = "passageiros"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    nome: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    documento: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    data_nascimento: Mapped[date] = mapped_column(Date, nullable=False)
    telefone: Mapped[str] = mapped_column(String(30), nullable=False)
    contato_emergencia: Mapped[str] = mapped_column(String(150), nullable=False)
    criado_por_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    linked_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    criado_por: Mapped["User"] = relationship(back_populates="passageiros", foreign_keys=[criado_por_user_id])
    linked_user: Mapped["User | None"] = relationship(foreign_keys=[linked_user_id])
    assentos: Mapped[list["Assento"]] = relationship(back_populates="passageiro")


class Viagem(Base):
    __tablename__ = "viagens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    titulo: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    origem: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    destino: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    data_partida: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="planejada", index=True)
    capacidade_andar_inferior: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    capacidade_andar_superior: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observacoes: Mapped[str | None] = mapped_column(Text, nullable=True)
    criado_por_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )

    criado_por: Mapped["User"] = relationship(back_populates="viagens")
    assentos: Mapped[list["Assento"]] = relationship(
        back_populates="viagem",
        cascade="all, delete-orphan",
    )


class Assento(Base):
    __tablename__ = "assentos"
    __table_args__ = (
        UniqueConstraint("viagem_id", "numero", "andar", name="uq_assento_viagem_numero_andar"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    viagem_id: Mapped[int] = mapped_column(ForeignKey("viagens.id"), nullable=False, index=True)
    numero: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    andar: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    passageiro_id: Mapped[int | None] = mapped_column(
        ForeignKey("passageiros.id"),
        nullable=True,
    )
    reservado_em: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
        default=None,
    )

    viagem: Mapped["Viagem"] = relationship(back_populates="assentos")
    passageiro: Mapped["Passageiro | None"] = relationship(back_populates="assentos")

    def reservar_para(self, passageiro_id: int) -> None:
        self.passageiro_id = passageiro_id
        self.reservado_em = datetime.now(timezone.utc)

    def liberar(self) -> None:
        self.passageiro_id = None
        self.reservado_em = None

    @property
    def ocupado(self) -> bool:
        return self.passageiro_id is not None

    @property
    def passageiro_nome(self) -> str | None:
        return self.passageiro.nome if self.passageiro else None


class IdempotencyKey(Base):
    __tablename__ = "idempotency_keys"
    __table_args__ = (
        UniqueConstraint("user_id", "resource", "key", name="uq_idempotency_user_resource_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    resource: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    key: Mapped[str] = mapped_column(String(128), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    response_status_code: Mapped[int] = mapped_column(Integer, nullable=False, default=201)
    passageiro_id: Mapped[int | None] = mapped_column(
        ForeignKey("passageiros.id"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)

    user: Mapped["User"] = relationship(back_populates="idempotency_keys")


class RefreshSession(Base):
    __tablename__ = "refresh_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    jti: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_by_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

    user: Mapped["User"] = relationship(back_populates="refresh_sessions")
