from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
from app.schemas.products import ProductImageResponse, ProductVariantResponse

class CartItemCreate(BaseModel):
    product_id: int
    variant_id: int | None = None
    quantity: int

class CartItemUpdate(BaseModel):
    quantity: int = Field(ge=1)

class CartItemsRequest(BaseModel):
    products: list[CartItemCreate]

class CartItemProductResponse(BaseModel):
    id: int
    name: str
    price: Decimal
    color: str | None = None
    size: str | None = None
    images: list[ProductImageResponse] | None = None
    variants: list[ProductVariantResponse] | None = None

    model_config = ConfigDict(from_attributes=True)


class CartItemVariantResponse(BaseModel):
    id: int
    color: str
    size: str

    model_config = ConfigDict(from_attributes=True)

class CartItemResponse(BaseModel):
    id: int
    product_id: int
    variant_id: int | None = None
    quantity: int
    unit_price: Decimal
    product: CartItemProductResponse | None = None
    variant: CartItemVariantResponse | None = None

    model_config = ConfigDict(from_attributes=True)

class CartResponse(BaseModel):
    id: int
    user_id: int
    items: list[CartItemResponse]
    total_items: int
    subtotal: Decimal

    model_config = ConfigDict(from_attributes=True)