"""initial schema

Revision ID: 20260624_0001
Revises: None
Create Date: 2026-06-24 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260624_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.create_index("ix_users_id", "users", ["id"], unique=False)
    op.create_index("ix_users_username", "users", ["username"], unique=True)
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "passageiros",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("nome", sa.String(length=150), nullable=False),
        sa.Column("documento", sa.String(length=50), nullable=False),
        sa.Column("data_nascimento", sa.Date(), nullable=False),
        sa.Column("telefone", sa.String(length=30), nullable=False),
        sa.Column("contato_emergencia", sa.String(length=150), nullable=False),
        sa.Column("criado_por_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
    )
    op.create_index("ix_passageiros_id", "passageiros", ["id"], unique=False)
    op.create_index("ix_passageiros_nome", "passageiros", ["nome"], unique=False)
    op.create_index("ix_passageiros_documento", "passageiros", ["documento"], unique=True)
    op.create_index("ix_passageiros_criado_por_user_id", "passageiros", ["criado_por_user_id"], unique=False)

    op.create_table(
        "viagens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("titulo", sa.String(length=150), nullable=False),
        sa.Column("origem", sa.String(length=120), nullable=False),
        sa.Column("destino", sa.String(length=120), nullable=False),
        sa.Column("data_partida", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="planejada"),
        sa.Column("capacidade_andar_inferior", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("capacidade_andar_superior", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("observacoes", sa.Text(), nullable=True),
        sa.Column("criado_por_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_viagens_id", "viagens", ["id"], unique=False)
    op.create_index("ix_viagens_titulo", "viagens", ["titulo"], unique=False)
    op.create_index("ix_viagens_origem", "viagens", ["origem"], unique=False)
    op.create_index("ix_viagens_destino", "viagens", ["destino"], unique=False)
    op.create_index("ix_viagens_data_partida", "viagens", ["data_partida"], unique=False)
    op.create_index("ix_viagens_status", "viagens", ["status"], unique=False)
    op.create_index("ix_viagens_criado_por_user_id", "viagens", ["criado_por_user_id"], unique=False)

    op.create_table(
        "assentos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("viagem_id", sa.Integer(), sa.ForeignKey("viagens.id"), nullable=False),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("andar", sa.String(length=20), nullable=False),
        sa.Column("passageiro_id", sa.Integer(), sa.ForeignKey("passageiros.id"), nullable=True),
        sa.Column("reservado_em", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("viagem_id", "numero", "andar", name="uq_assento_viagem_numero_andar"),
    )
    op.create_index("ix_assentos_id", "assentos", ["id"], unique=False)
    op.create_index("ix_assentos_viagem_id", "assentos", ["viagem_id"], unique=False)
    op.create_index("ix_assentos_numero", "assentos", ["numero"], unique=False)
    op.create_index("ix_assentos_andar", "assentos", ["andar"], unique=False)

    op.create_table(
        "idempotency_keys",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("resource", sa.String(length=100), nullable=False),
        sa.Column("key", sa.String(length=128), nullable=False),
        sa.Column("request_hash", sa.String(length=64), nullable=False),
        sa.Column("response_status_code", sa.Integer(), nullable=False, server_default="201"),
        sa.Column("passageiro_id", sa.Integer(), sa.ForeignKey("passageiros.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("user_id", "resource", "key", name="uq_idempotency_user_resource_key"),
    )
    op.create_index("ix_idempotency_keys_id", "idempotency_keys", ["id"], unique=False)
    op.create_index("ix_idempotency_keys_user_id", "idempotency_keys", ["user_id"], unique=False)
    op.create_index("ix_idempotency_keys_resource", "idempotency_keys", ["resource"], unique=False)
    op.create_index("ix_idempotency_keys_passageiro_id", "idempotency_keys", ["passageiro_id"], unique=False)
    op.create_index("ix_idempotency_keys_expires_at", "idempotency_keys", ["expires_at"], unique=False)

    op.create_table(
        "refresh_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by_ip", sa.String(length=64), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_refresh_sessions_id", "refresh_sessions", ["id"], unique=False)
    op.create_index("ix_refresh_sessions_user_id", "refresh_sessions", ["user_id"], unique=False)
    op.create_index("ix_refresh_sessions_jti", "refresh_sessions", ["jti"], unique=True)
    op.create_index("ix_refresh_sessions_expires_at", "refresh_sessions", ["expires_at"], unique=False)
    op.create_index("ix_refresh_sessions_revoked_at", "refresh_sessions", ["revoked_at"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_refresh_sessions_revoked_at", table_name="refresh_sessions")
    op.drop_index("ix_refresh_sessions_expires_at", table_name="refresh_sessions")
    op.drop_index("ix_refresh_sessions_jti", table_name="refresh_sessions")
    op.drop_index("ix_refresh_sessions_user_id", table_name="refresh_sessions")
    op.drop_index("ix_refresh_sessions_id", table_name="refresh_sessions")
    op.drop_table("refresh_sessions")

    op.drop_index("ix_idempotency_keys_expires_at", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_passageiro_id", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_resource", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_user_id", table_name="idempotency_keys")
    op.drop_index("ix_idempotency_keys_id", table_name="idempotency_keys")
    op.drop_table("idempotency_keys")

    op.drop_index("ix_assentos_andar", table_name="assentos")
    op.drop_index("ix_assentos_numero", table_name="assentos")
    op.drop_index("ix_assentos_viagem_id", table_name="assentos")
    op.drop_index("ix_assentos_id", table_name="assentos")
    op.drop_table("assentos")

    op.drop_index("ix_viagens_criado_por_user_id", table_name="viagens")
    op.drop_index("ix_viagens_status", table_name="viagens")
    op.drop_index("ix_viagens_data_partida", table_name="viagens")
    op.drop_index("ix_viagens_destino", table_name="viagens")
    op.drop_index("ix_viagens_origem", table_name="viagens")
    op.drop_index("ix_viagens_titulo", table_name="viagens")
    op.drop_index("ix_viagens_id", table_name="viagens")
    op.drop_table("viagens")

    op.drop_index("ix_passageiros_criado_por_user_id", table_name="passageiros")
    op.drop_index("ix_passageiros_documento", table_name="passageiros")
    op.drop_index("ix_passageiros_nome", table_name="passageiros")
    op.drop_index("ix_passageiros_id", table_name="passageiros")
    op.drop_table("passageiros")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
