from sqlalchemy import select
from app.schemas.categories import CategoryUpdate,CategoryCreate,CategoryBulk
from app.models.users import User
from sqlalchemy.orm import Session
from app.models.categories import Category
from app.core.exceptions import CategoryNotFoundError

def create_categories(payload:CategoryCreate,admin:User,db:Session):
    if payload.parent_id is not None and db.get(Category, payload.parent_id) is None:
        raise CategoryNotFoundError()
    db_category=Category(name=payload.name,parent_id=payload.parent_id)
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category

def list_categories(db:Session):
    stmt = select(Category).where(Category.parent_id == None)    
    result=db.execute(stmt)
    categories=result.scalars().all()
    return categories
def update_categories(id:int,payload:CategoryUpdate,admin:User,db:Session):
    stmt=select(Category).where(Category.id == id)
    result=db.execute(stmt)
    category_db = result.scalar_one_or_none()
    if category_db is None:
        raise CategoryNotFoundError()

    update_data = payload.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(category_db, key, value)

    db.commit()
    db.refresh(category_db)

    return category_db

def delete_categories(id:int,admin:User,db:Session):
    category_db=db.get(Category,id)
    if category_db is None:
        raise CategoryNotFoundError()
    db.delete(category_db)
    db.commit()


def create_categories_bulk(payload: CategoryBulk, admin: User, db: Session):
    categories_to_add = []

    for item in payload.categories:
        if item.parent_id is not None and db.get(Category, item.parent_id) is None:
            raise CategoryNotFoundError()

        categories_to_add.append(
            Category(
                name=item.name,
                parent_id=item.parent_id,
            )
        )

    db.add_all(categories_to_add)
    db.commit()

    for category in categories_to_add:
        db.refresh(category)

    return categories_to_add