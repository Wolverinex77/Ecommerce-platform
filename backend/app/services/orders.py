
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from fastapi import HTTPException
from app.schemas.orders import OrderCreate, OrderUpdate
from app.models import User
from app.models import Order,OrderItem,CartItem,Cart,Checkout,Payment
from app.models.products import Product, ProductVariant
from app.core.exceptions import ProductNotFoundError,StockExceededError,OrderNotFoundError,InvalidStateTransition,CategoryNotFoundError
from app.core import exceptions
from app.core.enums import OrderStatus, PaymentMethod, PaymentStatus,InventoryType
from sqlalchemy import select
from uuid import uuid4

def create_order(payload:OrderCreate,user:User,db:Session):
    
    db_checkout = db.scalars(
        select(Checkout).where(Checkout.user_id == user.id, Checkout.id == payload.checkout_id)
    ).one_or_none()

    if db_checkout is None:
        raise exceptions.CheckoutNotFoundError()

    existing_products={}
    existing_variants={}
    db_cart=user.cart
    db_cart_items=db_cart.cart_items
    for item in db_cart_items:
        product=db.get(Product,item.product_id)
        if not product:
            raise ProductNotFoundError()
        if product.inventory_type == InventoryType.Simple:
            if product.stock_quantity is not None and item.quantity > product.stock_quantity:
                raise StockExceededError()
        elif product.inventory_type == InventoryType.Varient and item.variant_id:
            variant = db.get(ProductVariant, item.variant_id)
            if variant:
                if variant.quantity is not None and item.quantity > variant.quantity:
                    raise StockExceededError()
                existing_variants[item.variant_id] = variant
        existing_products[item.product_id]=product
  
    order = Order(user_id=user.id)
    order_number = f"ORD-{uuid4().hex[:8].upper()}"
    order.subtotal = db_checkout.subtotal
    order.shipping_cost = db_checkout.shipping_cost
    order.tax = db_checkout.tax
    order.discount = db_checkout.discount
    order.total_amount = db_checkout.total_amount
    order.order_number = order_number
    db.add(order)
    db.flush()  # order Created and order.id assigned
    
    for item in db_cart.cart_items:
        product=existing_products[item.product_id]
        order_item_db=OrderItem(
            order_id=order.id,
            product_id=product.id,
            variant_id=item.variant_id,
            quantity=item.quantity,
            unit_price=item.unit_price
        )
        db.add(order_item_db)
    if db_checkout.payment_method == PaymentMethod.COD:
        for item in db_cart_items:
            product = existing_products[item.product_id]  
            if product.inventory_type == InventoryType.Simple and product.stock_quantity is not None:
                product.stock_quantity -= item.quantity #Reduce stock
            elif product.inventory_type == InventoryType.Varient and item.variant_id in existing_variants:
                variant=existing_variants[item.variant_id]
                if variant.quantity is not None:
                    variant.quantity -= item.quantity
 
    payment=Payment(order_id=order.id,payment_method=db_checkout.payment_method)
    db.add(payment)
    
    db.commit()
    
    return order

def get_orders(user:User,db:Session):
    user_orders=user.orders
    if not user_orders:
        raise OrderNotFoundError()
    return user_orders

def get_orders_id(id:int,user:User,db:Session):
    order=db.get(Order,id)
    if order is None:
        raise OrderNotFoundError()
    return order

#Order Status Change
def update_order_status(payload:OrderUpdate,id:int,admin:User,db:Session):
    order=db.get(Order,id)
    if not order:
        raise exceptions.OrderNotFoundError()

    order_items_db=order.order_items
    
    db_payment=db.scalars(
            select(Payment).where(Payment.order_id == order.id)
            ).one()
    
    allowed_order_transitions = {
    OrderStatus.PENDING: {
        OrderStatus.CONFIRMED, 
        OrderStatus.CANCELLED,
    },
    OrderStatus.CONFIRMED: {
        OrderStatus.SHIPPED,
        OrderStatus.CANCELLED,
    },
    OrderStatus.SHIPPED: {
        OrderStatus.DELIVERED,
    },
    OrderStatus.DELIVERED: set(),
    OrderStatus.CANCELLED: set(),
}
    
    current_order_status=order.order_status
    new_order_status=payload.order_status
    if new_order_status not in allowed_order_transitions[current_order_status]:
            raise InvalidStateTransition()
    order.status=new_order_status #type:ignore
    if db_payment.payment_method == PaymentMethod.COD:
        if order.order_status == OrderStatus.CANCELLED:
        #Restock
            for item in order_items_db:
                product=item.product
                product.stock_quantity += item.quantity
        elif order.order_status == OrderStatus.DELIVERED:
            db_payment.payment_status = PaymentStatus.PAID
        #Payment states managed by Webhook
    if db_payment.payment_method == PaymentMethod.STRIPE:
        if db_payment.payment_status == PaymentStatus.PAID:
            order.order_status=OrderStatus.CONFIRMED
        elif db_payment.payment_status == PaymentStatus.CANCELLED:
            order.order_status=OrderStatus.CANCELLED
        elif db_payment.payment_status == PaymentStatus.REFUNDED:
            #user cancels order or returns after delivery
            ...
    db.commit()
    return order    

def cancel_order(order_id, user, db):
    order = db.scalars(
        select(Order).where(Order.id == order_id, Order.user_id == user.id)
    ).one_or_none()

    if order is None:
        raise exceptions.OrderNotFoundError()

    if datetime.now(timezone.utc) > order.created_at + timedelta(hours=1):
        raise HTTPException(
            status_code=400,
            detail="Cancellation window has expired."
        )

    if order.order_status not in (OrderStatus.PENDING,OrderStatus.CONFIRMED):
        raise HTTPException(
        status_code=400,
        detail="This order cannot be cancelled.",
    )
    order.order_status = OrderStatus.CANCELLED
    db.commit()
    db.refresh(order)
    db.commit()
    refund = refund_payment(
    tracker="track_1a46dc70-91f9-4892-8e25-0bb5205b69c7",
    amount=1000,
    )
    return order

        
    
    
def get_all_orders(admin:User,db:Session): #Admin Access
    stmt=select(Order)
    result=db.execute(stmt)
    orders=result.scalars().all()
    return orders



import requests
from app.core.config import settings


def refund_payment(tracker: str, amount: int, currency: str = "PKR"):
    url = f"https://sandbox.api.getsafepay.com/order/payments/v3/{tracker}/refund"

    headers = {
        "X-SFPY-MERCHANT-SECRET": settings.safepay_api_key,
    }

    payload = {
        "currency": currency,
        "amount": amount,
    }

    response = requests.post(
        url,
        headers=headers,
        json=payload,
    )

    response.raise_for_status()
    return response.json()
    