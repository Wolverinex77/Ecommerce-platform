"""add variant_id to cart_items

Revision ID: c0b11c1eacb1
Revises: a54dbcb34f7c
Create Date: 2026-08-17 04:12:14.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c0b11c1eacb1'
down_revision: Union[str, Sequence[str], None] = 'a54dbcb34f7c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('cart_items', sa.Column('variant_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'cart_items_variant_id_fkey',
        'cart_items',
        'product_variants',
        ['variant_id'],
        ['id'],
        ondelete='CASCADE'
    )


def downgrade() -> None:
    op.drop_constraint('cart_items_variant_id_fkey', 'cart_items', type_='foreignkey')
    op.drop_column('cart_items', 'variant_id')
