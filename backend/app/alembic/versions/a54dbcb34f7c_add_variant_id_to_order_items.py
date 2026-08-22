"""add variant_id to order_items

Revision ID: a54dbcb34f7c
Revises: cc5fd1eb7d17
Create Date: 2026-08-16 05:32:08.227393

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a54dbcb34f7c'
down_revision: Union[str, Sequence[str], None] = 'cc5fd1eb7d17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('order_items', sa.Column('variant_id', sa.Integer(), nullable=True))
    op.create_foreign_key(None, 'order_items', 'product_variants', ['variant_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint(None, 'order_items', type_='foreignkey')
    op.drop_column('order_items', 'variant_id')
