import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import {
  fetchCart,
  fetchProductById,
  fetchProductVariants,
  updateCartItemQuantity,
  deleteCartItem,
  clearCart,
  fetchCheckoutSummary,
  getImageUrl,
  getCartItemImageUrl,
  getAuthToken,
} from "../services/api";

import {
  getGuestCart,
  updateGuestCartItemQuantity,
  removeGuestCartItem,
  clearGuestCart,
  syncGuestCartWithBackend,
} from "../services/cartStorage";

export default function CartPage() {
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [checkoutSummary, setCheckoutSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Per-item loading state tracking
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [deletingItemId, setDeletingItemId] = useState(null);
  const [isClearing, setIsClearing] = useState(false);

  // Auth modal state for checkout
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  /**
   * Helper to build and set the guest cart state from localStorage + live product data.
   */
  const loadGuestCartData = async () => {
    try {
      const guestItems = getGuestCart();

      if (guestItems.length === 0) {
        setCart({
          id: "guest",
          user_id: null,
          items: [],
          total_items: 0,
          subtotal: 0,
        });
        setCheckoutSummary(null);
        setLoading(false);
        return;
      }

      // Fetch authoritative product and variant details in parallel for each item
      const resolvedItems = await Promise.all(
        guestItems.map(async (guestItem) => {
          try {
            const product = await fetchProductById(guestItem.product_id);
            let matchedVariant = null;

            if (guestItem.variant_id) {
              try {
                const variants = await fetchProductVariants(guestItem.product_id);
                matchedVariant = variants.find(
                  (v) => Number(v.id) === Number(guestItem.variant_id)
                ) || null;
              } catch {
                matchedVariant = null;
              }
            }

            const unitPrice = Number(product.price || 0);

            return {
              id: `${guestItem.product_id}-${guestItem.variant_id || "simple"}`,
              product_id: guestItem.product_id,
              variant_id: guestItem.variant_id || null,
              quantity: guestItem.quantity,
              unit_price: unitPrice,
              product: {
                id: product.id,
                name: product.name,
                price: product.price,
                color: product.color,
                size: product.size,
                images: product.images,
                primary_image: product.primary_image,
                image_url: product.image_url,
              },
              variant: matchedVariant
                ? {
                    id: matchedVariant.id,
                    color: matchedVariant.color,
                    size: matchedVariant.size,
                  }
                : null,
            };
          } catch (pErr) {
            console.warn(`Could not load product #${guestItem.product_id}:`, pErr);
            return null;
          }
        })
      );

      // Filter out any products that failed to fetch or no longer exist
      const validItems = resolvedItems.filter(Boolean);
      const subtotal = validItems.reduce(
        (sum, item) => sum + item.unit_price * item.quantity,
        0
      );
      const total_items = validItems.reduce(
        (sum, item) => sum + item.quantity,
        0
      );

      setCart({
        id: "guest",
        user_id: null,
        items: validItems,
        total_items,
        subtotal,
      });
      setCheckoutSummary(null);
    } catch (err) {
      console.error("Error constructing guest cart:", err);
      setError("Failed to load your cart items. Please refresh or try again.");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Load cart data based on authentication status.
   * If authenticated: sync guest items (if any) and fetch backend cart.
   * If guest or expired token: fall back to guest cart.
   */
  const loadCartData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const token = getAuthToken();

    if (token) {
      // 1. Authenticated User Flow
      try {
        // Automatically synchronize any pending guest items
        const guestItems = getGuestCart();
        if (guestItems.length > 0) {
          try {
            await syncGuestCartWithBackend();
          } catch (syncErr) {
            console.warn("Could not sync guest cart items:", syncErr);
          }
        }

        const backendCart = await fetchCart();
        setCart(backendCart);

        // Fetch official checkout calculation if items exist
        if (backendCart?.items && backendCart.items.length > 0) {
          try {
            const summary = await fetchCheckoutSummary();
            setCheckoutSummary(summary);
          } catch {
            setCheckoutSummary(null);
          }
        } else {
          setCheckoutSummary(null);
        }
        setLoading(false);
      } catch (err) {
        if (err.message === "UNAUTHORIZED") {
          // Token is expired or invalid: clear it and gracefully fall back to guest cart
          console.warn("Token expired or unauthorized. Switching to guest mode.");
          localStorage.removeItem("token");
          localStorage.removeItem("access_token");
          window.dispatchEvent(new CustomEvent("cart-updated"));
          await loadGuestCartData();
        } else {
          console.error("Error fetching authenticated cart:", err);
          setError(err.message || "Failed to load cart");
          setLoading(false);
        }
      }
    } else {
      // 2. Guest User Flow
      await loadGuestCartData();
    }
  }, []);


  useEffect(() => {
    loadCartData();
    window.scrollTo({ top: 0, behavior: "smooth" });

    // Listen for cart update events
    const handleCartUpdate = () => {
      loadCartData();
    };

    window.addEventListener("cart-updated", handleCartUpdate);
    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
    };
  }, [loadCartData]);

  // Update item quantity
  const handleQuantityChange = async (item, delta) => {
    const newQty = item.quantity + delta;
    if (newQty < 1 || updatingItemId === item.id) return;

    setUpdatingItemId(item.id);
    const token = getAuthToken();

    try {
      if (token) {
        // Authenticated flow
        await updateCartItemQuantity(item.id, newQty);
        const updatedCart = await fetchCart();
        setCart(updatedCart);

        if (updatedCart?.items?.length > 0) {
          const summary = await fetchCheckoutSummary();
          setCheckoutSummary(summary);
        }
      } else {
        // Guest flow
        updateGuestCartItemQuantity(item.product_id, item.variant_id, newQty);
        // Update local cart state immediately
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
      }
    } catch (err) {
      alert(err.message || "Failed to update item quantity");
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Delete single item
  const handleDeleteItem = async (item) => {
    if (deletingItemId === item.id) return;
    setDeletingItemId(item.id);

    const token = getAuthToken();

    try {
      if (token) {
        // Authenticated flow
        await deleteCartItem(item.id);
        const updatedCart = await fetchCart();
        setCart(updatedCart);

        if (updatedCart?.items?.length > 0) {
          const summary = await fetchCheckoutSummary();
          setCheckoutSummary(summary);
        } else {
          setCheckoutSummary(null);
        }
      } else {
        // Guest flow
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
      }
    } catch (err) {
      alert(err.message || "Failed to remove item");
    } finally {
      setDeletingItemId(null);
    }
  };

  // Clear entire cart
  const handleClearCart = async () => {
    if (!window.confirm("Are you sure you want to clear your entire cart?")) return;

    setIsClearing(true);
    const token = getAuthToken();

    try {
      if (token) {
        await clearCart();
        const updatedCart = await fetchCart();
        setCart(updatedCart);
        setCheckoutSummary(null);
      } else {
        clearGuestCart();
        setCart({
          id: "guest",
          user_id: null,
          items: [],
          total_items: 0,
          subtotal: 0,
        });
        setCheckoutSummary(null);
      }
    } catch (err) {
      alert(err.message || "Failed to clear cart");
    } finally {
      setIsClearing(false);
    }
  };

  // Checkout handling: prompt sign-in for guests
  const handleProceedToCheckout = () => {
    const token = getAuthToken();
    if (!token) {
      setIsAuthModalOpen(true);
    } else {
      alert("Proceeding to checkout with official order calculation.");
    }
  };

  // Resolve item image
  const getItemImageUrl = (item) => {
    return getCartItemImageUrl(item);
  };


  // Extract color and size
  const getItemAttributes = (item) => {
    const color = item.variant?.color || item.product?.color || null;
    const size = item.variant?.size || item.product?.size || null;
    return {
      color: color && color !== "None" && color !== "null" ? color : null,
      size: size && size !== "None" && size !== "null" ? size : null,
    };
  };

  // Calculate totals
  const subtotalNumber = cart?.subtotal
    ? Number(cart.subtotal)
    : (cart?.items || []).reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);

  const shippingFeeNumber = checkoutSummary?.shipping_fee
    ? Number(checkoutSummary.shipping_fee)
    : 0;

  const discountNumber = checkoutSummary?.discount
    ? Number(checkoutSummary.discount)
    : 0;

  const totalNumber = checkoutSummary?.total_amount
    ? Number(checkoutSummary.total_amount)
    : subtotalNumber + shippingFeeNumber - discountNumber;

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-8">
          <div className="h-8 bg-surface rounded w-48 border border-hairline"></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-8 space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 bg-surface rounded-md border border-hairline"></div>
              ))}
            </div>
            <div className="lg:col-span-4 h-64 bg-surface rounded-md border border-hairline"></div>
          </div>
        </div>
      </main>
    );
  }

  // ==================== ERROR STATE ====================
  if (error) {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-rust/10 border border-rust/20 flex items-center justify-center text-rust">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="font-display text-2xl font-bold text-white">Something Went Wrong</h2>
          <p className="text-sm text-ink-soft max-w-md mx-auto">{error}</p>
          <button
            onClick={loadCartData}
            className="bg-forest text-black hover:bg-forest-dark px-6 py-2.5 rounded-sm text-sm font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  const items = cart?.items || [];
  const isEmpty = items.length === 0;

  // ==================== EMPTY CART STATE ====================
  if (isEmpty) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 sm:p-14 shadow-2xl space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-paper border border-hairline flex items-center justify-center text-ink-soft/50">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-white">
              Your Cart is Empty
            </h1>
            <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto leading-relaxed">
              Looks like you haven't added anything to your cart yet. Explore our curated collections to find essentials you'll love.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/products"
              className="inline-flex items-center gap-2 bg-forest text-black hover:bg-forest-dark px-8 py-3.5 rounded-sm text-sm font-semibold uppercase tracking-wider transition-all shadow-lg hover:shadow-forest/20"
            >
              Continue Shopping
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ==================== POPULATED CART ====================
  return (
    <>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {/* Header */}
        <div className="flex items-baseline justify-between border-b border-hairline pb-4 mb-8">
          <div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
              Shopping Cart
            </h1>
            <p className="text-xs text-ink-soft mt-1">
              {cart.total_items} {cart.total_items === 1 ? "item" : "items"} in your cart
            </p>
          </div>

          <button
            type="button"
            onClick={handleClearCart}
            disabled={isClearing}
            className="text-xs font-semibold text-ink-soft hover:text-rust transition-colors uppercase tracking-wider disabled:opacity-50"
          >
            {isClearing ? "Clearing..." : "Clear Cart"}
          </button>
        </div>

        {/* 2-Column Grid: Cart Items (8 cols) + Summary (4 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          {/* ==================== LEFT: CART ITEMS LIST (8 COLS) ==================== */}
          <div className="lg:col-span-8 space-y-4">
            {items.map((item) => {
              const product = item.product || {};
              const imageUrl = getItemImageUrl(item);
              const { color, size } = getItemAttributes(item);
              const isUpdating = updatingItemId === item.id;
              const isDeleting = deletingItemId === item.id;

              const unitPriceFormatted = Number(item.unit_price).toLocaleString("en-PK");
              const itemSubtotalFormatted = (Number(item.unit_price) * item.quantity).toLocaleString("en-PK");

              return (
                <div
                  key={item.id}
                  className={`bg-surface border border-hairline rounded-md p-3.5 sm:p-5 transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 sm:gap-6 ${
                    isDeleting ? "opacity-40 pointer-events-none scale-[0.99]" : ""
                  }`}
                >
                  {/* Left: Thumbnail & Details */}
                  <div className="flex items-start gap-3.5 sm:gap-5 flex-1 min-w-0">
                    <Link
                      to={`/products/${item.product_id}`}
                      className="w-18 h-22 sm:w-24 sm:h-28 rounded-sm bg-paper border border-hairline overflow-hidden flex-shrink-0 relative group"
                    >
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={product.name || "Product"}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-soft/40">
                          <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </Link>

                    <div className="flex-1 min-w-0 space-y-1 sm:space-y-1.5">
                      <Link
                        to={`/products/${item.product_id}`}
                        className="font-display text-sm sm:text-base md:text-lg font-bold text-white hover:text-forest transition-colors line-clamp-2"
                      >
                        {product.name || `Product #${item.product_id}`}
                      </Link>

                      <p className="text-xs text-ink-soft">
                        Unit Price: <span className="text-white font-semibold">Rs. {unitPriceFormatted}</span>
                      </p>

                      {/* Dynamic Color & Size Badges */}
                      {(color || size) && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {color && (
                            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold bg-paper border border-hairline px-2 py-0.5 rounded-sm text-white">
                              <span className="text-ink-soft font-normal uppercase tracking-wider text-[10px]">Color:</span> {color}
                            </span>
                          )}
                          {size && (
                            <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-semibold bg-paper border border-hairline px-2 py-0.5 rounded-sm text-white">
                              <span className="text-ink-soft font-normal uppercase tracking-wider text-[10px]">Size:</span> {size}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Quantity Controls + Price + Remove */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-5 pt-3 sm:pt-0 border-t sm:border-t-0 border-hairline">
                    {/* Stepper */}
                    <div className="flex items-center border border-hairline rounded-sm bg-paper h-8">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, -1)}
                        disabled={item.quantity <= 1 || isUpdating || isDeleting}
                        className="w-7 sm:w-8 h-full flex items-center justify-center text-white hover:text-forest disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm cursor-pointer"
                        aria-label="Decrease quantity"
                      >
                        &minus;
                      </button>
                      <span className="w-8 sm:w-9 text-center text-xs font-bold text-white">
                        {isUpdating ? "..." : item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item, 1)}
                        disabled={isUpdating || isDeleting}
                        className="w-7 sm:w-8 h-full flex items-center justify-center text-white hover:text-forest disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-xs sm:text-sm cursor-pointer"
                        aria-label="Increase quantity"
                      >
                        &#43;
                      </button>
                    </div>

                    {/* Subtotal */}
                    <div className="text-right min-w-[80px] sm:min-w-[100px]">
                      <p className="text-sm sm:text-base font-bold text-white whitespace-nowrap">
                        Rs. {itemSubtotalFormatted}
                      </p>
                    </div>

                    {/* Remove Button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      disabled={isDeleting || isUpdating}
                      className="text-ink-soft hover:text-rust transition-colors p-1.5 rounded-sm hover:bg-rust/10 cursor-pointer flex-shrink-0"
                      title="Remove item"
                      aria-label="Remove item from cart"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

              );
            })}
          </div>

          {/* ==================== RIGHT: ORDER SUMMARY (4 COLS) ==================== */}
          <div className="lg:col-span-4 space-y-4 sticky top-24">
            <div className="bg-surface border border-hairline rounded-md p-6 shadow-xl space-y-5">
              <h2 className="font-display text-xl font-bold text-white pb-3 border-b border-hairline">
                Order Summary
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-ink-soft">
                  <span>Subtotal ({cart.total_items} items)</span>
                  <span className="text-white font-semibold">
                    Rs. {subtotalNumber.toLocaleString("en-PK")}
                  </span>
                </div>

                <div className="flex justify-between text-ink-soft">
                  <span>Estimated Shipping</span>
                  <span className="text-white font-semibold">
                    {shippingFeeNumber > 0 ? `Rs. ${shippingFeeNumber.toLocaleString("en-PK")}` : "Calculated at checkout"}
                  </span>
                </div>

                {discountNumber > 0 && (
                  <div className="flex justify-between text-forest">
                    <span>Discount</span>
                    <span className="font-semibold">
                      - Rs. {discountNumber.toLocaleString("en-PK")}
                    </span>
                  </div>
                )}

                <div className="border-t border-hairline pt-3 flex justify-between items-baseline">
                  <span className="text-base font-bold text-white">Estimated Total</span>
                  <span className="font-display text-2xl font-bold text-white">
                    Rs. {totalNumber.toLocaleString("en-PK")}
                  </span>
                </div>
              </div>

              {/* Checkout Button */}
              <button
                type="button"
                onClick={handleProceedToCheckout}
                className="w-full bg-forest text-black hover:bg-forest-dark py-3.5 px-6 rounded-sm text-sm font-bold uppercase tracking-wider transition-all shadow-lg hover:shadow-forest/20 flex items-center justify-center gap-2"
              >
                <span>Proceed to Checkout</span>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </main>


      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        title="Sign In to Complete Order"
        description="Please sign in or create an account to synchronize your cart and proceed to checkout."
        onSuccess={() => {
          loadCartData();
        }}
      />
    </>
  );
}
