from app.utils import validators
from pydantic import BaseModel,field_validator,Field,EmailStr
from typing import Optional
class UserCreate(BaseModel):
    username:str=Field(max_length=50)
    email:EmailStr
    password:str
    @field_validator("password")
    @classmethod
    def check_password(cls, value):
        return validators.validate_password(value)
class UserLogin(BaseModel):
    email:EmailStr
    password:str

class Token(BaseModel):
    access_token: str
    token_type: str

class UpdateProfile(BaseModel):
    name: Optional[str] = Field(default=None, max_length=50)
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    @field_validator("password")
    @classmethod
    def check_password(cls, value):
        return validators.validate_password(value)

class UserResponse(BaseModel):
    id: int
    username: str
    email: EmailStr
    model_config = {
        "from_attributes": True
    }