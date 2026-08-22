
from pydantic import BaseModel
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
    id:int
    unit_price: Decimal
    quantity: int
    product:ProductSummary



class OrderResponse(BaseModel):
    id: int
    status: OrderStatus
    

class OrderDetailResponse(OrderResponse):
    order_items: list[OrderItemResponse]

class OrderUpdate(BaseModel):
    order_status:OrderStatus
    
class PaymentCreate(BaseModel):
    payment_method:PaymentMethod
    

class OrderShippingCreate(BaseModel):
    checkout_id: int
    

