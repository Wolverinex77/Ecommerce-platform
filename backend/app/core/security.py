from sqlalchemy import select
from jose import jwt
from jose.exceptions import ExpiredSignatureError, JWTError
from datetime import datetime,timedelta,timezone
from app.core.config import settings

from pwdlib import PasswordHash
from fastapi.security import OAuth2PasswordBearer
from fastapi import Depends,HTTPException,status
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
password_hash = PasswordHash.recommended()
def hash_password(password: str) -> str:
    return password_hash.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return password_hash.verify(plain, hashed)



# -------------------- Function --------------------
def create_access_token(user_id: str) -> str:
    """
    Generate a JWT access token for a given user ID.

Args:
        user_id (str): The unique ID of the user

    Returns:
        str: Signed JWT access token
    """
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {
        "sub": user_id,  # user identity
        "exp": expire    # expiration time
    }

    token = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return token

def decode_access_token(token:str):
    try:
        payload=jwt.decode(token,settings.secret_key,algorithms=[settings.algorithm])
    
    except ExpiredSignatureError:
        raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token has expired",
    )
    except JWTError:
        raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        )

    return payload.get("sub")