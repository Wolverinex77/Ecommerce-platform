from fastapi import APIRouter,Depends,HTTPException,status
from sqlalchemy.orm import Session
from app.services.user import require_admin
from app.models.users import User
from app.schemas.categories import CategoryCreate,CategoryResponse,CategoryUpdate,CategoryBulk
from app.core import exceptions
from app.db.database import get_db
from app.services import categories
router = APIRouter(prefix='/categories',tags=['Categories'])


@router.get('',response_model=list[CategoryResponse])
def list_categories(db:Session=Depends(get_db)):
    return categories.list_categories(db)

@router.post("",response_model=CategoryResponse)
def create_categories(category:CategoryCreate,admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    try:
        response=categories.create_categories(category,admin,db)
        return response
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Parent category not found")


@router.post("/bulk", response_model=list[CategoryResponse])
def create_categories_bulk(payload:CategoryBulk, admin:User=Depends(require_admin), db:Session=Depends(get_db)):
    try:
        created = categories.create_categories_bulk(payload, admin, db)
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Parent category not found")

    return created

@router.put("/{id}", response_model=CategoryResponse)
def update_categories(id:int,category_update:CategoryUpdate,admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    try:
        response=categories.update_categories(id,category_update,admin,db)
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return response

@router.delete("/{id}",status_code=status.HTTP_204_NO_CONTENT)
def delete_categories(id:int,admin:User=Depends(require_admin),db:Session=Depends(get_db)):
    try:
        categories.delete_categories(id,admin,db)
    except exceptions.CategoryNotFoundError:
        raise HTTPException(status_code=404, detail="Category not found")


