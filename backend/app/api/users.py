from fastapi import APIRouter,Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.services.user import get_current_user
from app.schemas.user import UpdateProfile, UserResponse
from app.db.database import get_db
from app.models.users import User
from app.core.exceptions import UserNotFoundError
from app.services.user import update_profile as update_profile_service,delete_profile as delete_profile_service
from sqlalchemy.exc import IntegrityError 
from fastapi import status,HTTPException


router=APIRouter(prefix="/user",tags=["Users"])


@router.get('/me',response_model=UserResponse) 
def get_me(current_user:User=Depends(get_current_user)): #->Exception handler used here.
    
        return UserResponse(id=current_user.id,
                    username=current_user.username,
                    email=current_user.email)
    
    
@router.patch('/profile',response_model=UserResponse)
def update_profile(payload:UpdateProfile,current_user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    try:
        update_profile_service(payload,db,current_user)
        return UserResponse(id=current_user.id,
                            username=current_user.username,
                            email=current_user.email)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username or email already exists")

@router.delete('/profile',status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(current_user:User=Depends(get_current_user),db:Session=Depends(get_db)):
    
    delete_profile_service(current_user,db)
    