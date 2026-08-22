import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router-dom";

import AuthModal from "./AuthModal";
import {
  fetchCart,
  updateCartItemQuantity,
  deleteCartItem,
  getAuthToken,
  setAuthToken,
  fetchProductById,
  fetchProductVariants,
  getImageUrl,
  getCartItemImageUrl,
} from "../services/api";

import {
  getGuestCart,
  updateGuestCartItemQuantity,
  removeGuestCartItem,
} from "../services/cartStorage";

export default function CartDrawer() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Load cart (authenticated or guest)
  const loadCartData = useCallback(async () => {
    const token = getAuthToken();

    if (token) {
      try {
        const data = await fetchCart();
        setCart(data);
      } catch (err) {
        if (err.message === "UNAUTHORIZED") {
          setAuthToken(null);
          loadGuestCart();
        } else {
          console.warn("Error loading cart for drawer:", err);
        }
      }
    } else {
      await loadGuestCart();
    }
  }, []);

  const loadGuestCart = async () => {
    const guestItems = getGuestCart();
    if (!guestItems || guestItems.length === 0) {
      setCart({
        id: "guest",
        user_id: null,
        items: [],
        total_items: 0,
        subtotal: 0,
      });
      return;
    }

    try {
      const enrichedItems = await Promise.all(
        guestItems.map(async (gItem, idx) => {
          try {
            const product = await fetchProductById(gItem.product_id);
            let variant = null;

            if (gItem.variant_id) {
              try {
                const variants = await fetchProductVariants(gItem.product_id);
                variant = variants.find((v) => v.id === gItem.variant_id) || null;
              } catch {
                variant = null;
              }
            }

            const unit_price = Number(product.price || 0);

            return {
              id: `guest-${gItem.product_id}-${gItem.variant_id || "simple"}-${idx}`,
              product_id: gItem.product_id,
              variant_id: gItem.variant_id,
              quantity: gItem.quantity,
              unit_price: unit_price,
              product: product,
              variant: variant,
            };
          } catch {
            return null;
          }
        })
      );

      const validItems = enrichedItems.filter(Boolean);
      const subtotal = validItems.reduce(
        (sum, it) => sum + it.unit_price * it.quantity,
        0
      );
      const total_items = validItems.reduce(
        (sum, it) => sum + it.quantity,
        0
      );

      setCart({
        id: "guest",
        user_id: null,
        items: validItems,
        total_items,
        subtotal,
      });
    } catch {
      setCart({
        id: "guest",
        user_id: null,
        items: [],
        total_items: 0,
        subtotal: 0,
      });
    }
  };

  // Event listeners for global open / close / update events
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      loadCartData();
    };

    const handleToggle = () => {
      setIsOpen((prev) => {
        if (!prev) loadCartData();
        return !prev;
      });
    };

    const handleUpdate = () => {
      loadCartData();
    };

    window.addEventListener("open-cart-drawer", handleOpen);
    window.addEventListener("toggle-cart-drawer", handleToggle);
    window.addEventListener("cart-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("open-cart-drawer", handleOpen);
      window.removeEventListener("toggle-cart-drawer", handleToggle);
      window.removeEventListener("cart-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [loadCartData]);

  // Handle Escape key & body scroll locking
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  // Quantity Change Handler
  const handleQuantityChange = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty < 1) return;

    setUpdatingItemId(item.id);
    const token = getAuthToken();

    try {
      if (token && typeof item.id === "number") {
        await updateCartItemQuantity(item.id, newQty);
        const updated = await fetchCart();
        setCart(updated);
        window.dispatchEvent(new CustomEvent("cart-updated"));
      } else {
        updateGuestCartItemQuantity(item.product_id, item.variant_id, newQty);
        setCart((prev) => {
          if (!prev) return prev;
          const updatedItems = prev.items.map((it) =>
            it.id === item.id ? { ...it, quantity: newQty } : it
          );
          const subtotal = updatedItems.reduce(
            (sum, it) => sum + it.unit_price * it.quantity,
            0
          );
          const total_items = updatedItems.reduce(
            (sum, it) => sum + it.quantity,
            0
          );
          return { ...prev, items: updatedItems, subtotal, total_items };
        });
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    } catch (err) {
      console.warn("Failed to update item quantity:", err);
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Remove Item Handler
  const handleDeleteItem = async (item) => {
    setDeletingItemId(item.id);
    const token = getAuthToken();

    try {
      if (token && typeof item.id === "number") {
        await deleteCartItem(item.id);
        const updated = await fetchCart();
        setCart(updated);
        window.dispatchEvent(new CustomEvent("cart-updated"));
      } else {
        removeGuestCartItem(item.product_id, item.variant_id);
        setCart((prev) => {
          if (!prev) return prev;
          const updatedItems = prev.items.filter((it) => it.id !== item.id);
          const subtotal = updatedItems.reduce(
            (sum, it) => sum + it.unit_price * it.quantity,
            0
          );
          const total_items = updatedItems.reduce(
            (sum, it) => sum + it.quantity,
            0
          );
          return { ...prev, items: updatedItems, subtotal, total_items };
        });
        window.dispatchEvent(new CustomEvent("cart-updated"));
      }
    } catch (err) {
      console.warn("Failed to remove item:", err);
    } finally {
      setDeletingItemId(null);
    }
  };

  // Image resolution helper
  const getItemImageUrl = (item) => {
    return getCartItemImageUrl(item);
  };


  const handleCheckoutClick = () => {
    setIsOpen(false);
    const token = getAuthToken();
    if (!token) {
      setIsAuthModalOpen(true);
    } else {
      navigate("/checkout");
    }
  };


  const items = cart?.items || [];
  const totalCount = cart?.total_items || 0;
  const subtotalNumber = Number(cart?.subtotal || 0);

  const drawerContent = (
    <>
      {/* 1. Fixed Full-Screen Backdrop Overlay */}
      <div
        onClick={() => setIsOpen(false)}
        className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-xs transition-opacity duration-300 ${
          isOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* 2. Fixed Right-Side Drawer Panel */}
      <aside
        id="cart-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={`fixed top-0 right-0 bottom-0 z-50 w-full max-w-full sm:max-w-[420px] bg-surface border-l border-hairline flex flex-col shadow-2xl transition-transform duration-300 ease-in-out h-full overflow-hidden box-border ${
          isOpen ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none"
        }`}
      >
        {/* ==================== 1. FIXED HEADER ==================== */}
        <header className="px-4 sm:px-6 py-4 sm:py-5 border-b border-hairline flex items-center justify-between bg-surface/95 backdrop-blur-md flex-shrink-0 w-full box-border">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg className="w-5 h-5 text-forest flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
            <h2 id="cart-drawer-title" className="font-display text-base sm:text-lg font-bold text-white tracking-tight truncate">
              Your Bag
            </h2>
            <span className="text-xs text-ink-soft font-semibold flex-shrink-0">
              ({totalCount})
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="text-ink-soft hover:text-white p-1.5 rounded-sm hover:bg-paper transition-colors cursor-pointer flex-shrink-0"
            aria-label="Close bag"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* ==================== 2. SCROLLABLE CART ITEMS LIST ==================== */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 divide-y divide-hairline overscroll-contain min-h-0 w-full box-border">
          {items.length === 0 ? (
            <div className="py-20 sm:py-24 text-center space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-paper border border-hairline flex items-center justify-center text-ink-soft/40">
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              <div>
                <p className="font-display text-base font-bold text-white mb-1">
                  Your bag is empty
                </p>
                <p className="text-xs text-ink-soft max-w-xs mx-auto">
                  Explore our collections and discover timeless essentials.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-block bg-forest text-black hover:bg-forest-dark px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors shadow-md cursor-pointer"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => {
              const imgUrl = getItemImageUrl(item);
              const isUpdating = updatingItemId === item.id;
              const isDeleting = deletingItemId === item.id;
              const unitPrice = Number(item.unit_price || 0);
              const itemSubtotal = unitPrice * item.quantity;
              const color = item.variant?.color || item.product?.color || null;
              const size = item.variant?.size || item.product?.size || null;

              return (
                <div
                  key={item.id}
                  className={`py-4 flex gap-3.5 sm:gap-4 items-start w-full min-w-0 transition-opacity box-border ${
                    isDeleting ? "opacity-30 pointer-events-none" : ""
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-20 sm:w-18 sm:h-22 bg-paper border border-hairline rounded-sm overflow-hidden flex-shrink-0">
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={item.product?.name || "Item"}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink-soft/30">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[5rem] gap-2">
                    <div>
                      <div className="flex items-start justify-between gap-2 min-w-0">
                        <Link
                          to={`/products/${item.product_id}`}
                          onClick={() => setIsOpen(false)}
                          className="font-medium text-xs sm:text-sm text-white hover:text-forest transition-colors truncate block flex-1 min-w-0"
                        >
                          {item.product?.name || `Product #${item.product_id}`}
                        </Link>

                        {/* Delete */}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item)}
                          className="text-ink-soft hover:text-rust transition-colors p-1 cursor-pointer flex-shrink-0 -mr-1"
                          title="Remove item"
                          aria-label="Remove item"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>

                      {/* Variant Chips */}
                      {(color || size) && (
                        <p className="text-[11px] sm:text-xs text-ink-soft mt-0.5 truncate">
                          {color && <span>{color}</span>}
                          {color && size && <span> / </span>}
                          {size && <span>Size {size}</span>}
                        </p>
                      )}
                    </div>

                    {/* Controls & Price */}
                    <div className="flex items-center justify-between gap-2 pt-1 w-full min-w-0">
                      {/* Stepper */}
                      <div className="flex items-center border border-hairline rounded-sm bg-paper h-7 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item, -1)}
                          disabled={item.quantity <= 1 || isUpdating}
                          className="w-6 sm:w-7 h-full flex items-center justify-center text-white hover:text-forest disabled:opacity-30 transition-colors text-xs cursor-pointer"
                          aria-label="Decrease quantity"
                        >
                          &minus;
                        </button>
                        <span className="w-6 sm:w-7 text-center text-xs font-bold text-white">
                          {isUpdating ? "..." : item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuantityChange(item, 1)}
                          disabled={isUpdating}
                          className="w-6 sm:w-7 h-full flex items-center justify-center text-white hover:text-forest disabled:opacity-30 transition-colors text-xs cursor-pointer"
                          aria-label="Increase quantity"
                        >
                          &#43;
                        </button>
                      </div>

                      {/* Item Total */}
                      <span className="text-xs sm:text-sm font-bold text-white whitespace-nowrap text-right flex-shrink-0">
                        Rs. {itemSubtotal.toLocaleString("en-PK")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ==================== 3. FIXED FOOTER & CHECKOUT ==================== */}
        {items.length > 0 && (
          <footer className="p-4 sm:p-6 border-t border-hairline bg-surface/98 backdrop-blur-md space-y-4 flex-shrink-0 w-full box-border pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            {/* Summary Lines */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between text-ink-soft gap-2">
                <span>Subtotal</span>
                <span className="text-white font-semibold flex-shrink-0">
                  Rs. {subtotalNumber.toLocaleString("en-PK")}
                </span>
              </div>

              <div className="flex items-center justify-between text-ink-soft gap-2">
                <span>Shipping</span>
                <span className="text-forest font-medium text-right flex-shrink-0">
                  Calculated at checkout
                </span>
              </div>

              <div className="pt-2.5 border-t border-hairline flex items-baseline justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Estimated Total
                </span>
                <span className="font-display text-lg sm:text-xl font-bold text-white whitespace-nowrap flex-shrink-0">
                  Rs. {subtotalNumber.toLocaleString("en-PK")}
                </span>
              </div>
            </div>

            {/* Primary Action: Checkout */}
            <button
              type="button"
              onClick={handleCheckoutClick}
              className="w-full bg-forest text-black hover:bg-forest-dark py-3.5 px-4 sm:px-6 rounded-sm text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Proceed to Checkout</span>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </footer>
        )}
      </aside>

      {/* Auth Modal for guest checkout */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign In to Checkout"
        description="Please sign in or create an account to proceed with your checkout."
        onSuccess={() => {
          setIsAuthModalOpen(false);
          loadCartData();
          navigate("/checkout");
        }}
      />
    </>
  );

  return typeof document !== "undefined"
    ? createPortal(drawerContent, document.body)
    : drawerContent;
}


