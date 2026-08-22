from pydantic import BaseModel, ConfigDict
from typing import Optional
from app.core.enums import Province

class ShippingAddressBase(BaseModel):
    full_name: str
    phone_number: str
    country: str
    state: Province
    city: str
    postal_code: Optional[str] = None
    address_line_1: str
    address_line_2: Optional[str] = None


class ShippingAddressCreate(ShippingAddressBase):
    pass


class ShippingAddressUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    country: Optional[str] = None
    state: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None


class ShippingAddressResponse(ShippingAddressBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
    
