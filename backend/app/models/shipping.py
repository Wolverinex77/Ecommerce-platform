from sqlalchemy import ForeignKey, String,Enum as SqlEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.enums import ShippingMethod,Province

from app.db.database import Base
from typing import TYPE_CHECKING


if TYPE_CHECKING:
    from .users import User

class ShippingAddress(Base):
    __tablename__ = "shipping_addresses"

    id: Mapped[int] = mapped_column(primary_key=True)

    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )

    full_name: Mapped[str] = mapped_column(String(100), nullable=False)

    phone_number: Mapped[str] = mapped_column(String(20), nullable=False)

    country: Mapped[str] = mapped_column(String(100), nullable=False)

    state: Mapped[Province] = mapped_column(SqlEnum(Province,name='state'),nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=True)

    address_line_1: Mapped[str] = mapped_column(String(255), nullable=False)

    address_line_2: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True
    )
    
    # user: Mapped["User"] = relationship(back_populates="shipping_addresses")