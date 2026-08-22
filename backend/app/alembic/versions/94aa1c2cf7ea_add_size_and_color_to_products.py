"""add size and color to products

Revision ID: 94aa1c2cf7ea
Revises: dc1f9fd0aaf5
Create Date: 2026-08-18 22:27:15.299933

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '94aa1c2cf7ea'
down_revision: Union[str, Sequence[str], None] = 'dc1f9fd0aaf5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('products', sa.Column('color', sa.String(), nullable=True))
    op.add_column('products', sa.Column('size', sa.String(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'size')
    op.drop_column('products', 'color')
