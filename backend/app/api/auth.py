from fastapi import APIRouter,Depends,HTTPException,status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.schemas.user import UserCreate,UserLogin,Token, UserResponse
from app.services import auth as auth_service 
from app.core.exceptions import InvalidCredentialsError
from app.db.database import get_db
from app.core.exceptions import EmailAlreadyExistsError
router = APIRouter()
router=APIRouter(prefix="/auth",tags=["Authentication"])

@router.post('/register',status_code=status.HTTP_201_CREATED,response_model=UserResponse)
def register_user(user:UserCreate,db:Session=Depends(get_db)):
    try:
        created_user=auth_service.register_user(user,db)
        return created_user
    
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this username or email already exists."
        )
    except EmailAlreadyExistsError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already exists."
        )
       
@router.post('/login',response_model=Token,status_code=status.HTTP_201_CREATED)
def login_user(user:UserLogin,db:Session=Depends(get_db)):
    try:
        token=auth_service.login_user(user,db)
        return Token(
            access_token=token,
            token_type="bearer"
        )
    except InvalidCredentialsError:
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password"
        )