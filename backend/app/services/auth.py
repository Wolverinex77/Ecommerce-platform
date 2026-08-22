from app.schemas.user import UserCreate, UserLogin
from app.models.users import User
from app.core.security import hash_password,verify_password,create_access_token
from app.models.users import User
from app.core.exceptions import InvalidCredentialsError,EmailAlreadyExistsError
from sqlalchemy.orm import Session
from sqlalchemy import select


def register_user(user:UserCreate,db:Session):
    
    existing_user = db.scalar(
        select(User).where(User.email == user.email)
    )
    if existing_user:
        raise EmailAlreadyExistsError()   
    db_user=User(username=user.username,
             email=user.email,
             hashed_password=hash_password(user.password)
             )      
    db.add(db_user)

    db.commit()
    db.refresh(db_user)
    return db_user
def login_user(user:UserLogin,db:Session):
    stmt=select(User).where(User.email == user.email)
    result=db.execute(stmt)
    db_user=result.scalars().one_or_none()
    if db_user is None:
        raise InvalidCredentialsError
    if verify_password(user.password,db_user.hashed_password):
        return create_access_token(str(db_user.id))
    else:
        raise InvalidCredentialsError

