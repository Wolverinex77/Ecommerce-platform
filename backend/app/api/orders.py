from fastapi import APIRouter,Depends,HTTPException
from sqlalchemy.orm import Session
from app.schemas.orders import (
    OrderCreate,
    OrderResponse,
    OrderDetailResponse,
    OrderUpdate,
    OrderShippingCreate,
)
from app.schemas.payment import PaymentCreate
from app.models import User
from app import models
from app.services.user import get_current_user,require_admin
from app.db.database import get_db
from app.services import orders
from app.services import order_shipping
from app.core import exceptions
from app.services import payments
from sqlalchemy.exc import IntegrityError
router = APIRouter(prefix='/orders',tags=['Orders'])


@router.post("", response_model=OrderResponse)
def create_orders(order:OrderCreate,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    try:
        return orders.create_order(order,user,db)
    except (exceptions.CheckoutNotFoundError, exceptions.CheckOutIsEmptyError):
        db.rollback()
        raise HTTPException(status_code=404, detail="Checkout session not found")
    except exceptions.ProductNotFoundError:
        db.rollback()
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.VariantNotFoundError:
        db.rollback()
        raise HTTPException(status_code=404, detail="Variant not found")
    except exceptions.InvalidVariantError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Variant does not belong to product")
    except exceptions.StockExceededError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Insufficient stock")

            
@router.get('',response_model=list[OrderResponse])
def get_user_orders(user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    try:
        return orders.get_orders(user,db)
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")


@router.get('/{id}',response_model=OrderDetailResponse)
def get_user_orders_id(id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    try:
        return orders.get_orders_id(id,user,db)
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")

@router.patch('/admin/{order_id}',response_model=OrderResponse)
def update_order(order:OrderUpdate,order_id:int,admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    try:
        return orders.update_order_status(order,order_id,admin,db)
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")
    except exceptions.InvalidStateTransition:
        raise HTTPException(
            status_code=400,
            detail="Invalid status transition"
        )
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Database integrity error")

@router.get('/admin/view',response_model=list[OrderDetailResponse])
def view_all_orders(admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    return orders.get_all_orders(admin,db)

@router.put('/admin/{order_id}/payment')
def update_order_status(payment_method:OrderUpdate,order_id:int,admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    try:
        return orders.update_order_status(payment_method,order_id,admin,db)
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")
    except exceptions.InvalidStateTransition:
        raise HTTPException(status_code=400, detail="Invalid status transition")
    
@router.post('/admin/{order_id}/payment') #Online Payment
def create_payment(payment_method:PaymentCreate,order_id:int,user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    try:
        return payments.create_payment(payment_method,order_id,user,db)
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")
    except exceptions.InvalidPaymentMethodError:
        raise HTTPException(status_code=400, detail="Invalid Payment Method")

@router.post("/{order_id}/cancel")
def cancel_order(
    order_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return orders.cancel_order(order_id, user, db)
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")



@router.post("/{order_id}/shipping")
def create_order_shipping(
    order_id: int,
    payload: OrderShippingCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        checkout = db.get(models.Checkout, payload.checkout_id)
        if checkout is None:
            raise exceptions.CheckoutNotFoundError()

        return order_shipping.create_order_shipping(
            order_id,
            user,
            db,
            shipping_method=checkout.shipping_method,
            shipping_address_id=checkout.shipping_address_id,
        )
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")
    except exceptions.ShippingAddressNotFoundError:
        raise HTTPException(status_code=404, detail="Shipping address not found")
    except (exceptions.CheckoutNotFoundError, exceptions.CheckOutIsEmptyError):
        raise HTTPException(status_code=404, detail="Checkout session not found")