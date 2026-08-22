from datetime import datetime
from decimal import Decimal
from sqlalchemy import Integer, ForeignKey, TIMESTAMP, func, Numeric, Enum as SQLEnum,String
from sqlalchemy.orm import mapped_column, Mapped, relationship
from app.db.database import Base
from app.core.enums import OrderStatus, PaymentMethod, PaymentStatus

class Order(Base):
    __tablename__='orders'
    id:Mapped[int]=mapped_column(Integer,primary_key=True)
    user_id:Mapped[int]=mapped_column(ForeignKey("users.id"))
    order_status: Mapped[OrderStatus] = mapped_column(
    SQLEnum(OrderStatus),
    nullable=False,
    default=OrderStatus.PENDING,
)
    order_number: Mapped[str] = mapped_column(String(30),unique=True,nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    shipping_cost: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    tax: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    discount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_amount:Mapped[Decimal]=mapped_column(Numeric(10,2),nullable=False,default=0)
    created_at: Mapped[datetime] = mapped_column(
    TIMESTAMP(timezone=True),
    server_default=func.now(),
    nullable=False,
)
    updated_at: Mapped[datetime] = mapped_column(
    TIMESTAMP(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
    
)
    user = relationship("User", back_populates="orders") # M-1
    order_items = relationship("OrderItem", back_populates="order",cascade="all, delete-orphan")
    payment = relationship("Payment",back_populates="order",uselist=False)
    shipping_address =relationship(
            "OrderShippingAddress",
            back_populates="order",
            cascade="all, delete-orphan"
        )   
    
class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(primary_key=True)

    order_id: Mapped[int] = mapped_column(
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"),
        nullable=False,
        index=True
    )

    quantity: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )
    variant_id: Mapped[int | None] = mapped_column(
        ForeignKey("product_variants.id"),
        nullable=True,
    )
    
    

    unit_price: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
    )
    product = relationship("Product") # M-1
    variant = relationship("ProductVariant") # M-1
    order = relationship("Order", back_populates="order_items") # M-1
