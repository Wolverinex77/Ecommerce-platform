class AppError(Exception):
    """Base exception class for all custom application business errors."""
    status_code: int = 400
    error_code: str = "BAD_REQUEST"
    detail: str = "An unexpected business error occurred."

    def __init__(
        self,
        detail: str | None = None,
        error_code: str | None = None,
        status_code: int | None = None
    ):
        if detail is not None:
            self.detail = detail
        if error_code is not None:
            self.error_code = error_code
        if status_code is not None:
            self.status_code = status_code
        super().__init__(self.detail)


# ==========================================
# 1. AUTHENTICATION & USER EXCEPTIONS
# ==========================================

class InvalidCredentialsError(AppError):
    status_code = 401
    error_code = "INVALID_CREDENTIALS"
    detail = "Invalid email or password."


class EmailAlreadyExistsError(AppError):
    status_code = 409
    error_code = "EMAIL_ALREADY_EXISTS"
    detail = "A user with this email already exists."


class UserNotFoundError(AppError):
    status_code = 404
    error_code = "USER_NOT_FOUND"
    detail = "User was not found."


class AdminRequiredError(AppError):
    status_code = 403
    error_code = "ADMIN_REQUIRED"
    detail = "Admin access required."


# Alias for backward compatibility
AdminNotFoundError = AdminRequiredError


# ==========================================
# 2. CATEGORY EXCEPTIONS
# ==========================================

class CategoryNotFoundError(AppError):
    status_code = 404
    error_code = "CATEGORY_NOT_FOUND"
    detail = "Category was not found."


# ==========================================
# 3. PRODUCT, VARIANT & INVENTORY EXCEPTIONS
# ==========================================

class ProductNotFoundError(AppError):
    status_code = 404
    error_code = "PRODUCT_NOT_FOUND"
    detail = "Product was not found."


class VariantNotFoundError(AppError):
    status_code = 404
    error_code = "VARIANT_NOT_FOUND"
    detail = "Product variant was not found."


class InvalidVariantError(AppError):
    status_code = 409
    error_code = "INVALID_VARIANT"
    detail = "Variant does not belong to this product."


class StockExceededError(AppError):
    status_code = 409
    error_code = "INSUFFICIENT_STOCK"
    detail = "Requested quantity exceeds available stock."


# Alias for clean naming
InsufficientStockError = StockExceededError


class ProductImageNotFoundError(AppError):
    status_code = 404
    error_code = "PRODUCT_IMAGE_NOT_FOUND"
    detail = "Product image was not found."


# ==========================================
# 4. CART & CHECKOUT EXCEPTIONS
# ==========================================

class CartIsEmptyError(AppError):
    status_code = 409
    error_code = "CART_IS_EMPTY"
    detail = "Cart is empty."


class CartItemNotFoundError(AppError):
    status_code = 404
    error_code = "CART_ITEM_NOT_FOUND"
    detail = "Cart item was not found."


class CheckoutNotFoundError(AppError):
    status_code = 404
    error_code = "CHECKOUT_NOT_FOUND"
    detail = "Checkout session was not found."


# Alias for backward compatibility
CheckOutIsEmptyError = CheckoutNotFoundError


class InvalidCheckoutRequestError(AppError):
    status_code = 400
    error_code = "INVALID_CHECKOUT_REQUEST"
    detail = "Invalid checkout request."


class ShippingAddressNotFoundError(AppError):
    status_code = 404
    error_code = "SHIPPING_ADDRESS_NOT_FOUND"
    detail = "Shipping address was not found."


# ==========================================
# 5. ORDER & PAYMENT EXCEPTIONS
# ==========================================

class OrderNotFoundError(AppError):
    status_code = 404
    error_code = "ORDER_NOT_FOUND"
    detail = "Order was not found."


class OrderAccessDeniedError(AppError):
    status_code = 403
    error_code = "ORDER_ACCESS_DENIED"
    detail = "You do not have permission to view or modify this order."


# Alias for backward compatibility
OrderAccessDenied = OrderAccessDeniedError


class InvalidStateTransitionError(AppError):
    status_code = 400
    error_code = "INVALID_ORDER_STATE_TRANSITION"
    detail = "Invalid order status transition."


# Alias for backward compatibility
InvalidStateTransition = InvalidStateTransitionError


class InvalidPaymentMethodError(AppError):
    status_code = 400
    error_code = "INVALID_PAYMENT_METHOD"
    detail = "Invalid payment method selected."


class PaymentFailedError(AppError):
    status_code = 400
    error_code = "PAYMENT_FAILED"
    detail = "Payment processing failed."