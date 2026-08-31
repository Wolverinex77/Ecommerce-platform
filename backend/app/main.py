from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api import auth, users, products, categories, cart, orders, reviews,payment,shipping
from app.core.exceptions import AdminRequiredError, UserNotFoundError
from app.core.exception_handler import user_not_found_handler, admin_permission_handler
from app.models.users import Base
from app.core.config import settings
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="E-Commerce System")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(products.router)
app.include_router(categories.router)
app.include_router(cart.router)
app.include_router(orders.router)
app.include_router(reviews.router)
app.include_router(shipping.router)
app.include_router(payment.router)
app.add_exception_handler(
    UserNotFoundError,
    user_not_found_handler #type:ignore
)
app.add_exception_handler(
    AdminRequiredError,
    admin_permission_handler #type:ignore
)


@app.get('/')
def root():
    return {"message": "E-Commerce API"}


origins = [
    "http://localhost:5173",  # Vite localhost
    "http://127.0.0.1:5173",  # Vite 127.0.0.1
    "http://127.0.0.1:5500",
    "http://localhost:5500",  # Live server
    settings.frontend_url
]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)