from datetime import datetime
from decimal import Decimal
from datetime import datetime
from sqlalchemy import ForeignKey, String, Enum as SQLEnum, Numeric,func,DateTime, null
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app import models
from app.db.database import Base
from app.core.enums import ShippingMethod,PaymentMethod
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .payment import Payment
    from .products import Product


class Checkout(Base):
    __tablename__ = "checkouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        index=True
    )
    shipping_address_id: Mapped[int | None] = mapped_column(
        ForeignKey("shipping_addresses.id"),
        nullable=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    shipping_method:Mapped[ShippingMethod]=mapped_column(SQLEnum(ShippingMethod,name='shipping_method'),nullable=False)
    payment_method:Mapped[PaymentMethod]=mapped_column(SQLEnum(PaymentMethod,name='payment_method'),nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
    )
    # payment: Mapped["Payment"] = relationship(
    #     back_populates="checkout",
    #     uselist=False
    # )
   