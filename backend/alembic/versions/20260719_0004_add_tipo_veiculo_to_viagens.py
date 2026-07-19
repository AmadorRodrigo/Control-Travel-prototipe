"""add tipo_veiculo to viagens

Revision ID: 20260719_0004
Revises: 20260713_0003
Create Date: 2026-07-19
"""
from alembic import op
import sqlalchemy as sa

revision = "20260719_0004"
down_revision = "20260713_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "viagens",
        sa.Column("tipo_veiculo", sa.String(20), nullable=False, server_default="onibus"),
    )


def downgrade() -> None:
    op.drop_column("viagens", "tipo_veiculo")
