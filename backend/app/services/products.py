from sqlalchemy import select
from sqlalchemy.orm import Session,selectinload
from app.schemas.products import ProductCreate, ProductUpdate,ProductBulkCreate,ProductResponse,ProductDetailResponse
from app.models import User,Product,Category,ProductVariant
from app.core.exceptions import (
    CategoryNotFoundError,
    InvalidVariantError,
    ProductNotFoundError,
    VariantNotFoundError,
    ProductImageNotFoundError,
)

from app.core.enums import InventoryType

def create_product(payload:ProductCreate,admin:User,db:Session):
    db_category_id=db.get(Category,payload.category_id)
    if not db_category_id:
       raise CategoryNotFoundError()

    product=Product(name=payload.name,
                    inventory_type=payload.inventory_type,
                    description=payload.description,
                    price=payload.price,
                    stock_quantity=payload.stock_quantity,
                    category_id=payload.category_id,
                    color=payload.color,
                    size=payload.size
                     )
    
    db.add(product)
    db.flush()

    if product.inventory_type == InventoryType.Varient:
        for item in payload.variants: 
            variant_db = ProductVariant(
                product_id=product.id,
                color=item.color,
                size=item.size,
                quantity=item.quantity
            )  
            db.add(variant_db)
    db.commit()

    return product

def create_product_bulk(
    db: Session,
    payload: ProductBulkCreate,
    admin: User 
):
    for item in payload.products:
        category = db.get(Category, item.category_id)
        if category is None:
            raise CategoryNotFoundError()

        product = Product(
            name=item.name,
            inventory_type=item.inventory_type,
            description=item.description,
            price=item.price,
            stock_quantity=item.stock_quantity,
            category_id=item.category_id,
            color=item.color,
            size=item.size
        )
        db.add(product)
        db.flush()

        if product.inventory_type == InventoryType.Varient and item.variants:
            for variant_item in item.variants:
                variant_db = ProductVariant(
                    product_id=product.id,
                    color=variant_item.color,
                    size=variant_item.size,
                    quantity=variant_item.quantity
                )
                db.add(variant_db)

    db.commit()

    return {
        "message": f"Successfully created {len(payload.products)} products",
        "count": len(payload.products)
    }



#Displaying product cards
def get_products(db:Session,category_id,min_price,max_price,in_stock,size):
    query=select(Product).options(selectinload(Product.images))
   
    if size is not None:
        query = query.where(Product.size == size)

    if min_price is not None:
        query = query.where(Product.price >= min_price)

    if max_price is not None:
        query = query.where(Product.price <= max_price)

    if in_stock is True:
        query = query.where(Product.stock_quantity > 0)
    
    if category_id is not None:
            category = db.scalar(select(Category)
            .options(selectinload(Category.children))
            .where(Category.id == category_id))
            if category.parent_id is None: #type:ignore
                    child_ids = [child.id for child in category.children] #type:ignore
                    query = query.where(Product.category_id.in_(child_ids))
            else:
                    query = query.where(Product.category_id == category_id)
        
    result=db.execute(query)
    products = result.scalars().all()
    
    products_response=[]
    for product in products:
        primary_image=None
        for image in product.images:
            if image.is_primary:
                primary_image=image.image_url
                break
        products_response.append(
            ProductResponse(
                id=product.id,
                name=product.name,
                price=product.price,
                color=product.color,
                size=product.size,
                primary_image=primary_image
            )
        )
    
    return products_response
    
#Product by id
def get_product(id:int,db:Session):
    product=db.get(Product,id)
    if not product:
        raise ProductNotFoundError()
    return product

#Displaying variants of a product
def get_product_variants(id: int, db: Session):
    product = db.get(Product, id)
    if not product:
        raise ProductNotFoundError()
    return product.variants


#Admin Dashboard
def update_products(payload:ProductUpdate,id:int,db:Session,admin:User):
    product=db.get(Product,id)
    if not product:
        raise ProductNotFoundError()

    update_data = payload.model_dump(exclude_unset=True)
    for key,value in update_data.items():
            setattr(product, key, value)
    db.commit()
    db.refresh(product)
    return product

#Admin Dashboard
def delete_products(id:int,admin:User,db:Session):
    product=db.get(Product,id)
    if not product:
        raise ProductNotFoundError()
    db.delete(product)
    db.commit()


import io
import uuid
from pathlib import Path
from PIL import Image
from fastapi import UploadFile, HTTPException
from app.models import ProductImage

UPLOAD_DIR = Path("uploads/products")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}
FORMAT_EXTENSIONS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB

async def upload_product_images(
    product_id: int,
    images: list[UploadFile],
    db: Session,
    variant_id:int|None,
    is_primary: bool = False,
):
    product = db.get(Product, product_id)
    if not product:
        raise ProductNotFoundError()
    if variant_id is not None:
        variant_db=db.get(ProductVariant,variant_id)
        if variant_db is None:
            raise VariantNotFoundError()
        if variant_db.product.id != product.id:
            raise InvalidVariantError()
    created_images=[]    
    for index,image in enumerate(images):
        if image.content_type not in ALLOWED_TYPES:
            raise HTTPException(
                status_code=400,
                detail="Only JPEG, PNG and WebP images are allowed"
            )

        contents = await image.read()

        if len(contents) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail="Image must be smaller than 5 MB"
            )

        try:
            img = Image.open(io.BytesIO(contents))
            img.verify()
        except Exception:
            raise HTTPException(
                status_code=400,
                detail="Invalid image file"
            )
        image_format = img.format
        if image_format is None:
                raise HTTPException(
                    status_code=400,
                    detail="Could not determine image format"
                )

        extension = FORMAT_EXTENSIONS.get(image_format)
        
        filename = f"{uuid.uuid4()}{extension}"
        file_path = UPLOAD_DIR / filename
        file_path.write_bytes(contents)

        image_url = f"/uploads/products/{filename}"
        
        if is_primary:
            for existing_image in product.images:
                existing_image.is_primary = False
        if index == 0:
            if  is_primary or len(product.images) == 0:
                image_is_primary = True
            else:
                image_is_primary = False
        else:
            image_is_primary = False

        product_image = ProductImage(
            product_id=product.id,
            variant_id=variant_id,
            image_url=image_url,
            is_primary=image_is_primary
        )
        created_images.append(product_image)
        db.add(product_image)
    db.commit()

    return {
        "message": "Images uploaded successfully",
        "images":created_images
    }


def delete_product_image(
    image_id: int,
    db: Session,
    product_id: int | None = None,
):
    image = db.get(ProductImage, image_id)
    if not image:
        raise ProductImageNotFoundError()
    if product_id is not None and image.product_id != product_id:
        raise ProductImageNotFoundError()

    # Delete physical file from uploads folder if it exists
    filename = Path(image.image_url).name
    file_path = UPLOAD_DIR / filename
    if file_path.exists() and file_path.is_file():
        try:
            file_path.unlink()
        except Exception:
            pass

    was_primary = image.is_primary
    product = image.product

    db.delete(image)
    db.flush()

    if was_primary and product and product.images:
        product.images[0].is_primary = True

    db.commit()
    return {"message": "Product image deleted successfully"}

