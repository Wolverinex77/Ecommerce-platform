from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.schemas.checkout import CheckoutRequest, CheckoutResponse
from app.models import CartItem, Cart, User, ShippingAddress, Checkout, Product, ProductVariant
from app.core.enums import InventoryType, ShippingMethod, PaymentMethod
from app.core import exceptions
from app.services import shipping


def view_checkout(db: Session, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()

    if cart_db is None or not cart_db.cart_items:
        raise exceptions.CartIsEmptyError()

    cart_items = cart_db.cart_items

    subtotal = Decimal("0.00")
    for item in cart_items:
        product = db.get(Product, item.product_id)
        if product is None:
            raise exceptions.ProductNotFoundError()
        if product.inventory_type == InventoryType.Simple:
            if product.stock_quantity is not None and item.quantity > product.stock_quantity:
                raise exceptions.StockExceededError()
        elif product.inventory_type == InventoryType.Varient:
            if item.variant_id is None:
                raise exceptions.InvalidVariantError()
            variant = db.get(ProductVariant, item.variant_id)
            if variant is None:
                raise exceptions.VariantNotFoundError()
            if variant.product_id != product.id:
                raise exceptions.InvalidVariantError()
            if variant.quantity is not None and item.quantity > variant.quantity:
                raise exceptions.StockExceededError()
        subtotal += item.quantity * item.unit_price

    shipping_addresses = db.scalars(
        select(ShippingAddress).where(ShippingAddress.user_id == user.id)
    ).all()

    shipping_fee = Decimal("0.00")
    default_address = None
    if user.default_shipping_address_id:
        default_address = db.get(ShippingAddress, user.default_shipping_address_id)
    elif shipping_addresses:
        default_address = shipping_addresses[0]

    if default_address and default_address.state:
        try:
            shipping_fee = Decimal(str(shipping.calculate_shipping(default_address.state, ShippingMethod.STANDARD)))
        except Exception:
            shipping_fee = Decimal("250.00")

    discount = Decimal("0.00")
    total_amount = subtotal + shipping_fee - discount

    return {
        "cart_items": cart_items,
        "shipping_addresses": shipping_addresses,
        "default_shipping_address_id": user.default_shipping_address_id or (default_address.id if default_address else None),
        "subtotal": subtotal,
        "shipping_fee": shipping_fee,
        "discount": discount,
        "total_amount": total_amount,
        "payment_methods": [PaymentMethod.COD, PaymentMethod.STRIPE],
        "shipping_methods": [ShippingMethod.STANDARD, ShippingMethod.EXPRESS],
    }


def checkout_create(payload: CheckoutRequest, db: Session, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()
    if cart_db is None or not cart_db.cart_items:
        raise exceptions.CartIsEmptyError()

    cart_items = db.scalars(
        select(CartItem).where(CartItem.cart_id == cart_db.id)
    ).all()

    subtotal = Decimal("0.00")
    for item in cart_items:
        product = db.get(Product, item.product_id)
        if product is None:
            raise exceptions.ProductNotFoundError()
        if product.inventory_type == InventoryType.Simple:
            if product.stock_quantity is not None and item.quantity > product.stock_quantity:
                raise exceptions.StockExceededError()
        elif product.inventory_type == InventoryType.Varient:
            if item.variant_id is None:
                raise exceptions.InvalidVariantError()
            variant = db.get(ProductVariant, item.variant_id)
            if variant is None:
                raise exceptions.VariantNotFoundError()
            if variant.product_id != product.id:
                raise exceptions.InvalidVariantError()
            if variant.quantity is not None and item.quantity > variant.quantity:
                raise exceptions.StockExceededError()
        subtotal += item.quantity * item.unit_price

    shipping_address = None

    if payload.shipping_address_id is not None:
        shipping_address = db.scalar(
            select(ShippingAddress).where(
                ShippingAddress.user_id == user.id,
                ShippingAddress.id == payload.shipping_address_id
            )
        )
        if shipping_address is None:
            raise exceptions.ShippingAddressNotFoundError()

    elif payload.shipping_address_create is not None:
        shipping_address = ShippingAddress(
            user_id=user.id,
            **payload.shipping_address_create.model_dump()
        )
        db.add(shipping_address)
        db.flush()
        if user.default_shipping_address_id is None:
            user.default_shipping_address_id = shipping_address.id
    else:
        raise exceptions.InvalidCheckoutRequestError()

    cost_of_shipping = Decimal(str(shipping.calculate_shipping(province=shipping_address.state, method=payload.shipping_method)))
    discount = Decimal("0.00")
    tax = Decimal("0.00")
    total_amount = (
        subtotal
        + cost_of_shipping
        + tax
        - discount
    )

    checkout_db = Checkout(
        user_id=user.id,
        shipping_address_id=shipping_address.id,
        subtotal=subtotal,
        shipping_cost=cost_of_shipping,
        shipping_method=payload.shipping_method,
        total_amount=total_amount,
        payment_method=payload.payment_method
    )
    db.add(checkout_db)
    db.commit()
    db.refresh(checkout_db)
    return checkout_db