import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { fetchPaymentStatus, fetchOrderDetails, getAuthToken, clearCart } from "../services/api";
import { clearGuestCart } from "../services/cartStorage";
import AuthModal from "../components/AuthModal";


function parseCleanOrderId(rawParam) {
  if (!rawParam) return null;
  if (typeof rawParam === "number" && !isNaN(rawParam)) return rawParam;
  if (typeof rawParam === "object" && rawParam !== null) {
    const val = rawParam.value || rawParam.order_id || rawParam.id;
    const num = parseInt(val, 10);
    return isNaN(num) ? val : num;
  }
  if (typeof rawParam === "string") {
    const trimmed = rawParam.trim();
    if (/^\d+$/.test(trimmed)) {
      return parseInt(trimmed, 10);
    }
    const match = trimmed.match(/['"]?value['"]?\s*:\s*['"]?(\d+)['"]?/);
    if (match) {
      return parseInt(match[1], 10);
    }
    const matchOrderId = trimmed.match(/['"]?order_id['"]?\s*:\s*['"]?(\d+)['"]?/);
    if (matchOrderId) {
      return parseInt(matchOrderId[1], 10);
    }
    const anyNum = trimmed.match(/\d+/);
    if (anyNum) {
      return parseInt(anyNum[0], 10);
    }
  }
  return rawParam;
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawOrderId = searchParams.get("order_id");
  const orderId = parseCleanOrderId(rawOrderId);


  // State: 'verifying' | 'success' | 'processing' | 'failed' | 'access_denied' | 'not_found'
  const [status, setStatus] = useState("verifying");
  const [orderData, setOrderData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pollingCount, setPollingCount] = useState(0);

  const pollTimerRef = useRef(null);
  const hasClearedCartRef = useRef(false);

  const verifyStatus = useCallback(async (isInitial = false) => {
    if (!orderId) {
      setStatus("not_found");
      setErrorMessage("No order reference provided in the URL.");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setIsAuthModalOpen(true);
      return;
    }

    if (isInitial) {
      setStatus("verifying");
      setErrorMessage(null);
    }

    try {
      const data = await fetchPaymentStatus(orderId);

      const paymentStatus = (data?.payment_status || "").toUpperCase();
      const orderStatus = (data?.order_status || "").toUpperCase();

      // Rule: Only confirm when payment_status === "PAID" AND order_status === "CONFIRMED"
      if (paymentStatus === "PAID" && orderStatus === "CONFIRMED") {
        // Clear authenticated user's backend cart once payment is confirmed
        if (!hasClearedCartRef.current) {
          hasClearedCartRef.current = true;
          try {
            await clearCart();
          } catch (clearErr) {
            console.warn("Could not clear cart after payment confirmation:", clearErr);
          }
          clearGuestCart();
          window.dispatchEvent(new CustomEvent("cart-updated"));
        }

        // Fetch order details for overview card
        try {
          const order = await fetchOrderDetails(orderId);
          if (order) {
            setOrderData(order);
          }
        } catch (err) {
          console.warn("Could not load order details:", err);
        }

        setStatus("success");
      } else if (

        paymentStatus === "FAILED" ||
        paymentStatus === "CANCELLED" ||
        orderStatus === "CANCELLED"
      ) {
        setStatus("failed");
        setErrorMessage(
          "Your payment was not completed or was declined. Please try again."
        );
      } else {
        // Payment/Order is still PENDING / PROCESSING (webhook in flight)
        setPollingCount((prev) => {
          const nextCount = prev + 1;
          // Poll up to 8 times (every 2.5s for ~20s) while webhook completes
          if (nextCount <= 8) {
            pollTimerRef.current = setTimeout(() => {
              verifyStatus(false);
            }, 2500);
          } else {
            setStatus("processing");
          }
          return nextCount;
        });
      }
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        setIsAuthModalOpen(true);
      } else if (err.message === "ACCESS_DENIED") {
        setStatus("access_denied");
        setErrorMessage("You do not have permission to view this order.");
      } else if (err.message === "ORDER_NOT_FOUND") {
        setStatus("not_found");
        setErrorMessage("The requested order could not be found.");
      } else {
        setStatus("failed");
        setErrorMessage(
          err.message || "Unable to confirm payment status. Please check your order history."
        );
      }
    }
  }, [orderId]);

  useEffect(() => {
    verifyStatus(true);

    return () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
      }
    };
  }, [verifyStatus]);

  // ==================== 1. VERIFYING / LOADING STATE ====================
  if (status === "verifying") {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 sm:p-14 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-forest/10 border border-forest/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-forest animate-spin"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8H4z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Confirming your payment...
            </h1>
            <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto">
              Please wait a moment while we verify your transaction status with the system.
            </p>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          title="Sign in to view order"
          description="Please sign in to verify your order payment status."
          onSuccess={() => {
            setIsAuthModalOpen(false);
            verifyStatus(true);
          }}
        />
      </main>
    );
  }

  // ==================== 2. PROCESSING STATE (IF WEBHOOK DELAYED) ====================
  if (status === "processing") {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 sm:p-14 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <svg className="w-8 h-8 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Payment is Being Processed
            </h1>
            <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto">
              Your payment is currently being confirmed. Your order status will update as soon as the bank notification completes.
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => {
                setPollingCount(0);
                verifyStatus(true);
              }}
              className="w-full sm:w-auto bg-forest text-black hover:bg-forest-dark px-8 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors shadow-lg cursor-pointer"
            >
              Refresh Status
            </button>
            <Link
              to="/account"
              className="w-full sm:w-auto bg-surface border border-hairline text-white hover:border-forest px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
            >
              View Order History
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ==================== 3. ACCESS DENIED (403) ====================
  if (status === "access_denied") {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 sm:p-14 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-rust/10 border border-rust/30 flex items-center justify-center text-rust">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Access Denied
            </h1>
            <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto">
              {errorMessage || "You do not have permission to view this order."}
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/account"
              className="w-full sm:w-auto bg-forest text-black hover:bg-forest-dark px-8 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors shadow-lg"
            >
              Go to Account
            </Link>
            <Link
              to="/products"
              className="w-full sm:w-auto bg-surface border border-hairline text-white hover:border-forest px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ==================== 4. FAILED / NOT FOUND STATE ====================
  if (status === "failed" || status === "not_found") {
    return (
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 sm:p-14 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-rust/10 border border-rust/30 flex items-center justify-center text-rust">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
              {status === "not_found" ? "Order Not Found" : "Payment Not Completed"}
            </h1>
            <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto">
              {errorMessage || "We were unable to confirm your payment. Please check your payment details or try again."}
            </p>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/checkout"
              className="w-full sm:w-auto bg-forest text-black hover:bg-forest-dark px-8 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors shadow-lg font-semibold"
            >
              Return to Checkout
            </Link>
            <Link
              to="/products"
              className="w-full sm:w-auto bg-surface border border-hairline text-white hover:border-forest px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ==================== 5. CONFIRMED / SUCCESS STATE ====================
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
      <div className="bg-surface border border-hairline rounded-lg p-8 sm:p-12 shadow-2xl space-y-7">
        {/* Success Icon */}
        <div className="w-16 h-16 mx-auto rounded-full bg-forest/10 border border-forest/30 flex items-center justify-center text-forest shadow-inner">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-forest/10 border border-forest/20 text-forest text-xs font-bold uppercase tracking-wider mb-1">
            <span className="w-2 h-2 rounded-full bg-forest animate-ping inline-block"></span>
            Payment Successful
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Thank You! Your Order is Confirmed
          </h1>
          <p className="text-ink-soft text-sm sm:text-base max-w-lg mx-auto">
            Your payment has been verified and your order is now confirmed and being processed.
          </p>
        </div>

        {/* Order Overview Card */}
        {orderData && (
          <div className="bg-paper border border-hairline rounded-md p-6 max-w-md mx-auto text-left space-y-3.5 text-xs text-ink-soft shadow-md">
            {orderData.order_number && (
              <div className="flex justify-between items-center">
                <span>Order Number:</span>
                <span className="text-white font-bold font-mono text-sm">
                  #{orderData.order_number}
                </span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span>Payment Status:</span>
              <span className="text-forest font-semibold flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-forest inline-block"></span>
                Paid Online
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span>Order Status:</span>
              <span className="text-forest font-semibold capitalize">
                Confirmed
              </span>
            </div>

            {orderData.total_amount && (
              <div className="flex justify-between items-center border-t border-hairline pt-3 text-sm">
                <span className="font-bold text-white">Total Paid:</span>
                <span className="font-display font-bold text-forest text-base">
                  Rs. {Number(orderData.total_amount).toLocaleString("en-PK")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            to="/account"
            className="w-full sm:w-auto bg-surface border border-hairline text-white hover:border-forest px-6 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors"
          >
            View Order History
          </Link>
          <Link
            to="/products"
            className="w-full sm:w-auto bg-forest text-black hover:bg-forest-dark px-8 py-3 rounded-md text-xs font-bold uppercase tracking-wider transition-colors shadow-lg font-semibold"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    </main>
  );
}
