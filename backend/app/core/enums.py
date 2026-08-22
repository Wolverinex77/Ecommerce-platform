from enum import Enum


class OrderStatus(str, Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"
        
class PaymentStatus(str,Enum):
    PENDING = "pending"
    PAID = "paid"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"
    
class PaymentMethod(str, Enum):
    COD = "COD"
    STRIPE = "STRIPE"

class Province(str, Enum):
    PUNJAB = "Punjab"
    SINDH = "Sindh"
    KPK = "KPK"
    BALOCHISTAN = "Balochistan"
    GILGIT_BALTISTAN = "Gilgit Baltistan"
    AJK = "AJK"
    ISLAMABAD = "Islamabad"
    
class ShippingMethod(str, Enum):
    STANDARD = "standard"
    EXPRESS = "express"

class InventoryType(str, Enum):
    Simple = "Simple"
    Varient = "Varient"