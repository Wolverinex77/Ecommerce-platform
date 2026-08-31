from alembic import op
import sqlalchemy as sa

revision = "new_revision_id"
down_revision = "bb87b0d1c68b"   # your initial migration

def upgrade():
    op.add_column(
    "users",
    sa.Column("default_shipping_address_id", sa.Integer(), nullable=True),
)

    op.create_foreign_key(
    "fk_users_default_shipping_address",
    "users",
    "shipping_addresses",
    ["default_shipping_address_id"],
    ["id"],
    ondelete="SET NULL",
    )


def downgrade():
    op.drop_constraint(
        "fk_users_default_shipping_address",
        "users",
        type_="foreignkey",
    )
    op.drop_column(
        "users",
        "default_shipping_address_id",
    )