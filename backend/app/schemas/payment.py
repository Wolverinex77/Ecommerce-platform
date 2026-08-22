from pydantic import BaseModel
from app.core.enums import PaymentMethod 
class PaymentCreate(BaseModel):
    payment_method:PaymentMethod
    