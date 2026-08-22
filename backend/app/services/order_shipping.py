from typing import Optional
from sqlalchemy.orm import Session

from app import models
from app.core import exceptions
from app.core.enums import ShippingMethod


def create_order_shipping(
    order_id: int,
    user: models.User,
    db: Session,
    shipping_method: ShippingMethod,
    shipping_address_id: Optional[int] = None,
):
    order = db.get(models.Order, order_id)

    if order is None or order.user_id != user.id:
        raise exceptions.OrderNotFoundError()

    if shipping_address_id is None:
        raise exceptions.ShippingAddressNotFoundError()

    source_addr = db.get(models.ShippingAddress, shipping_address_id)
    if source_addr is None or source_addr.user_id != user.id:
        raise exceptions.ShippingAddressNotFoundError()

    addr = models.OrderShippingAddress(
        order_id=order.id,
        full_name=source_addr.full_name,
        phone_number=source_addr.phone_number,
        country=source_addr.country,
        state=source_addr.state,
        city=source_addr.city,
        postal_code=source_addr.postal_code,
        address_line_1=source_addr.address_line_1,
        address_line_2=source_addr.address_line_2,
        shipping_method=shipping_method,
    )

    db.add(addr)
    db.commit()
    db.refresh(addr)

    return addr
