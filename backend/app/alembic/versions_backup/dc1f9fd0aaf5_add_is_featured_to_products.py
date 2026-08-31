"""add is_featured to products

Revision ID: dc1f9fd0aaf5
Revises: c0b11c1eacb1
Create Date: 2026-08-18 19:46:24.475748

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'dc1f9fd0aaf5'
down_revision: Union[str, Sequence[str], None] = 'c0b11c1eacb1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'products',
        sa.Column('is_featured', sa.Boolean(), server_default=sa.text('false'), nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'is_featured')
