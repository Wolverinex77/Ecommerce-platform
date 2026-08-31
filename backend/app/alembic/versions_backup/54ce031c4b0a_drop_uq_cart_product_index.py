"""drop_uq_cart_product_index

Revision ID: 54ce031c4b0a
Revises: 94aa1c2cf7ea
Create Date: 2026-08-20 23:12:27.548715

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '54ce031c4b0a'
down_revision: Union[str, Sequence[str], None] = '94aa1c2cf7ea'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.drop_constraint(
        "uq_cart_product",
        "cart_items",
        type_="unique"
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.create_unique_constraint(
        "uq_cart_product",
        "cart_items",
        ["cart_id", "product_id"]
    )




