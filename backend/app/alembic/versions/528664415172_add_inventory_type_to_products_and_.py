"""add inventory_type to products and create product_images table

Revision ID: 528664415172
Revises: e34ccf421c59
Create Date: 2026-08-15 01:18:54.647501

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '528664415172'
down_revision: Union[str, Sequence[str], None] = 'e34ccf421c59'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql


inventory_type_enum = postgresql.ENUM(
    'Simple', 'Varient',
    name='inventorytype',
    create_type=False,
)


def upgrade() -> None:
    """Upgrade schema."""
    inventory_type_enum.create(op.get_bind(), checkfirst=True)

    op.add_column(
        'products',
        sa.Column(
            'inventory_type',
            inventory_type_enum,
            nullable=False,
            server_default='Simple',
        ),
    )

    op.create_table(
        'product_images',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('image_url', sa.String(), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_product_images_id'), 'product_images', ['id'], unique=False)
    op.create_index(op.f('ix_product_images_product_id'), 'product_images', ['product_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_product_images_product_id'), table_name='product_images')
    op.drop_index(op.f('ix_product_images_id'), table_name='product_images')
    op.drop_table('product_images')

    op.drop_column('products', 'inventory_type')
    inventory_type_enum.drop(op.get_bind(), checkfirst=True)

