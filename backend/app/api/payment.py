from fastapi import Request,APIRouter,HTTPException,Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.core.config import settings
from app.core import exceptions
from app.services import payments,user
from app.models import User

router = APIRouter(tags=['Payments'])

from fastapi.responses import RedirectResponse


@router.get("/payment/success")
def payment_success(tracker:str):
    payment = payments.get_payment_by_tracker(tracker)
    print(payment)
    order_id = payment["data"]["metadata"]["order_id"]
    return RedirectResponse(url=f"http://localhost:5173/payment/success?order_id={order_id}")


@router.get("/payment/cancel")
def payment_cancel():
    return RedirectResponse(url="http://localhost:5173/checkout?payment_status=cancelled")




@router.post("/webhooks/safepay")
async def safepay_webhook(request: Request,db: Session = Depends(get_db)):
     #Raw body exactly as Safepay sent it
    raw_body = await request.body()
            # Signature sent by Safepay
    signature = request.headers.get("X-SFPY-SIGNATURE")
    return payments.process_webhook(raw_body,signature,db)

@router.get("/payment/status/{order_id}")
def payment_status(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(user.get_current_user)

):
    try:
        return payments.get_payment_status(order_id, db,current_user)
    
    except exceptions.OrderNotFoundError:
        raise HTTPException(status_code=404, detail="Order not found")

    except exceptions.OrderAccessDenied:
        raise HTTPException(status_code=403, detail="Access denied")