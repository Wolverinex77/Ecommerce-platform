import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import {
  fetchCheckoutSummary,
  createCheckoutSession,
  createOrder,
  createOrderPayment,
  clearCart,
  fetchUserProfile,
  getImageUrl,
  getCartItemImageUrl,
  getAuthToken,
} from "../services/api";

import { clearGuestCart } from "../services/cartStorage";


const PAKISTAN_PROVINCES = [
  "Punjab",
  "Sindh",
  "KPK",
  "Balochistan",
  "Gilgit Baltistan",
  "AJK",
  "Islamabad",
];

export default function CheckoutPage() {
  const navigate = useNavigate();

  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [checkoutData, setCheckoutData] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Address selection
  const [selectedAddressId, setSelectedAddressId] = useState(null); // 'new' or number
  const [newAddress, setNewAddress] = useState({
    full_name: "",
    phone_number: "",
    country: "Pakistan",
    state: "Punjab",
    city: "",
    postal_code: "",
    address_line_1: "",
    address_line_2: "",
  });

  // Shipping & Payment selection
  const [shippingMethod, setShippingMethod] = useState("standard");
  const [paymentMethod, setPaymentMethod] = useState("STRIPE");

  // Order Placed State
  const [placedOrder, setPlacedOrder] = useState(null);

  // Load checkout summary & profile
  const loadCheckout = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsAuthModalOpen(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [summary, profile] = await Promise.all([
        fetchCheckoutSummary(),
        fetchUserProfile().catch(() => null),
      ]);

      if (!summary || !summary.cart_items || summary.cart_items.length === 0) {
        setError("Your cart is empty. Please add items before checking out.");
        setLoading(false);
        return;
      }

      setCheckoutData(summary);
      setUserProfile(profile);

      // Pre-select default address or first address
      if (summary.shipping_addresses && summary.shipping_addresses.length > 0) {
        const defaultId =
          summary.default_shipping_address_id ||
          summary.shipping_addresses[0].id;
        setSelectedAddressId(defaultId);
      } else {
        setSelectedAddressId("new");
        if (profile?.username) {
          setNewAddress((prev) => ({
            ...prev,
            full_name: profile.username,
          }));
        }
      }
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        setIsAuthModalOpen(true);
      } else {
        setError(err.message || "Failed to load checkout information.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCheckout();
  }, [loadCheckout]);

  // Handle Form Change for New Address
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setNewAddress((prev) => ({ ...prev, [name]: value }));
  };

  // Calculate live shipping fee & total
  const calculateShippingFee = () => {
    // If standard -> 250 (or backend default), if express -> 500
    if (shippingMethod === "express") {
      return 500;
    }
    return Number(checkoutData?.shipping_fee || 250);
  };

  const subtotalNumber = Number(checkoutData?.subtotal || 0);
  const shippingFeeNumber = calculateShippingFee();
  const discountNumber = Number(checkoutData?.discount || 0);
  const estimatedTotal = subtotalNumber + shippingFeeNumber - discountNumber;

  // Submit Order Handler
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      let payload = {
        shipping_method: shippingMethod,
        payment_method: paymentMethod,
      };

      if (selectedAddressId === "new") {
        // Validate required fields
        if (
          !newAddress.full_name ||
          !newAddress.phone_number ||
          !newAddress.city ||
          !newAddress.address_line_1
        ) {
          throw new Error(
            "Please fill in all required shipping address fields (Full Name, Phone, City, Address)."
          );
        }
        payload.shipping_address_create = newAddress;
      } else {
        payload.shipping_address_id = selectedAddressId;
      }

      // 1. Create Checkout Session (POST /cart/checkout)
      const checkoutSession = await createCheckoutSession(payload);

      // 2. Create Order (POST /orders)
      const createdOrder = await createOrder({
        checkout_id: checkoutSession.id,
      });

      const orderId = createdOrder?.id;
      if (!orderId) {
        throw new Error("Order creation failed: Order ID not found.");
      }

      // 3. If Safepay (STRIPE): create payment, fetch checkout URL, and redirect without clearing cart yet
      if (paymentMethod === "STRIPE") {
        const paymentResult = await createOrderPayment(orderId, {
          payment_method: "STRIPE",
        });

        if (paymentResult && paymentResult.checkout_url) {
          // Keep button in loading state and redirect to Safepay
          window.location.replace(paymentResult.checkout_url);
          return;
        } else {
          throw new Error("Unable to retrieve Safepay checkout URL.");
        }
      }

      // 4. COD: Order is successfully placed and confirmed immediately -> clear cart & notify
      try {
        await clearCart();
      } catch (clearErr) {
        console.warn("Could not clear cart after COD placement:", clearErr);
      }
      clearGuestCart();
      window.dispatchEvent(new CustomEvent("cart-updated"));

      setPlacedOrder(createdOrder);
      setSubmitting(false);
    } catch (err) {
      console.error("Checkout submission failed:", err);
      setError(err.message || "Failed to complete order. Please try again.");
      setSubmitting(false);
    }

  };




  // Image helper
  const getItemImageUrl = (item) => {
    return getCartItemImageUrl(item);
  };


  // ==================== SUCCESS SCREEN ====================
  if (placedOrder) {
    return (
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-8 sm:p-12 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-forest/10 border border-forest/30 flex items-center justify-center text-forest animate-bounce">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Thank You for Your Order!
            </h1>
            <p className="text-ink-soft text-sm sm:text-base">
              Your order{" "}
              <span className="text-forest font-mono font-bold">
                #{placedOrder.order_number || placedOrder.id}
              </span>{" "}
              has been placed and is being processed.
            </p>
          </div>

          <div className="bg-paper border border-hairline rounded-md p-6 max-w-md mx-auto text-left space-y-3 text-xs text-ink-soft">
            <div className="flex justify-between">
              <span>Order Number:</span>
              <span className="text-white font-bold font-mono">
                {placedOrder.order_number || placedOrder.id}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Payment Method:</span>
              <span className="text-white font-semibold">
                {paymentMethod === "COD" ? "Cash on Delivery (COD)" : "Safepay Checkout (Debit / Credit Cards)"}
              </span>
            </div>

            <div className="flex justify-between">
              <span>Shipping Method:</span>
              <span className="text-white font-semibold capitalize">
                {shippingMethod} Delivery
              </span>
            </div>
            <div className="flex justify-between border-t border-hairline pt-3 text-sm">
              <span className="font-bold text-white">Total Amount:</span>
              <span className="font-display font-bold text-forest text-base">
                Rs. {Number(placedOrder.total_amount || estimatedTotal).toLocaleString("en-PK")}
              </span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/account"
              className="w-full sm:w-auto bg-surface border border-hairline text-white hover:border-forest px-6 py-3 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
            >
              View Order History
            </Link>
            <Link
              to="/products"
              className="w-full sm:w-auto bg-forest text-black hover:bg-forest-dark px-8 py-3 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors shadow-lg"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-8">
          <div className="h-6 bg-surface rounded w-48 border border-hairline"></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-7 space-y-6">
              <div className="h-40 bg-surface rounded-md border border-hairline"></div>
              <div className="h-40 bg-surface rounded-md border border-hairline"></div>
            </div>
            <div className="lg:col-span-5 h-80 bg-surface rounded-md border border-hairline"></div>
          </div>
        </div>
      </main>
    );
  }

  // ==================== EMPTY CART OR ERROR ====================
  if (error && !checkoutData) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 shadow-2xl space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-rust/10 flex items-center justify-center text-rust">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-white">
            Cannot Proceed to Checkout
          </h2>
          <p className="text-xs text-ink-soft">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/products")}
            className="inline-block bg-forest text-black hover:bg-forest-dark px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Browse Products
          </button>
        </div>
      </main>
    );
  }

  const items = checkoutData?.cart_items || [];
  const savedAddresses = checkoutData?.shipping_addresses || [];

  return (
    <div className="min-h-screen bg-paper">
      {/* Top Breadcrumb Bar */}
      <div className="border-b border-hairline bg-surface/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent("open-cart-drawer"))}
            className="text-ink-soft hover:text-white transition-colors text-xs flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            <span>Return to Bag</span>
          </button>
          <span className="text-xs font-bold uppercase tracking-widest text-forest">
            Secure Checkout
          </span>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <form onSubmit={handlePlaceOrder}>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* ==================== LEFT COLUMN: SHOPIFY-STYLE CHECKOUT FORM (7 COLS) ==================== */}
            <div className="lg:col-span-7 space-y-8">
              {error && (
                <div className="bg-rust/10 border border-rust/30 text-rust rounded-md p-4 text-sm font-medium">
                  {error}
                </div>
              )}

              {/* 1. Contact */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-xl sm:text-[22px] font-bold text-white tracking-tight">
                    Contact
                  </h2>
                  {!userProfile && (
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="text-sm text-forest hover:underline cursor-pointer font-medium"
                    >
                      Sign in
                    </button>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    readOnly={!!userProfile?.email}
                    value={userProfile?.email || newAddress.email || ""}
                    onChange={(e) =>
                      setNewAddress((prev) => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="your-email@example.com"
                    className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest transition-colors"
                  />
                </div>
              </section>

              {/* 2. Delivery */}
              <section className="space-y-4">
                <h2 className="font-display text-xl sm:text-[22px] font-bold text-white tracking-tight">
                  Delivery
                </h2>

                {/* Saved Addresses Selector (if user has saved addresses) */}
                {savedAddresses.length > 0 && (
                  <div className="space-y-2.5 pb-1">
                    <label className="block text-xs font-semibold text-ink-soft uppercase tracking-wider">
                      Saved Addresses
                    </label>
                    <div className="space-y-2.5">
                      {savedAddresses.map((addr) => (
                        <label
                          key={addr.id}
                          className={`flex items-start gap-3.5 p-4 rounded-md border cursor-pointer transition-colors ${selectedAddressId === addr.id
                              ? "bg-forest/5 border-forest text-white"
                              : "bg-surface border-hairline text-ink-soft hover:border-ink-soft/40"
                            }`}
                        >
                          <input
                            type="radio"
                            name="shipping_address"
                            value={addr.id}
                            checked={selectedAddressId === addr.id}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1 text-forest focus:ring-forest bg-paper border-hairline"
                          />
                          <div className="text-sm space-y-0.5">
                            <p className="font-bold text-white">{addr.full_name}</p>
                            <p>
                              {addr.address_line_1}
                              {addr.address_line_2 ? `, ${addr.address_line_2}` : ""}
                            </p>
                            <p>
                              {addr.city}, {addr.state} {addr.postal_code || ""}
                            </p>
                            <p className="text-xs text-ink-soft/70">
                              Tel: {addr.phone_number}
                            </p>
                          </div>
                        </label>
                      ))}

                      {/* Add new address option */}
                      <label
                        className={`flex items-center gap-3.5 p-3.5 rounded-md border cursor-pointer transition-colors ${selectedAddressId === "new"
                            ? "bg-forest/5 border-forest text-white"
                            : "bg-surface border-hairline text-ink-soft hover:border-ink-soft/40"
                          }`}
                      >
                        <input
                          type="radio"
                          name="shipping_address"
                          value="new"
                          checked={selectedAddressId === "new"}
                          onChange={() => setSelectedAddressId("new")}
                          className="text-forest focus:ring-forest bg-paper border-hairline"
                        />
                        <span className="text-sm font-semibold text-white">
                          + Use a new delivery address
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {/* Delivery Address Inputs Form */}
                {selectedAddressId === "new" && (
                  <div className="space-y-3.5 pt-1">
                    {/* Country / Region */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Country/Region
                      </label>
                      <select
                        name="country"
                        value={newAddress.country}
                        onChange={handleAddressChange}
                        className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-forest"
                      >
                        <option value="Pakistan">Pakistan</option>
                      </select>
                    </div>

                    {/* Name & Phone */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                          Full name *
                        </label>
                        <input
                          type="text"
                          name="full_name"
                          required
                          value={newAddress.full_name}
                          onChange={handleAddressChange}
                          placeholder="e.g. John Doe"
                          className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                          Phone *
                        </label>
                        <input
                          type="tel"
                          name="phone_number"
                          required
                          value={newAddress.phone_number}
                          onChange={handleAddressChange}
                          placeholder="03001234567"
                          className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest"
                        />
                      </div>
                    </div>

                    {/* Address Line 1 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Address *
                      </label>
                      <input
                        type="text"
                        name="address_line_1"
                        required
                        value={newAddress.address_line_1}
                        onChange={handleAddressChange}
                        placeholder="House #, Street name, Area"
                        className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest"
                      />
                    </div>

                    {/* Address Line 2 */}
                    <div>
                      <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                        Apartment, suite, etc. (optional)
                      </label>
                      <input
                        type="text"
                        name="address_line_2"
                        value={newAddress.address_line_2}
                        onChange={handleAddressChange}
                        placeholder="Apartment, unit, building, floor"
                        className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest"
                      />
                    </div>

                    {/* City, Province, Postal Code */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      <div>
                        <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                          City *
                        </label>
                        <input
                          type="text"
                          name="city"
                          required
                          value={newAddress.city}
                          onChange={handleAddressChange}
                          placeholder="Lahore"
                          className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                          Province / State *
                        </label>
                        <select
                          name="state"
                          value={newAddress.state}
                          onChange={handleAddressChange}
                          className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-forest"
                        >
                          {PAKISTAN_PROVINCES.map((prov) => (
                            <option key={prov} value={prov}>
                              {prov}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-ink-soft mb-1.5">
                          Postal code (optional)
                        </label>
                        <input
                          type="text"
                          name="postal_code"
                          value={newAddress.postal_code}
                          onChange={handleAddressChange}
                          placeholder="54000"
                          className="w-full bg-surface border border-hairline rounded-md px-4 py-3 text-sm text-white placeholder-ink-soft/40 focus:outline-none focus:border-forest"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </section>

              {/* 3. Shipping method */}
              <section className="space-y-3.5">
                <h2 className="font-display text-xl sm:text-[22px] font-bold text-white tracking-tight">
                  Shipping method
                </h2>

                <div className="rounded-md border border-hairline bg-surface divide-y divide-hairline overflow-hidden">
                  <label
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${shippingMethod === "standard" ? "bg-forest/5" : "hover:bg-paper/40"
                      }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <input
                        type="radio"
                        name="shipping_method"
                        value="standard"
                        checked={shippingMethod === "standard"}
                        onChange={() => setShippingMethod("standard")}
                        className="text-forest focus:ring-forest bg-paper border-hairline"
                      />
                      <span className="text-sm font-semibold text-white">
                        Standard Shipping (2-4 Business Days)
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white">Rs. 250</span>
                  </label>

                  <label
                    className={`flex items-center justify-between p-4 cursor-pointer transition-colors ${shippingMethod === "express" ? "bg-forest/5" : "hover:bg-paper/40"
                      }`}
                  >
                    <div className="flex items-center gap-3.5">
                      <input
                        type="radio"
                        name="shipping_method"
                        value="express"
                        checked={shippingMethod === "express"}
                        onChange={() => setShippingMethod("express")}
                        className="text-forest focus:ring-forest bg-paper border-hairline"
                      />
                      <span className="text-sm font-semibold text-white">
                        Express Shipping (1-2 Business Days)
                      </span>
                    </div>
                    <span className="text-sm font-bold text-white">Rs. 500</span>
                  </label>
                </div>
              </section>

              {/* 4. Payment */}
              <section className="space-y-3">
                <div>
                  <h2 className="font-display text-xl sm:text-[22px] font-bold text-white tracking-tight">
                    Payment
                  </h2>
                  <p className="text-xs sm:text-sm text-ink-soft mt-0.5">
                    All transactions are secure and encrypted.
                  </p>
                </div>

                <div className="rounded-md border border-hairline bg-surface divide-y divide-hairline overflow-hidden mt-3">
                  {/* Safepay Checkout */}
                  <div>
                    <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-paper/40 transition-colors">
                      <div className="flex items-center gap-3.5">
                        <input
                          type="radio"
                          name="payment_method"
                          value="STRIPE"
                          checked={paymentMethod === "STRIPE"}
                          onChange={() => setPaymentMethod("STRIPE")}
                          className="text-forest focus:ring-forest bg-paper border-hairline"
                        />
                        <span className="text-sm font-semibold text-white">
                          Safepay Checkout - pay with debit & credit cards
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {/* Visa Badge */}
                        <div className="h-5 px-1.5 bg-[#00579f] rounded-xs flex items-center justify-center text-[10px] font-black text-white italic tracking-wider shadow-xs">
                          VISA
                        </div>
                        {/* Mastercard Badge */}
                        <div className="h-5 px-1.5 bg-[#181818] border border-white/10 rounded-xs flex items-center justify-center shadow-xs">
                          <div className="flex -space-x-1 items-center">
                            <span className="w-3 h-3 rounded-full bg-[#EB001B] inline-block opacity-95"></span>
                            <span className="w-3 h-3 rounded-full bg-[#F79E1B] inline-block opacity-95"></span>
                          </div>
                        </div>
                      </div>
                    </label>

                    {paymentMethod === "STRIPE" && (
                      <div className="p-4 bg-paper/60 border-t border-hairline text-xs sm:text-sm text-ink-soft leading-relaxed text-center sm:text-left">
                        You'll be redirected to Safepay Checkout - pay with debit & credit cards to complete your purchase.
                      </div>
                    )}
                  </div>

                  {/* Cash on Delivery */}
                  <div>
                    <label className="flex items-center justify-between p-4 cursor-pointer hover:bg-paper/40 transition-colors">
                      <div className="flex items-center gap-3.5">
                        <input
                          type="radio"
                          name="payment_method"
                          value="COD"
                          checked={paymentMethod === "COD"}
                          onChange={() => setPaymentMethod("COD")}
                          className="text-forest focus:ring-forest bg-paper border-hairline"
                        />
                        <span className="text-sm font-semibold text-white">
                          Cash on Delivery (COD)
                        </span>
                      </div>
                      <span className="text-xs text-ink-soft">
                        Pay on delivery
                      </span>
                    </label>
                  </div>
                </div>
              </section>

              {/* Action Button: Complete Order or Pay Now */}
              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-forest text-black hover:bg-forest-dark py-4 px-6 rounded-md text-sm sm:text-base font-bold uppercase tracking-wider transition-all shadow-xl flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? (
                    <span>
                      {paymentMethod === "STRIPE" ? "Redirecting to Safepay..." : "Processing Order..."}
                    </span>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <span>
                        {paymentMethod === "STRIPE" ? "Pay Now" : "Complete Order"} &bull; Rs. {estimatedTotal.toLocaleString("en-PK")}
                      </span>
                    </>
                  )}
                </button>
              </div>

            </div>


            {/* ==================== RIGHT COLUMN: STICKY ORDER SUMMARY (5 COLS) ==================== */}
            <div className="lg:col-span-5 sticky top-6 self-start z-10 w-full">
              <div className="bg-surface border border-hairline rounded-md p-6 shadow-2xl space-y-6">
                <h2 className="font-display text-lg sm:text-xl font-bold text-white pb-3 border-b border-hairline tracking-tight">
                  Order Summary ({items.length} {items.length === 1 ? "item" : "items"})
                </h2>

                {/* Scrollable Item Rows */}
                <div className="divide-y divide-hairline max-h-80 overflow-y-auto pr-1">
                  {items.map((item) => {
                    const imgUrl = getItemImageUrl(item);
                    const itemTotal = Number(item.unit_price) * item.quantity;
                    const color = item.variant?.color || item.product?.color || null;
                    const size = item.variant?.size || item.product?.size || null;

                    return (
                      <div key={item.id} className="py-3.5 flex items-center gap-3.5">
                        {/* Thumbnail with floating badge */}
                        <div className="relative w-14 h-16 bg-paper border border-hairline rounded-sm flex-shrink-0 overflow-visible">
                          {imgUrl ? (
                            <img
                              src={imgUrl}
                              alt={item.product?.name || "Product"}
                              className="w-full h-full object-cover rounded-sm"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-ink-soft/30">
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          {/* Quantity Badge */}
                          <span className="absolute -top-2 -right-2 bg-forest text-black font-bold text-[11px] w-5 h-5 rounded-full flex items-center justify-center border border-surface shadow">
                            {item.quantity}
                          </span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">
                            {item.product?.name || `Product #${item.product_id}`}
                          </p>
                          {(color || size) && (
                            <p className="text-xs text-ink-soft mt-0.5">
                              {color && <span>{color}</span>}
                              {color && size && <span> / </span>}
                              {size && <span>Size {size}</span>}
                            </p>
                          )}
                        </div>

                        {/* Price */}
                        <span className="text-sm font-bold text-white">
                          Rs. {itemTotal.toLocaleString("en-PK")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Subtotals & Fees */}
                <div className="border-t border-hairline pt-4 space-y-3 text-sm">
                  <div className="flex justify-between text-ink-soft">
                    <span>Subtotal</span>
                    <span className="text-white font-semibold">
                      Rs. {subtotalNumber.toLocaleString("en-PK")}
                    </span>
                  </div>

                  <div className="flex justify-between text-ink-soft">
                    <span>Shipping ({shippingMethod === "express" ? "Express" : "Standard"})</span>
                    <span className="text-white font-semibold">
                      Rs. {shippingFeeNumber.toLocaleString("en-PK")}
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

                  <div className="border-t border-hairline pt-3.5 flex justify-between items-baseline">
                    <span className="text-base font-bold text-white">Total Amount</span>
                    <span className="font-display text-2xl font-bold text-white">
                      Rs. {estimatedTotal.toLocaleString("en-PK")}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </form>
      </main>

      {/* Auth Modal for guest prompt */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          if (!getAuthToken()) {
            navigate("/");
          }
        }}
        title="Sign In to Checkout"
        description="Please sign in or create an account to proceed with your checkout."
        onSuccess={() => {
          setIsAuthModalOpen(false);
          loadCheckout();
        }}
      />
    </div>
  );
}
