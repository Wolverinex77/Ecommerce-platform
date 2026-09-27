
from pydantic import BaseModel, ConfigDict, Field
from decimal import Decimal
from datetime import datetime
from app.core.enums import OrderStatus, PaymentMethod,PaymentStatus
from app.schemas.products import ProductSummary
from .shipping import ShippingAddressCreate
from app.core.enums import ShippingMethod
from typing import Optional
# class OrderItemCreate(BaseModel):
#     product_id: int
#     quantity: int=1

class OrderCreate(BaseModel):
    checkout_id: int
    

class OrderItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id:int
    unit_price: Decimal
    quantity: int
    product:ProductSummary



class PaymentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    payment_method: Optional[str] = None
    payment_status: Optional[str] = None

class CustomerSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    username: str
    email: str

class OrderShippingAddressResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: Optional[int] = None
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    shipping_method: Optional[str] = None

class OrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: OrderStatus = Field(validation_alias="order_status")
    order_number: Optional[str] = None
    total_amount: Optional[Decimal] = None
    subtotal: Optional[Decimal] = None
    shipping_cost: Optional[Decimal] = None
    created_at: Optional[datetime] = None
    user_id: Optional[int] = None
    payment: Optional[PaymentResponse] = None
    user: Optional[CustomerSummary] = None
    shipping_address: Optional[OrderShippingAddressResponse] = None
    

class OrderDetailResponse(OrderResponse):
    order_items: list[OrderItemResponse]

class OrderUpdate(BaseModel):
    order_status:OrderStatus
    
class PaymentCreate(BaseModel):
    payment_method:PaymentMethod
    

class OrderShippingCreate(BaseModel):
    checkout_id: int
    
