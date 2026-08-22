from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.schemas.cart import CartItemsRequest
from app.models import CartItem, Cart, User, Product, ProductVariant
from app.core import exceptions, enums


def get_cart(db: Session, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()

    if cart_db is None:
        return {
            "id": 0,
            "user_id": user.id,
            "items": [],
            "total_items": 0,
            "subtotal": Decimal("0.00"),
        }

    items = cart_db.cart_items
    total_items = sum(item.quantity for item in items)
    subtotal = sum(item.quantity * item.unit_price for item in items) if items else Decimal("0.00")

    return {
        "id": cart_db.id,
        "user_id": user.id,
        "items": items,
        "total_items": total_items,
        "subtotal": subtotal,
    }


def add_to_cart(db: Session, payload: CartItemsRequest, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()
    if cart_db is None:
        cart_db = Cart(user_id=user.id)
        db.add(cart_db)
        db.flush()

    for item in payload.products:
        variant_db = None
        product_db = db.get(Product, item.product_id)
        if product_db is None:
            raise exceptions.ProductNotFoundError()

        if product_db.inventory_type == enums.InventoryType.Simple:
            if product_db.stock_quantity is not None and product_db.stock_quantity < item.quantity:
                raise exceptions.StockExceededError()

        elif product_db.inventory_type == enums.InventoryType.Varient:
            if item.variant_id is None:
                raise exceptions.InvalidVariantError()
            variant_db = db.get(ProductVariant, item.variant_id)

            if variant_db is None:
                raise exceptions.VariantNotFoundError()

            if variant_db.product_id != product_db.id:
                raise exceptions.InvalidVariantError()

            if variant_db.quantity is not None and variant_db.quantity < item.quantity:
                raise exceptions.StockExceededError()

        existing_item = db.scalars(
            select(CartItem).where(
                CartItem.cart_id == cart_db.id,
                CartItem.product_id == product_db.id,
                CartItem.variant_id == (variant_db.id if variant_db else None)
            )
        ).one_or_none()

        if existing_item:
            existing_item.quantity += item.quantity
        else:
            cart_item_db = CartItem(
                cart_id=cart_db.id,
                product_id=product_db.id,
                variant_id=variant_db.id if variant_db else None,
                quantity=item.quantity,
                unit_price=product_db.price,
            )
            db.add(cart_item_db)

    db.commit()


def delete_cart_item(db: Session, item_id: int, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()

    if cart_db is None:
        raise exceptions.CartItemNotFoundError()

    cart_item = db.scalars(
        select(CartItem).where(
            CartItem.id == item_id,
            CartItem.cart_id == cart_db.id
        )
    ).one_or_none()

    if cart_item is None:
        raise exceptions.CartItemNotFoundError()

    db.delete(cart_item)
    db.commit()


def clear_cart(db: Session, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()

    if cart_db is not None and cart_db.cart_items:
        for item in cart_db.cart_items:
            db.delete(item)
        db.commit()


def update_cart_item(db: Session, item_id: int, quantity: int, user: User):
    cart_db = db.scalars(
        select(Cart).where(Cart.user_id == user.id)
    ).one_or_none()

    if cart_db is None:
        raise exceptions.CartItemNotFoundError()

    cart_item = db.scalars(
        select(CartItem).where(
            CartItem.id == item_id,
            CartItem.cart_id == cart_db.id
        )
    ).one_or_none()

    if cart_item is None:
        raise exceptions.CartItemNotFoundError()

    product_db = db.get(Product, cart_item.product_id)
    if product_db is None:
        raise exceptions.ProductNotFoundError()

    if quantity < 1:
        raise exceptions.InvalidCheckoutRequestError()

    if product_db.inventory_type == enums.InventoryType.Simple:
        if product_db.stock_quantity is not None and product_db.stock_quantity < quantity:
            raise exceptions.StockExceededError()
    elif product_db.inventory_type == enums.InventoryType.Varient:
        if cart_item.variant_id:
            variant_db = db.get(ProductVariant, cart_item.variant_id)
            if variant_db and variant_db.quantity is not None and variant_db.quantity < quantity:
                raise exceptions.StockExceededError()

    cart_item.quantity = quantity
    db.commit()
    db.refresh(cart_item)
    return cart_item
