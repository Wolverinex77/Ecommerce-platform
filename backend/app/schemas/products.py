from decimal import Decimal
from datetime import datetime

from pydantic import BaseModel, Field, ConfigDict, model_validator
from .categories import CategorySummary
from app.core.enums import InventoryType


class ProductVariantCreate(BaseModel):
    size: str | None = None
    color: str | None = None
    quantity: int = Field(ge=0)


class ProductVariantUpdate(BaseModel):
    color: str | None = Field(default=None, max_length=50)
    size: str | None = Field(default=None, max_length=20)
    quantity: int | None = Field(default=None, ge=0)


class ProductVariantResponse(BaseModel):
    id: int
    product_id: int
    color: str
    size: str                       
    quantity: int | None = None
    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name:str=Field(max_length=50)
    inventory_type:InventoryType
    description:str
    price:Decimal
    stock_quantity:int | None = None
    category_id:int
    is_featured:bool | None = None
    color:str | None = Field(default=None, max_length=50)
    size:str | None = Field(default=None, max_length=20)
    variants:list[ProductVariantCreate]| None = None
    
@model_validator(mode='after')
def validate_inventory(self):
    if self.inventory_type == InventoryType.Simple:
        if self.stock_quantity is None:
            raise ValueError("stock_quantity is required for simple products")

        if self.variants:
            raise ValueError(
                "variants are not allowed for simple products"
            )

    elif self.inventory_type == InventoryType.Varient:
            variant=self.variants
            if not variant:
                raise ValueError("variants are required for variant products")
            
            if self.stock_quantity is not None:
                            raise ValueError(
                                "stock_quantity is not allowed for variant products")

       
    return self
    
class ProductImageResponse(BaseModel):
    id: int
    image_url: str
    is_primary: bool
    variant_id: int | None = None
    variant: ProductVariantResponse | None = None

    model_config = ConfigDict(from_attributes=True)  


    

class ProductBulkCreate(BaseModel):
    products: list[ProductCreate]

class ProductResponse(BaseModel):
    id: int
    name: str
    price: Decimal
    color: str | None = None
    size: str | None = None
    primary_image: str | None = None

class ProductDetailResponse(BaseModel):
    id: int
    name: str   
    description: str
    price: Decimal
    stock_quantity:int | None = None
    category_id: int
    color: str | None = None
    size: str | None = None
    inventory_type: str | None = None
    is_featured: bool | None = None
    created_at: datetime | None = None
    images: list[ProductImageResponse]
    model_config = ConfigDict(from_attributes=True)

class ProductUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=50)
    description: str | None = None
    price: Decimal | None = None
    stock_quantity: int | None = None
    category_id: int | None = None
    color: str | None = Field(default=None, max_length=50)
    size: str | None = Field(default=None, max_length=20)

class ProductSummary(BaseModel):
    id: int
    name: str