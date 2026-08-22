from datetime import datetime
from sqlalchemy import (
    ForeignKey,
    String,
    DateTime,
    func,
    Enum as SqlEnum,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.database import Base
from app.core.enums import Province,ShippingMethod
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from .orders import Order

class OrderShippingAddress(Base):
    __tablename__ = "order_shipping_addresses"

    id: Mapped[int] = mapped_column(primary_key=True)

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        unique=True,
        index=True,
        nullable=False
    )

    full_name: Mapped[str] = mapped_column(String(100), nullable=False)
    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)

    country: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[Province] = mapped_column(
        SqlEnum(Province, name="order_state"),
        nullable=False,
    )
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str | None] = mapped_column(String(20))

    address_line_1: Mapped[str] = mapped_column(String(255), nullable=False)
    address_line_2: Mapped[str | None] = mapped_column(String(255))

    shipping_method: Mapped[ShippingMethod] = mapped_column(
        SqlEnum(ShippingMethod, name="order_shipping_method"),
        nullable=False,
    )
    

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )

    order: Mapped["Order"] = relationship(
        back_populates="shipping_address"
    )
