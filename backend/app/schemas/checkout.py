from decimal import Decimal
from pydantic import BaseModel, ConfigDict
from app.schemas.cart import CartItemResponse
from app.schemas.shipping import ShippingAddressCreate, ShippingAddressResponse
from app.core.enums import PaymentMethod, ShippingMethod

class CheckoutResponse(BaseModel):
    cart_items: list[CartItemResponse]
    shipping_addresses: list[ShippingAddressResponse]
    default_shipping_address_id: int | None = None
    subtotal: Decimal
    shipping_fee: Decimal = Decimal("0.00")
    discount: Decimal = Decimal("0.00")
    total_amount: Decimal
    payment_methods: list[PaymentMethod] = [PaymentMethod.COD, PaymentMethod.STRIPE]
    shipping_methods: list[ShippingMethod] = [ShippingMethod.STANDARD, ShippingMethod.EXPRESS]

    model_config = ConfigDict(from_attributes=True)

class CheckoutRequest(BaseModel):
    shipping_address_id: int | None = None
    shipping_address_create: ShippingAddressCreate | None = None
    payment_method: PaymentMethod
    shipping_method: ShippingMethod

class BuyNowCheckoutRequest(BaseModel):
    product_id: int
    variant_id: int | None = None
    quantity: int = 1
    shipping_address_id: int | None = None
    shipping_address_create: ShippingAddressCreate | None = None
    payment_method: PaymentMethod
    shipping_method: ShippingMethod
