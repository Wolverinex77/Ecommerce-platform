from fastapi import Request
from fastapi.responses import JSONResponse
from app.core.exceptions import AdminRequiredError, UserNotFoundError

def user_not_found_handler(request: Request, exc: UserNotFoundError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": exc.error_code},
    )
    
def admin_permission_handler(request: Request, exc: AdminRequiredError):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "error_code": exc.error_code},
    )