"""create product_variants table

Revision ID: e34ccf421c59
Revises: 9b3e0fd8461f
Create Date: 2026-08-14 04:05:47.769191

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e34ccf421c59'
down_revision: Union[str, Sequence[str], None] = '9b3e0fd8461f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'product_variants',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('color', sa.String(), nullable=False),
        sa.Column('size', sa.String(), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_product_variants_id'), 'product_variants', ['id'], unique=False)
    op.create_index(op.f('ix_product_variants_product_id'), 'product_variants', ['product_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_product_variants_product_id'), table_name='product_variants')
    op.drop_index(op.f('ix_product_variants_id'), table_name='product_variants')
    op.drop_table('product_variants')

