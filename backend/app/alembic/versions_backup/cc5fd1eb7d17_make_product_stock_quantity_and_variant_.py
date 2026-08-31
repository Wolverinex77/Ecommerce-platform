"""make product stock_quantity and variant quantity nullable

Revision ID: cc5fd1eb7d17
Revises: 528664415172
Create Date: 2026-08-15 04:39:10.289094

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'cc5fd1eb7d17'
down_revision: Union[str, Sequence[str], None] = '528664415172'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('products', 'stock_quantity',
               existing_type=sa.INTEGER(),
               nullable=True)
    op.alter_column('product_variants', 'quantity',
               existing_type=sa.INTEGER(),
               nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('product_variants', 'quantity',
               existing_type=sa.INTEGER(),
               nullable=False)
    op.alter_column('products', 'stock_quantity',
               existing_type=sa.INTEGER(),
               nullable=False)

