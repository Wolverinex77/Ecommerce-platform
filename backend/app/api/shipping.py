from fastapi import APIRouter, Depends, status, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import User
from app.schemas.shipping import (
    ShippingAddressCreate,
    ShippingAddressUpdate,
    ShippingAddressResponse,
)
from app.services import shipping, user
from app.core import exceptions

router = APIRouter(prefix="/shipping", tags=["Shipping"])


@router.get("", response_model=list[ShippingAddressResponse])
def list_shipping_addresses(
    current_user: User = Depends(user.get_current_user),
    db: Session = Depends(get_db),
):
    return shipping.get_shipping_addresses(current_user, db)


@router.post(
    "",
    response_model=ShippingAddressResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_shipping_address(
    payload: ShippingAddressCreate,
    current_user: User = Depends(user.get_current_user),
    db: Session = Depends(get_db),
):
    return shipping.create_shipping_address(payload, current_user, db)


@router.get("/{id}", response_model=ShippingAddressResponse)
def get_shipping_address(
    id: int,
    current_user: User = Depends(user.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return shipping.get_shipping_address(id, current_user, db)
    except exceptions.ShippingAddressNotFoundError:
        raise HTTPException(status_code=404, detail="Shipping address not found")


@router.put("/{id}", response_model=ShippingAddressResponse)
def update_shipping_address(
    id: int,
    payload: ShippingAddressUpdate,
    current_user: User = Depends(user.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        return shipping.update_shipping_address(
            id,
            payload,
            current_user,
            db,
        )
    except exceptions.ShippingAddressNotFoundError:
        raise HTTPException(status_code=404, detail="Shipping address not found")


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shipping_address(
    id: int,
    current_user: User = Depends(user.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        shipping.delete_shipping_address(id, current_user, db)
    except exceptions.ShippingAddressNotFoundError:
        raise HTTPException(status_code=404, detail="Shipping address not found")