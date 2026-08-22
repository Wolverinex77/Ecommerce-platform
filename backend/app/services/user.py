from app.schemas.user import UserCreate
from app.models.users import User
from sqlalchemy.orm import Session
from sqlalchemy import select
from fastapi import Depends
from app.core.security import oauth2_scheme,decode_access_token
from app.db.database import get_db
from app.schemas.user import UpdateProfile
from app.core.security import hash_password
from app.core.exceptions import UserNotFoundError, AdminRequiredError


def get_users(db:Session): #-> admin
    stmt=select(User)
    result=db.execute(stmt)
    users = result.scalars().all()
    return users


def get_current_user(
    token: str = Depends(oauth2_scheme), #auth header token extract (oauth2)
    db: Session = Depends(get_db)
):
    user_id = decode_access_token(token)
    print(user_id)
    stmt = select(User).where(User.id == user_id)
    print(stmt)
    db_user = db.execute(stmt).scalars().one_or_none()
    
    if db_user is None:
        raise UserNotFoundError()
    return db_user

def require_admin(user:User=Depends(get_current_user)):
    if not user.is_admin:
        raise AdminRequiredError()
    return user


def update_profile(payload:UpdateProfile,db:Session,current_user:User):
    ...
    if payload.name is not None:
        current_user.username=payload.name

    if payload.email is not None:
        current_user.email = payload.email
    
    if payload.password is not None:
        current_user.hashed_password=hash_password(payload.password)
    
    db.commit()

def delete_profile(current_user:User,db:Session):
    db.delete(current_user)
    db.commit()