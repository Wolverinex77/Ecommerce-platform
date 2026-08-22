
from sqlalchemy.orm import Mapped,mapped_column,relationship
from sqlalchemy import Integer,String,TIMESTAMP,text,func,ForeignKey,Numeric,Text,Boolean,Enum as SQLEnum
from datetime import datetime
from app.db.database import Base
from decimal import Decimal
from typing import TYPE_CHECKING
from app.core.enums import InventoryType

if TYPE_CHECKING:
    from .cart import CartItem
class Product(Base):
    __tablename__='products'
    id:Mapped[int]=mapped_column(Integer,primary_key=True,index=True)
    name:Mapped[str]=mapped_column(String,unique=True,index=True)
    description:Mapped[str]=mapped_column(Text)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    stock_quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    color: Mapped[str | None] = mapped_column(String, nullable=True)
    size: Mapped[str | None] = mapped_column(String, nullable=True)
    is_featured: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        server_default=text('false'),
        nullable=False,
    )
    inventory_type: Mapped[InventoryType] = mapped_column(
        SQLEnum(InventoryType),
        default=InventoryType.Simple,
        server_default=InventoryType.Simple.value,
        nullable=False,
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("categories.id", ondelete="CASCADE")
    )
    category=relationship("Category",back_populates="products") #M-1
    created_at: Mapped[TIMESTAMP] = mapped_column(
        TIMESTAMP(timezone=True),
        nullable=False,
        server_default=text('NOW()')
    )
    updated_at: Mapped[datetime] = mapped_column(
    TIMESTAMP(timezone=True),
    server_default=func.now(),
    onupdate=func.now(),
    nullable=False,
)
    cart_items: Mapped["CartItem"] = relationship(
            back_populates="product"
        )
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    # order_items=Relationship("OrderItem",back_populates="product") #1-M


class ProductVariant(Base):
    __tablename__ = 'product_variants'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    color: Mapped[str] = mapped_column(String, nullable=False)
    size: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)

    product: Mapped[Product] = relationship(back_populates="variants")


class ProductImage(Base):
    __tablename__ = 'product_images'

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id", ondelete="CASCADE"),
        nullable=False,
    )
    variant_id: Mapped[int] = mapped_column(
            ForeignKey("product_variants.id", ondelete="CASCADE"),
            nullable=True,
        )      
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    product: Mapped["Product"] = relationship(back_populates="images")
    # variant: Mapped["ProductVariant | None"] = relationship()



    