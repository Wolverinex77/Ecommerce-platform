from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status,Form
from sqlalchemy.orm import Session
from app.services.user import require_admin
from app.services import products
from app.models import User
from app.db.database import get_db
from app.schemas.products import (
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    ProductBulkCreate,
    ProductVariantResponse,
    ProductDetailResponse
)
from app.core import exceptions

router = APIRouter(prefix='/products', tags=["Products"])


@router.get('', response_model=list[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    category_id: int | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    in_stock: bool   | None = None,
    size:str         | None = None
):
    try:
        return products.get_products(db, category_id, min_price, max_price, in_stock, size)
        
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Category not found")


@router.post('', status_code=status.HTTP_201_CREATED)
def create_products(
    product: ProductCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        return products.create_product(product, admin, db)
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Category id not found")


@router.get("/{id}", response_model=ProductDetailResponse)
def get_a_product(id: int, db: Session = Depends(get_db)):
    try:
        return products.get_product(id, db)
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")


@router.get("/{id}/variants", response_model=list[ProductVariantResponse])
def get_product_variants(id: int, db: Session = Depends(get_db)):
    try:
        return products.get_product_variants(id, db)
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")


@router.put("/{id}", response_model=ProductResponse)
def update_products(
    id: int,
    product_update: ProductUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        response = products.update_products(product_update, id, db, admin)
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    return response


@router.delete("/{id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_products(
    id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        products.delete_products(id, admin, db)
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
def create_products_bulk(
    payload: ProductBulkCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        return products.create_product_bulk(db, payload, admin)
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Category not found")


@router.post("/{product_id}/images", status_code=status.HTTP_201_CREATED)
async def upload_product_image(
    product_id: int,
    variant_id:int | None = Form(None),
    images: list[UploadFile] = File(...),
    is_primary: bool = Form(False),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        return await products.upload_product_images(
            product_id=product_id,
            images=images,
            db=db,
            is_primary=is_primary,
            variant_id=variant_id
        )
    except exceptions.ProductNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.VariantNotFoundError:
        raise HTTPException(status_code=404, detail="Product not found")
    except exceptions.InvalidVariantError:
        raise HTTPException(status_code=409, detail="Product not found")


@router.delete("/{product_id}/images/{image_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product_image(
    image_id: int,
    product_id: int | None = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    try:
        products.delete_product_image(
            image_id=image_id,
            db=db,
            product_id=product_id
        )
    except exceptions.ProductImageNotFoundError:
        raise HTTPException(status_code=404, detail="Product image not found")

