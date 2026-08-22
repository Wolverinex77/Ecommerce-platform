from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy import INTEGER, Boolean, ForeignKey,String,TIMESTAMP,text,func, true
from datetime import datetime
from app.db.database import Base
from .shipping import ShippingAddress
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .cart import Cart
class User(Base):
    __tablename__='users'
    id:Mapped[int]=mapped_column(INTEGER,primary_key=True,nullable=False)
    username:Mapped[str]=mapped_column(String,nullable=False,unique=True)
    email:Mapped[str]=mapped_column(String,nullable=False,unique=True)
    hashed_password:Mapped[str]=mapped_column(String,nullable=False)
    is_admin:Mapped[bool]=mapped_column(Boolean,nullable=False,default=False)
    created_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text('NOW()')
    )
    updated_at: Mapped[datetime] = mapped_column(
    server_default=func.now(),
    onupdate=func.now()
        )
    orders=relationship("Order",back_populates="user") #1-M
    
    
    default_shipping_address_id: Mapped[int | None] = mapped_column(
    ForeignKey("shipping_addresses.id", ondelete="SET NULL"),
    nullable=True
)    

    cart: Mapped["Cart"] = relationship(
        back_populates="user"
    )
    # shipping_addresses: Mapped[list["ShippingAddress"]] = relationship(
    #     back_populates="user",
    #     cascade="all, delete-orphan"
    # )   
    