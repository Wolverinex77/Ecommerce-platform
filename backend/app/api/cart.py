from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.models import User
from app.schemas import checkout as Checkout
from app.schemas.cart import CartResponse, CartItemsRequest, CartItemUpdate, CartItemResponse
from app.services import user as user_service, cart as cart_service, checkout as checkout_service
from app.core import exceptions
from app.db.database import get_db

router = APIRouter(prefix='/cart', tags=['Cart'])


@router.get('/', response_model=CartResponse)
def get_cart(
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    return cart_service.get_cart(db, user)


@router.post('/items', status_code=status.HTTP_201_CREATED)
def add_to_cart(
    payload: CartItemsRequest,
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return cart_service.add_to_cart(db, payload, user)
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.StockExceededError:
        raise HTTPException(status_code=409, detail="Product out of stock")
    except exceptions.VariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")
    except exceptions.InvalidVariantError:
        raise HTTPException(status_code=409, detail="Variant does not belong to product")


@router.patch('/items/{item_id}', response_model=CartItemResponse)
@router.put('/items/{item_id}', response_model=CartItemResponse)
def update_cart_item(
    item_id: int,
    payload: CartItemUpdate,
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return cart_service.update_cart_item(db, item_id, payload.quantity, user)
    except exceptions.CartItemNotFoundError:
        raise HTTPException(status_code=404, detail="Cart item not found")
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.StockExceededError:
        raise HTTPException(status_code=409, detail="Product out of stock")
    except exceptions.InvalidCheckoutRequestError:
        raise HTTPException(status_code=400, detail="Quantity must be at least 1")


@router.delete('', status_code=status.HTTP_204_NO_CONTENT)
@router.delete('/', status_code=status.HTTP_204_NO_CONTENT)
def clear_cart(
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    cart_service.clear_cart(db, user)


@router.delete('/items', status_code=status.HTTP_204_NO_CONTENT)
def clear_cart_items(
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    cart_service.clear_cart(db, user)


@router.delete('/items/{item_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_cart_item(
    item_id: int,
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        cart_service.delete_cart_item(db, item_id, user)
    except exceptions.CartItemNotFoundError:
        raise HTTPException(status_code=404, detail="Cart item not found")


@router.get('/checkout', response_model=Checkout.CheckoutResponse)
def view_checkout(
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return checkout_service.view_checkout(db, user)
    except exceptions.CartIsEmptyError:
        raise HTTPException(status_code=409, detail="Cart is empty")
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.StockExceededError:
        raise HTTPException(status_code=409, detail="Out of stock")
    except exceptions.VariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")
    except exceptions.InvalidVariantError:
        raise HTTPException(status_code=409, detail="Variant does not belong to product")


@router.post('/checkout', status_code=status.HTTP_201_CREATED)
def checkout(
    payload: Checkout.CheckoutRequest,
    user: User = Depends(user_service.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        return checkout_service.checkout_create(payload, db, user)
    except exceptions.CartIsEmptyError:
        raise HTTPException(status_code=409, detail="Cart is empty")
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.StockExceededError:
        raise HTTPException(status_code=409, detail="Out of stock")
    except exceptions.VariantNotFoundError:
        raise HTTPException(status_code=404, detail="Variant not found")
    except exceptions.InvalidVariantError:
        raise HTTPException(status_code=409, detail="Variant does not belong to product")
    except exceptions.ShippingAddressNotFoundError:
        raise HTTPException(status_code=404, detail="Address not found")
    except exceptions.InvalidCheckoutRequestError:
        raise HTTPException(status_code=400, detail="Invalid checkout request")
