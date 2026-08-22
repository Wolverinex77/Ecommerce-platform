from datetime import datetime
from typing import List
from decimal import Decimal
from sqlalchemy import ForeignKey, DateTime, func,UniqueConstraint,Numeric,Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app import models
from app.db.database import Base
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from .products import Product
    from .users import User


class Cart(Base):
    __tablename__ = "carts"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )

    user: Mapped["User"] = relationship(
        back_populates="cart"
    )

    cart_items: Mapped[List["CartItem"]] = relationship(
        back_populates="cart",
        cascade="all, delete-orphan",
    )
    
class CartItem(Base):
    __tablename__ = "cart_items"
  
    __table_args__ = (
        Index(
        "uq_cart_product_variant",
        "cart_id",
        "product_id",
        "variant_id",
        unique=True,
        postgresql_nulls_not_distinct=True,
    ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)

    cart_id: Mapped[int] = mapped_column(
        ForeignKey("carts.id"),
        nullable=False,
    )

    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False,
    )
    variant_id:Mapped[int]=mapped_column(
            ForeignKey('product_variants.id'),
            nullable=True
            )
        
    quantity: Mapped[int] = mapped_column(
        default=1,
        nullable=False,
    )

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )

    cart: Mapped["Cart"] = relationship(
        back_populates="cart_items"
    )

    product: Mapped["Product"] = relationship(
        back_populates="cart_items"
    )

    variant = relationship("ProductVariant")
    
    