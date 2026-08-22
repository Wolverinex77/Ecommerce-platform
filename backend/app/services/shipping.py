from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.schemas import shipping
from app.core.enums import Province,ShippingMethod

def create_shipping_address(
    payload: shipping.ShippingAddressCreate,
    user: models.User,
    db: Session,
):
    address = models.ShippingAddress(
        user_id=user.id,
        **payload.model_dump()
    
    )

    db.add(address)
    db.commit()
    db.refresh(address)
    if user.default_shipping_address_id is None:
        user.default_shipping_address_id = address.id
        
    return address


def get_shipping_addresses(
    user: models.User,
    db: Session,
):
    stmt = (
        select(models.ShippingAddress)
        .where(models.ShippingAddress.user_id == user.id)
    )

    addresses = db.scalars(stmt).all()

    return addresses


from app.core import exceptions

def get_shipping_address(
    address_id: int,
    user: models.User,
    db: Session,
):
    stmt = (
        select(models.ShippingAddress)
        .where(
            models.ShippingAddress.id == address_id,
            models.ShippingAddress.user_id == user.id,
        )
    )

    address = db.scalar(stmt)
    if address is None:
        raise exceptions.ShippingAddressNotFoundError()

    return address


def update_shipping_address(
    address_id: int,
    payload: shipping.ShippingAddressUpdate,
    user: models.User,
    db: Session,
):
    stmt = (
        select(models.ShippingAddress)
        .where(
            models.ShippingAddress.id == address_id,
            models.ShippingAddress.user_id == user.id,
        )
    )

    address = db.scalar(stmt)
    if address is None:
        raise exceptions.ShippingAddressNotFoundError()

    for key, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(address, key, value)

    db.commit()
    db.refresh(address)

    return address


def delete_shipping_address(
    address_id: int,
    user: models.User,
    db: Session,
):
    stmt = (
        select(models.ShippingAddress)
        .where(
            models.ShippingAddress.id == address_id,
            models.ShippingAddress.user_id == user.id,
        )
    )

    address = db.scalar(stmt)
    if address is None:
        raise exceptions.ShippingAddressNotFoundError()

    db.delete(address)
    db.commit()
    
def calculate_shipping(
    province:Province,
    method:ShippingMethod,
) -> int:
    print(province)
    print(method)
    print(method)
    print(type(method))
    print(ShippingMethod)
    print(type(method) is ShippingMethod)
    print(method == ShippingMethod.STANDARD)
    if method == ShippingMethod.STANDARD:

        if province == Province.PUNJAB:
            return 250

        elif province == Province.SINDH:
            return 350

        elif province == Province.KPK:
            return 400

        elif province == Province.BALOCHISTAN:
            return 500

        elif province == Province.GILGIT_BALTISTAN:
            return 600

        elif province == Province.AJK:
            return 450

        elif province == Province.ISLAMABAD:
            return 250

    elif method == ShippingMethod.EXPRESS:

        if province == Province.PUNJAB:
            return 450

        elif province == Province.SINDH:
            return 550

        elif province == Province.KPK:
            return 600

        elif province == Province.BALOCHISTAN:
            return 700

        elif province == Province.GILGIT_BALTISTAN:
            return 800

        elif province == Province.AJK:
            return 650

        elif province == Province.ISLAMABAD:
            return 450

    raise ValueError("Invalid shipping option")