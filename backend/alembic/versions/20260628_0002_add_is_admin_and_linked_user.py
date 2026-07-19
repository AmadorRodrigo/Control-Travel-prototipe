"""add is_admin to users and linked_user_id to passageiros

Revision ID: 20260628_0002
Revises: 20260624_0001
Create Date: 2026-06-28 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260628_0002"
down_revision = "20260624_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("passageiros", sa.Column("linked_user_id", sa.Integer(), nullable=True))
    op.create_index("ix_passageiros_linked_user_id", "passageiros", ["linked_user_id"], unique=False)
    op.create_foreign_key(
        "fk_passageiros_linked_user_id",
        "passageiros",
        "users",
        ["linked_user_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_passageiros_linked_user_id", "passageiros", type_="foreignkey")
    op.drop_index("ix_passageiros_linked_user_id", table_name="passageiros")
    op.drop_column("passageiros", "linked_user_id")
    op.drop_column("users", "is_admin")
