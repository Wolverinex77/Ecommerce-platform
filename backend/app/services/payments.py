from urllib.parse import urlencode
from sqlalchemy.orm import Session,selectinload
from sqlalchemy import select
import requests
from fastapi import HTTPException
from app.core.config import settings
from app.core.exceptions import OrderAccessDenied, OrderNotFoundError,InvalidPaymentMethodError
from app.models import Order,Payment,OrderItem
from app.schemas.payment import PaymentCreate
from app.core.enums import InventoryType, OrderStatus,PaymentMethod,PaymentStatus
from decimal import Decimal
import hashlib
import hmac
from app.core.config import settings
import json

PAYMENT_URL = "https://sandbox.api.getsafepay.com/order/payments/v3/"
AUTH_TOKEN_URL = "https://sandbox.api.getsafepay.com/client/passport/v1/token"
headers = {
    "X-SFPY-MERCHANT-SECRET": settings.safepay_api_key,
    "Content-Type": "application/json",
}



def create_payment(request:PaymentCreate,order_id:int,user,db:Session):
    order=db.get(Order,order_id)
    if not order:
        raise OrderNotFoundError()
    order_payment=order.payment
    if order_payment is None:
        raise OrderNotFoundError()
    if order_payment.payment_method != PaymentMethod.STRIPE:
        raise InvalidPaymentMethodError()
    payload={
  "merchant_api_key": settings.safepay_merchant_key,
  "intent": "CYBERSOURCE",
  "mode": "payment",
  "currency": "PKR",

    #"user": "cus_5a328a2a-b55a-4a08-8f92-758ae4ac7277",
  "amount": int(Decimal(order.total_amount) * 100),
  "entry_mode": "raw",
  "metadata": {
    "source": "shopify",
    "order_id": str(order_id)
  }
}
 
    payment_response = requests.post(PAYMENT_URL, json=payload,headers=headers)
    payment_response.raise_for_status()
    payment_data = payment_response.json()
    tracker_token = payment_data["data"]["tracker"]["token"]

    #Auth token
    auth_response = requests.post(
        AUTH_TOKEN_URL,
        headers={
            "X-SFPY-MERCHANT-SECRET": settings.safepay_api_key
        },
    )

    auth_response.raise_for_status()
    auth_data = auth_response.json()
    tbt = auth_data["data"]

    # -----------------------------
    # Step 3: Build Checkout URL
    # -----------------------------
    params = {
        "environment": "sandbox",
        "tracker": tracker_token,
        "tbt": tbt,
        "source": "hosted",
        # "user_id": "cus_5a328a2a-b55a-4a08-8f92-758ae4ac7277",
        "redirect_url": "http://localhost:8000/payment/success",
        "cancel_url": "http://localhost:8000/payment/cancel",
    }

    checkout_url = (
        "https://sandbox.api.getsafepay.com/embedded/?"
        + urlencode(params)
    )
    #Checkout url
    return {
        "checkout_url": checkout_url
    }


def process_webhook(raw_body,signature,db):
       
        if signature is None:
            raise HTTPException(status_code=400, detail="Missing signature")
    
        expected_signature = hmac.new(
            settings.safepay_webhook_secret.encode(),
            raw_body,
            hashlib.sha512
        ).hexdigest()


        if not hmac.compare_digest(expected_signature, signature):
            raise HTTPException(status_code=401, detail="Invalid signature")
    
        payload = json.loads(raw_body)
        print(json.dumps(payload, indent=4))

        order_id=payload["data"]["metadata"]["order_id"]
        order_db = db.scalars(
    select(Order)
    .options(
        selectinload(Order.order_items).selectinload(OrderItem.product),
        selectinload(Order.order_items).selectinload(OrderItem.variant),
    )
    .where(Order.id == order_id)
).one()
        
        
        payment=order_db.payment
        if payload['type'] == 'payment.succeeded':
            payment.payment_status=PaymentStatus.PAID
            order_db.order_status=OrderStatus.CONFIRMED 
        if payload['type'] == 'payment.failed':
            payment.payment_status=PaymentStatus.FAILED
            order_db.order_status=OrderStatus.CANCELLED
        if payload['type'] == 'payment.refunded':
            payment.payment_status=PaymentStatus.REFUNDED
            order_db.order_status=OrderStatus.CANCELLED
        
        if order_db.order_status==OrderStatus.CONFIRMED:
             for item in order_db.order_items:

                if item.product.inventory_type == InventoryType.Simple:
                    if item.product.stock_quantity is not None:
                        item.product.stock_quantity -= item.quantity

                elif item.product.inventory_type == InventoryType.Varient:
                    if item.variant.quantity is not None:
                        item.variant.quantity -= item.quantity

        db.commit()


        return {"message": "Webhook received"}

def get_payment_status(order_id: int, db: Session,current_user):

    order = db.scalar(
        select(Order)
        .options(selectinload(Order.payment))
        .where(Order.id == order_id)
    )
    if not order:
        raise OrderNotFoundError()
    if order.user_id != current_user.id:
        raise OrderAccessDenied()

    return {
        "payment_status": order.payment.payment_status,
        "order_status": order.order_status
    }
    
def get_payment_by_tracker(tracker: str):
    url = f"https://sandbox.api.getsafepay.com/reporter/api/v1/payments/{tracker}"

    headers = {
        "X-SFPY-MERCHANT-SECRET": settings.safepay_api_key,
    }

    response = requests.get(url, headers=headers)
    response.raise_for_status()

    return response.json()