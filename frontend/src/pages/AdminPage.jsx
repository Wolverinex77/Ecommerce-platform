import { useState, useEffect, useCallback, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  fetchAdminOrders,
  deleteAdminOrder,
  updateAdminOrderStatus,
  updateAdminOrderPaymentStatus,
  createAdminProduct,
  updateAdminProduct,
  deleteAdminProduct,
  createAdminProductsBulk,
  uploadAdminProductImages,
  deleteProductImage,
  fetchCategories,
  createAdminCategory,
  createAdminCategoriesBulk,
  updateAdminCategory,
  deleteAdminCategory,
  fetchProducts,
  fetchProductDetails,
  fetchUserProfile,
  loginUser,
  getAuthToken,
  setAuthToken,
  getImageUrl,
} from "../services/api";

/**
 * Sales Calculation Rules:
 * - COD: Count sale only when DELIVERED
 * - Online payment: Count sale when CONFIRMED after successful payment (PAID)
 * - Cancelled: Never count
 * - Payment failed: Never count
 * - Refunded: Remove from net sales
 */
function calculateOrderSaleAmount(order) {
  if (!order) return 0;
  const amount = parseFloat(order.total_amount || 0) || 0;
  const orderStatus = (order.status || order.order_status || "pending").toLowerCase();
  const paymentMethod = (order.payment?.payment_method || order.payment_method || "COD").toUpperCase();
  const paymentStatus = (order.payment?.payment_status || order.payment_status || "pending").toLowerCase();

  // Cancelled or payment failed -> never count
  if (orderStatus === "cancelled" || paymentStatus === "cancelled" || paymentStatus === "failed") {
    return 0;
  }

  // Refunded -> remove from net sales
  if (paymentStatus === "refunded") {
    return -amount;
  }

  // COD -> count sale only when DELIVERED
  const isCOD = paymentMethod === "COD" || paymentMethod.includes("CASH");
  if (isCOD) {
    return orderStatus === "delivered" ? amount : 0;
  }

  // Online payment (STRIPE): Count sale when CONFIRMED (or shipped/delivered) or when PAID
  const isConfirmed = ["confirmed", "shipped", "delivered"].includes(orderStatus);
  const isPaid = paymentStatus === "paid";
  if (isConfirmed || isPaid) {
    return amount;
  }

  return 0;
}

const ALLOWED_ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export default function AdminPage() {
  const navigate = useNavigate();

  // Authentication State
  const [authToken, setTokenState] = useState(getAuthToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active View Tab: 'dashboard' | 'orders' | 'products' | 'categories'
  const [activeTab, setActiveTab] = useState("dashboard");

  // Core Data States
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [productCategoryFilter, setProductCategoryFilter] = useState("all");
  const [productStockFilter, setProductStockFilter] = useState("all");

  // Modals & Drawers
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [pendingStatusSelection, setPendingStatusSelection] = useState("");
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [managingImagesProduct, setManagingImagesProduct] = useState(null);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [isBulkCategoryOpen, setIsBulkCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type: 'product'|'category'|'order', id, title }

  // Sync pending status selection whenever selectedOrder changes
  useEffect(() => {
    if (selectedOrder) {
      setPendingStatusSelection((selectedOrder.status || selectedOrder.order_status || "pending").toLowerCase());
    } else {
      setPendingStatusSelection("");
    }
  }, [selectedOrder]);

  // Notifications / Toast
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  // Check Current User Auth
  const verifyAuth = useCallback(async () => {
    const token = getAuthToken();
    if (!token) {
      setIsCheckingAuth(false);
      setIsLoading(false);
      return;
    }
    try {
      const user = await fetchUserProfile();
      setCurrentUser(user);
    } catch (err) {
      console.warn("Auth check failed:", err);
      setAuthToken(null);
      setTokenState("");
      setCurrentUser(null);
    } finally {
      setIsCheckingAuth(false);
    }
  }, []);

  useEffect(() => {
    verifyAuth();
  }, [verifyAuth]);

  // Load Admin Data (Orders, Products, Categories)
  const loadAdminData = useCallback(async () => {
    if (!getAuthToken()) return;
    setIsLoading(true);
    try {
      const [ordersData, productsData, categoriesData] = await Promise.all([
        fetchAdminOrders().catch((err) => {
          console.warn("Could not fetch orders:", err);
          return [];
        }),
        fetchProducts().catch((err) => {
          console.warn("Could not fetch products:", err);
          return [];
        }),
        fetchCategories().catch((err) => {
          console.warn("Could not fetch categories:", err);
          return [];
        }),
      ]);

      const safeOrders = Array.isArray(ordersData) ? ordersData : [];
      setOrders(safeOrders);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      return safeOrders;
    } catch (err) {
      showToast("Failed to load store data", "error");
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (currentUser?.is_admin) {
      loadAdminData();
    }
  }, [currentUser, loadAdminData]);

  // Handle Admin Login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    setIsLoggingIn(true);
    try {
      const res = await loginUser({ email: loginEmail, password: loginPassword });
      setAuthToken(res.access_token);
      setTokenState(res.access_token);
      const profile = await fetchUserProfile();

      if (!profile?.is_admin) {
        setAuthToken(null);
        setTokenState("");
        setCurrentUser(null);
        setLoginError("Access denied: This account does not have administrator privileges.");
        return;
      }

      setCurrentUser(profile);
      showToast(`Welcome back, ${profile.username}!`);
      loadAdminData();
    } catch (err) {
      setLoginError(err.message || "Invalid credentials or unauthorized");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleAdminLogout = () => {
    setAuthToken(null);
    setTokenState("");
    setCurrentUser(null);
    navigate("/");
  };

  // Flattened categories for selectors
  const flatCategories = useMemo(() => {
    const list = [];
    function traverse(nodes, depth = 0) {
      for (const node of nodes) {
        list.push({ id: node.id, name: `${"— ".repeat(depth)}${node.name}`, rawName: node.name });
        if (node.children && node.children.length > 0) {
          traverse(node.children, depth + 1);
        }
      }
    }
    traverse(categories);
    return list;
  }, [categories]);

  // Dashboard Metrics
  const metrics = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((acc, order) => {
      return acc + calculateOrderSaleAmount(order);
    }, 0);

    const pendingOrders = orders.filter((o) => (o.status || o.order_status) === "pending").length;
    const confirmedOrders = orders.filter((o) => (o.status || o.order_status) === "confirmed").length;
    const shippedOrders = orders.filter((o) => (o.status || o.order_status) === "shipped").length;
    const deliveredOrders = orders.filter((o) => (o.status || o.order_status) === "delivered").length;
    const cancelledOrders = orders.filter((o) => (o.status || o.order_status) === "cancelled").length;

    const totalProducts = products.length;
    const lowStockProducts = products.filter((p) => {
      const qty = p.stock_quantity ?? 0;
      return qty > 0 && qty <= 5;
    }).length;
    const outOfStockProducts = products.filter((p) => {
      const qty = p.stock_quantity ?? 0;
      return qty === 0;
    }).length;

    return {
      totalOrders,
      totalRevenue: Math.max(0, totalRevenue),
      pendingOrders,
      confirmedOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      totalProducts,
      lowStockProducts,
      outOfStockProducts,
    };
  }, [orders, products]);

  // Filtered Orders
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const status = (order.status || order.order_status || "").toLowerCase();
      if (orderStatusFilter !== "all" && status !== orderStatusFilter.toLowerCase()) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const idMatch = String(order.id).includes(q);
        const orderNumMatch = (order.order_number || "").toLowerCase().includes(q);
        const customerNameMatch = (order.user?.username || "").toLowerCase().includes(q);
        const customerEmailMatch = (order.user?.email || "").toLowerCase().includes(q);
        return idMatch || orderNumMatch || customerNameMatch || customerEmailMatch;
      }
      return true;
    });
  }, [orders, orderStatusFilter, searchQuery]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (productCategoryFilter !== "all" && String(prod.category_id) !== String(productCategoryFilter)) {
        return false;
      }
      if (productStockFilter === "in_stock" && (prod.stock_quantity ?? 0) <= 0) return false;
      if (productStockFilter === "low_stock" && ((prod.stock_quantity ?? 0) <= 0 || (prod.stock_quantity ?? 0) > 5)) return false;
      if (productStockFilter === "out_of_stock" && (prod.stock_quantity ?? 0) > 0) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = (prod.name || "").toLowerCase().includes(q);
        const idMatch = String(prod.id).includes(q);
        return nameMatch || idMatch;
      }
      return true;
    });
  }, [products, productCategoryFilter, productStockFilter, searchQuery]);

  // ── Actions ──

  // Update Order Status
  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const currentStatus = (selectedOrder?.status || selectedOrder?.order_status || "pending").toLowerCase();
    const allowed = ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];
    const targetStatus = (newStatus || "").toLowerCase();

    // Front-end safeguard: do not dispatch identical or invalid transition to backend
    if (targetStatus === currentStatus) {
      return;
    }
    if (!allowed.includes(targetStatus)) {
      showToast(
        `Cannot change order from ${currentStatus.toUpperCase()} to ${targetStatus.toUpperCase()}`,
        "error"
      );
      return;
    }

    setActionLoading(true);
    try {
      await updateAdminOrderStatus(orderId, targetStatus);
      showToast(`Order #${orderId} marked as ${targetStatus.toUpperCase()}`);
      const freshOrders = await loadAdminData();
      if (selectedOrder && selectedOrder.id === orderId) {
        const fresh = Array.isArray(freshOrders) ? freshOrders.find((o) => o.id === orderId) : null;
        if (fresh) {
          setSelectedOrder(fresh);
          setPendingStatusSelection((fresh.status || fresh.order_status || targetStatus).toLowerCase());
        } else {
          setSelectedOrder((prev) => ({ ...prev, status: targetStatus, order_status: targetStatus }));
          setPendingStatusSelection(targetStatus);
        }
      }
    } catch (err) {
      showToast(err.message || "Failed to update order status", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id) => {
    setActionLoading(true);
    try {
      await deleteAdminProduct(id);
      showToast("Product deleted successfully");
      setDeleteConfirm(null);
      await loadAdminData();
    } catch (err) {
      showToast(err.message || "Failed to delete product", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Category
  const handleDeleteCategory = async (id) => {
    setActionLoading(true);
    try {
      await deleteAdminCategory(id);
      showToast("Category deleted successfully");
      setDeleteConfirm(null);
      await loadAdminData();
    } catch (err) {
      showToast(err.message || "Failed to delete category", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Order (Pending only)
  const handleDeleteOrder = async (id) => {
    setActionLoading(true);
    try {
      await deleteAdminOrder(id);
      showToast("Order deleted successfully");
      setDeleteConfirm(null);
      if (selectedOrder && selectedOrder.id === id) {
        setSelectedOrder(null);
      }
      await loadAdminData();
    } catch (err) {
      showToast(err.message || "Failed to delete order", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // AUTH GUARD: Not logged in or checking auth
  // ─────────────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-400 font-medium tracking-wide">Connecting to ShopEase Admin Panel...</p>
        </div>
      </div>
    );
  }

  // AUTH GUARD: User is logged in but is NOT an administrator
  if (currentUser && !currentUser.is_admin) {
    return (
      <div className="min-h-screen bg-[#090d14] flex flex-col justify-center items-center px-4 font-sans text-zinc-100">
        <div className="w-full max-w-md bg-[#131b26] border border-rose-500/30 rounded-2xl p-8 shadow-2xl backdrop-blur-xl text-center">
          <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-500/10">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m0 0v2m0-2h2m-2 0H10m4-11a4 4 0 00-8 0v4h8V6zM6 10h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2z" />
            </svg>
          </div>

          <h1 className="text-xl font-bold tracking-tight text-white mb-2">
            Access Denied
          </h1>
          <p className="text-xs uppercase font-bold tracking-wider text-rose-400 mb-4">
            Administrator Privileges Required
          </p>

          <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
            You are currently signed in as <span className="font-semibold text-zinc-200">{currentUser.username}</span> (<span className="text-zinc-300">{currentUser.email}</span>), but this account is not authorized to access the ShopEase Admin Panel.
          </p>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Return to Store</span>
            </button>

            <button
              type="button"
              onClick={handleAdminLogout}
              className="w-full py-2.5 px-4 rounded-xl bg-[#1c2636] hover:bg-[#253247] text-zinc-300 hover:text-white font-medium text-xs border border-[#2a384f] transition-all cursor-pointer"
            >
              Sign Out & Switch Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#090d14] flex flex-col justify-center items-center px-4 font-sans text-zinc-100">
        <div className="w-full max-w-md bg-[#131b26] border border-[#1f293d] rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-black font-extrabold text-lg shadow-lg shadow-emerald-500/20">
              S
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                ShopEase Admin Panel
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Staff
                </span>
              </h1>
              <p className="text-xs text-zinc-400">Sign in to ShopEase store management</p>
            </div>
          </div>

          {loginError && (
            <div className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                Admin Email or Username
              </label>
              <input
                type="text"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full px-3.5 py-2.5 bg-[#0b0f17] border border-[#222f46] rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                Password
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full px-3.5 py-2.5 bg-[#0b0f17] border border-[#222f46] rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full mt-2 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm rounded-lg shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoggingIn ? (
                <>
                  <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Verifying Authorization...</span>
                </>
              ) : (
                <span>Log in to Store Admin</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-[#1f293d] flex items-center justify-between text-xs text-zinc-400">
            <Link to="/" className="hover:text-emerald-400 transition-colors flex items-center gap-1.5">
              ← Return to Storefront
            </Link>
            <span>v1.0 • E-Commerce</span>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN SHOPEASE ADMIN LAYOUT
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0b0f17] text-zinc-100 flex flex-col md:flex-row font-sans selection:bg-emerald-500/30">
      {/* ── TOAST ALERT ── */}
      {toast && (
        <div
          className={`fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-sm font-medium transition-all duration-300 animate-slide-up ${
            toast.type === "error"
              ? "bg-rose-950/90 border-rose-500/30 text-rose-200 shadow-rose-950/40"
              : "bg-emerald-950/90 border-emerald-500/30 text-emerald-200 shadow-emerald-950/40"
          }`}
        >
          {toast.type === "error" ? (
            <svg className="w-5 h-5 text-rose-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── SHOPEASE SIDEBAR ── */}
      <aside className="w-full md:w-64 bg-[#111723] border-r border-[#1e2738] flex flex-col flex-shrink-0">
        {/* Brand / Store Switcher */}
        <div className="p-4 border-b border-[#1e2738] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center font-black text-black text-sm shadow-md shadow-emerald-500/20">
              S
            </div>
            <div>
              <div className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                ShopEase
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="text-[11px] text-zinc-400">ShopEase Admin Panel</div>
            </div>
          </div>
          <Link
            to="/"
            title="View Online Storefront"
            className="p-1.5 rounded-lg bg-[#182130] hover:bg-[#202b3e] text-zinc-300 hover:text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1 flex-1">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "dashboard"
                ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                : "text-zinc-300 hover:bg-[#182232] hover:text-white"
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("orders")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "orders"
                ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                : "text-zinc-300 hover:bg-[#182232] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>Orders</span>
            </div>
            {metrics.pendingOrders > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                {metrics.pendingOrders}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("products")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "products"
                ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                : "text-zinc-300 hover:bg-[#182232] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span>Products</span>
            </div>
            <span className="text-xs text-zinc-500">{products.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("categories")}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
              activeTab === "categories"
                ? "bg-emerald-500/10 text-emerald-400 font-semibold"
                : "text-zinc-300 hover:bg-[#182232] hover:text-white"
            }`}
          >
            <div className="flex items-center gap-3">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              <span>Collections</span>
            </div>
            <span className="text-xs text-zinc-500">{categories.length}</span>
          </button>
        </nav>

        {/* User Footer Profile */}
        <div className="p-3 border-t border-[#1e2738] bg-[#0d131d]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-black font-bold text-xs flex items-center justify-center flex-shrink-0">
                {(currentUser.username || "A").substring(0, 2).toUpperCase()}
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate">{currentUser.username}</div>
                <div className="text-[11px] text-zinc-400 truncate">{currentUser.email}</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleAdminLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── MAIN WORKSPACE CANVAS ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Command Bar */}
        <header className="h-14 border-b border-[#1e2738] bg-[#101622] px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 flex-1 max-w-md">
            <div className="relative w-full">
              <svg
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${activeTab}...`}
                className="w-full pl-9 pr-3 py-1.5 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === "products" && (
              <button
                type="button"
                onClick={() => setIsAddProductOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add Product</span>
              </button>
            )}

            {activeTab === "categories" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkCategoryOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#192333] hover:bg-[#202c40] text-zinc-300 hover:text-white text-xs font-medium transition-colors cursor-pointer border border-[#26354d]"
                >
                  Bulk Add
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm shadow-emerald-500/20"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>New Category</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={loadAdminData}
              title="Refresh Data"
              className="p-1.5 rounded-lg bg-[#182130] hover:bg-[#202b3e] text-zinc-300 hover:text-white transition-colors cursor-pointer"
            >
              <svg className={`w-4 h-4 ${isLoading ? "animate-spin text-emerald-400" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        </header>

        {/* Content View Container */}
        <main className="p-6 flex-1 max-w-7xl w-full mx-auto space-y-6">
          {/* ─────────────────────────────────────────────────────────────
              TAB: DASHBOARD OVERVIEW
          ───────────────────────────────────────────────────────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-6 animate-fade-in">
              {/* Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-[#141d2b] to-[#101824] p-6 rounded-2xl border border-[#202c3f]">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Store Performance Overview</h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    Manage your live catalog, incoming orders, and fulfillment pipelines.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer shadow-md shadow-emerald-500/20"
                  >
                    View All Orders ({metrics.totalOrders})
                  </button>
                </div>
              </div>

              {/* Metric Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#121926] border border-[#1e283b] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Total Sales</div>
                  <div className="text-2xl font-extrabold text-white mt-2">
                    PKR {metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                    <span>From {metrics.totalOrders} total orders</span>
                  </div>
                </div>

                <div className="bg-[#121926] border border-[#1e283b] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Active Catalog</div>
                  <div className="text-2xl font-extrabold text-white mt-2">{metrics.totalProducts}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">Across {flatCategories.length} categories</div>
                </div>

                <div className="bg-[#121926] border border-[#1e283b] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pending Orders</div>
                  <div className="text-2xl font-extrabold text-amber-400 mt-2">{metrics.pendingOrders}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">Requires confirmation / fulfillment</div>
                </div>

                <div className="bg-[#121926] border border-[#1e283b] rounded-xl p-4 shadow-sm">
                  <div className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Stock Alerts</div>
                  <div className="text-2xl font-extrabold text-rose-400 mt-2">{metrics.lowStockProducts + metrics.outOfStockProducts}</div>
                  <div className="text-[11px] text-zinc-400 mt-1">
                    {metrics.outOfStockProducts} out of stock, {metrics.lowStockProducts} low
                  </div>
                </div>
              </div>

              {/* Status Breakdown & Recent Orders Table */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Orders Pipeline Card */}
                <div className="bg-[#121926] border border-[#1e283b] rounded-xl p-5 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fulfillment Status</h3>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Pending
                      </span>
                      <span className="font-semibold text-white">{metrics.pendingOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-400" /> Confirmed
                      </span>
                      <span className="font-semibold text-white">{metrics.confirmedOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Shipped
                      </span>
                      <span className="font-semibold text-white">{metrics.shippedOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Delivered
                      </span>
                      <span className="font-semibold text-white">{metrics.deliveredOrders}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-zinc-300">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> Cancelled
                      </span>
                      <span className="font-semibold text-white">{metrics.cancelledOrders}</span>
                    </div>
                  </div>
                </div>

                {/* Recent Orders List */}
                <div className="lg:col-span-2 bg-[#121926] border border-[#1e283b] rounded-xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Recent Orders</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab("orders")}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium cursor-pointer"
                    >
                      View all orders →
                    </button>
                  </div>

                  {orders.length === 0 ? (
                    <div className="text-center py-8 text-xs text-zinc-500">No orders placed yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-[#1e283b] text-zinc-400 font-medium">
                            <th className="py-2">Order</th>
                            <th className="py-2">Payment</th>
                            <th className="py-2">Status</th>
                            <th className="py-2">Items</th>
                            <th className="py-2 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e283b]/60">
                          {orders.slice(0, 5).map((order) => {
                            const status = (order.status || order.order_status || "pending").toLowerCase();
                            const pMethod = (order.payment?.payment_method || order.payment_method || "COD").toUpperCase();
                            const pStatus = (order.payment?.payment_status || order.payment_status || "pending").toLowerCase();
                            return (
                              <tr
                                key={order.id}
                                onClick={() => setSelectedOrder(order)}
                                className="hover:bg-[#182234] transition-colors cursor-pointer"
                              >
                                <td className="py-2.5 font-semibold text-emerald-400">#{order.order_number || order.id}</td>
                                <td className="py-2.5">
                                  <span className="text-[11px] font-medium text-zinc-300 mr-1.5">{pMethod}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                                      pStatus === "paid"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : pStatus === "failed" || pStatus === "cancelled"
                                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                        : pStatus === "refunded"
                                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    {pStatus}
                                  </span>
                                </td>
                                <td className="py-2.5">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                      status === "delivered"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : status === "shipped"
                                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                        : status === "confirmed"
                                        ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                        : status === "cancelled"
                                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    {status}
                                  </span>
                                </td>
                                <td className="py-2.5 text-zinc-400">{order.order_items?.length || 1} items</td>
                                <td className="py-2.5 text-right font-medium text-white">
                                  PKR {parseFloat(order.total_amount || 0).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB: ORDERS MANAGEMENT
          ───────────────────────────────────────────────────────────── */}
          {activeTab === "orders" && (
            <div className="space-y-4 animate-fade-in">
              {/* Order Filters Bar */}
              <div className="bg-[#121926] border border-[#1e283b] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {["all", "pending", "confirmed", "shipped", "delivered", "cancelled"].map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setOrderStatusFilter(st)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all cursor-pointer ${
                        orderStatusFilter === st
                          ? "bg-emerald-500 text-black shadow-sm shadow-emerald-500/30"
                          : "bg-[#182130] text-zinc-400 hover:text-white"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>

                <div className="text-xs text-zinc-400 font-medium">
                  Showing {filteredOrders.length} of {orders.length} orders
                </div>
              </div>

              {/* Orders Table */}
              <div className="bg-[#121926] border border-[#1e283b] rounded-xl overflow-hidden shadow-sm">
                {filteredOrders.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-sm">No orders matching your criteria.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0e141f] text-zinc-400 font-semibold uppercase tracking-wider border-b border-[#1e283b]">
                        <tr>
                          <th className="py-3 px-4">Order ID</th>
                          <th className="py-3 px-4">Customer</th>
                          <th className="py-3 px-4">Payment</th>
                          <th className="py-3 px-4">Fulfillment Status</th>
                          <th className="py-3 px-4">Items Count</th>
                          <th className="py-3 px-4 text-right">Total Price</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e283b]/60">
                        {filteredOrders.map((ord) => {
                          const status = (ord.status || ord.order_status || "pending").toLowerCase();
                          const pMethod = (ord.payment?.payment_method || ord.payment_method || "COD").toUpperCase();
                          const pStatus = (ord.payment?.payment_status || ord.payment_status || "pending").toLowerCase();
                          const customerName = ord.user?.username || (ord.user_id ? `User #${ord.user_id}` : "Guest");
                          const customerEmail = ord.user?.email;
                          return (
                            <tr key={ord.id} className="hover:bg-[#162030] transition-colors">
                              <td className="py-3 px-4 font-bold text-emerald-400">#{ord.order_number || ord.id}</td>
                              <td className="py-3 px-4">
                                <div className="font-semibold text-white">{customerName}</div>
                                {customerEmail && (
                                  <div className="text-[11px] text-zinc-400 truncate max-w-[150px]" title={customerEmail}>
                                    {customerEmail}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-zinc-200">{pMethod}</span>
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                                      pStatus === "paid"
                                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                        : pStatus === "failed" || pStatus === "cancelled"
                                        ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                        : pStatus === "refunded"
                                        ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                        : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                    }`}
                                  >
                                    {pStatus}
                                  </span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span
                                  className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                                    status === "delivered"
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : status === "shipped"
                                      ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                                      : status === "confirmed"
                                      ? "bg-blue-500/15 text-blue-400 border border-blue-500/30"
                                      : status === "cancelled"
                                      ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                      : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  }`}
                                >
                                  {status}
                                </span>
                              </td>
                              <td className="py-3 px-4 text-zinc-300">{ord.order_items?.length || 1} item(s)</td>
                              <td className="py-3 px-4 text-right font-bold text-white">
                                PKR {parseFloat(ord.total_amount || 0).toLocaleString()}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedOrder(ord)}
                                    className="px-2.5 py-1 bg-[#202d42] hover:bg-emerald-500 hover:text-black text-zinc-200 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                                  >
                                    Manage Order
                                  </button>
                                  {["pending", "cancelled"].includes(status) && (
                                    <button
                                      type="button"
                                      title="Delete Order"
                                      onClick={() =>
                                        setDeleteConfirm({
                                          type: "order",
                                          id: ord.id,
                                          title: `Order #${ord.order_number || ord.id}`,
                                        })
                                      }
                                      className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/30 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB: PRODUCTS MANAGEMENT
          ───────────────────────────────────────────────────────────── */}
          {activeTab === "products" && (
            <div className="space-y-4 animate-fade-in">
              {/* Filter controls */}
              <div className="bg-[#121926] border border-[#1e283b] p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <select
                    value={productCategoryFilter}
                    onChange={(e) => setProductCategoryFilter(e.target.value)}
                    className="bg-[#0b0f17] border border-[#202b3d] text-xs text-zinc-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Categories</option>
                    {flatCategories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={productStockFilter}
                    onChange={(e) => setProductStockFilter(e.target.value)}
                    className="bg-[#0b0f17] border border-[#202b3d] text-xs text-zinc-300 px-3 py-1.5 rounded-lg focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Inventory Levels</option>
                    <option value="in_stock">In Stock (&gt; 5)</option>
                    <option value="low_stock">Low Stock (1-5)</option>
                    <option value="out_of_stock">Out of Stock (0)</option>
                  </select>
                </div>

                <div className="text-xs text-zinc-400">
                  Total {filteredProducts.length} product(s) found
                </div>
              </div>

              {/* Products Table */}
              <div className="bg-[#121926] border border-[#1e283b] rounded-xl overflow-hidden shadow-sm">
                {filteredProducts.length === 0 ? (
                  <div className="py-16 text-center text-zinc-500 text-sm">
                    No products found. Click &quot;Add Product&quot; to create one.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#0e141f] text-zinc-400 font-semibold uppercase tracking-wider border-b border-[#1e283b]">
                        <tr>
                          <th className="py-3 px-4">Product</th>
                          <th className="py-3 px-4">Type</th>
                          <th className="py-3 px-4">Price</th>
                          <th className="py-3 px-4">Inventory</th>
                          <th className="py-3 px-4 text-center">Images</th>
                          <th className="py-3 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1e283b]/60">
                        {filteredProducts.map((prod) => {
                          const stock = prod.stock_quantity ?? 0;
                          return (
                            <tr key={prod.id} className="hover:bg-[#162030] transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-[#0b0f17] border border-[#202b3d] overflow-hidden flex-shrink-0 flex items-center justify-center">
                                    {prod.primary_image ? (
                                      <img
                                        src={getImageUrl(prod.primary_image)}
                                        alt={prod.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      <svg className="w-5 h-5 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    )}
                                  </div>
                                  <div>
                                    <div className="font-semibold text-white hover:text-emerald-400 transition-colors">
                                      {prod.name}
                                    </div>
                                    <div className="text-[11px] text-zinc-400">ID: #{prod.id}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3 px-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#1e2738] text-zinc-300 uppercase">
                                  {prod.inventory_type || (prod.variants?.length ? "Varient" : "Simple")}
                                </span>
                              </td>

                              <td className="py-3 px-4 font-bold text-white">
                                PKR {parseFloat(prod.price || 0).toLocaleString()}
                              </td>

                              <td className="py-3 px-4">
                                {stock <= 0 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                    Out of Stock
                                  </span>
                                ) : stock <= 5 ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    Low Stock ({stock})
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                    {stock} in stock
                                  </span>
                                )}
                              </td>

                              <td className="py-3 px-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => setManagingImagesProduct(prod)}
                                  className="px-2 py-1 bg-[#1a2333] hover:bg-[#253248] text-emerald-400 rounded text-xs transition-colors cursor-pointer border border-[#28364e]"
                                >
                                  Manage Images
                                </button>
                              </td>

                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingProduct(prod)}
                                    className="p-1.5 rounded-lg bg-[#182232] hover:bg-[#243249] text-zinc-300 hover:text-white transition-colors cursor-pointer"
                                    title="Edit Product"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        type: "product",
                                        id: prod.id,
                                        title: prod.name,
                                      })
                                    }
                                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors cursor-pointer"
                                    title="Delete Product"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              TAB: CATEGORIES / COLLECTIONS
          ───────────────────────────────────────────────────────────── */}
          {activeTab === "categories" && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-[#121926] border border-[#1e283b] rounded-xl p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Catalog Taxonomy</h3>
                    <p className="text-xs text-zinc-400">Organize and structure collections for customer navigation.</p>
                  </div>
                </div>

                {categories.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-sm">No categories defined yet.</div>
                ) : (
                  <div className="divide-y divide-[#1e283b]/60">
                    {categories.map((cat) => (
                      <div key={cat.id} className="py-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="font-bold text-sm text-emerald-400">#{cat.id}</span>
                            <span className="font-semibold text-white">{cat.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-[#1e2738] text-zinc-400">
                              {cat.children?.length || 0} subcategories
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingCategory(cat)}
                              className="px-2.5 py-1 bg-[#182232] hover:bg-[#223046] text-zinc-300 hover:text-white rounded text-xs transition-colors cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "category",
                                  id: cat.id,
                                  title: cat.name,
                                })
                              }
                              className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded text-xs transition-colors cursor-pointer"
                            >
                              Delete
                            </button>
                          </div>
                        </div>

                        {/* Child subcategories */}
                        {cat.children && cat.children.length > 0 && (
                          <div className="ml-8 mt-2 pl-4 border-l-2 border-[#1e283b] space-y-1.5">
                            {cat.children.map((sub) => (
                              <div key={sub.id} className="flex items-center justify-between py-1 text-xs">
                                <div className="flex items-center gap-2 text-zinc-300">
                                  <span className="text-zinc-500">└</span>
                                  <span className="text-zinc-400 font-mono">#{sub.id}</span>
                                  <span>{sub.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => setEditingCategory(sub)}
                                    className="text-zinc-400 hover:text-white text-xs cursor-pointer"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setDeleteConfirm({
                                        type: "category",
                                        id: sub.id,
                                        title: sub.name,
                                      })
                                    }
                                    className="text-rose-400/80 hover:text-rose-400 text-xs cursor-pointer"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ORDER DETAILS & STATUS UPDATE
      ───────────────────────────────────────────────────────────── */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#202d42] flex items-center justify-between bg-[#162030]">
              <div className="flex items-center gap-3">
                <h3 className="text-base font-bold text-white">Order Details</h3>
                <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                  #{selectedOrder.order_number || selectedOrder.id}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Customer & Payment Information Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Customer Details */}
                <div className="bg-[#0b0f17] border border-[#202b3d] p-4 rounded-xl space-y-2 text-xs">
                  <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Customer Details</span>
                    <span className="text-zinc-500 text-[10px] font-mono">
                      #{selectedOrder.user?.id || selectedOrder.user_id || "N/A"}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="text-sm font-bold text-white truncate">
                      {selectedOrder.user?.username || (selectedOrder.user_id ? `User #${selectedOrder.user_id}` : "Guest Customer")}
                    </div>
                    <div className="text-xs text-zinc-400 truncate flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="truncate">{selectedOrder.user?.email || "No email available"}</span>
                    </div>
                  </div>
                </div>

                {/* Payment Details */}
                <div className="bg-[#0b0f17] border border-[#202b3d] p-4 rounded-xl space-y-2 text-xs">
                  <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider flex items-center justify-between">
                    <span>Payment Method</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        (selectedOrder.payment?.payment_status || selectedOrder.payment_status || "pending") === "paid"
                          ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                          : ["failed", "cancelled"].includes((selectedOrder.payment?.payment_status || selectedOrder.payment_status || "pending").toLowerCase())
                          ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          : (selectedOrder.payment?.payment_status || selectedOrder.payment_status || "pending") === "refunded"
                          ? "bg-purple-500/15 text-purple-400 border border-purple-500/30"
                          : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {selectedOrder.payment?.payment_status || selectedOrder.payment_status || "pending"}
                    </span>
                  </div>
                  <div className="space-y-1 pt-1">
                    <div className="text-sm font-bold text-white">
                      {(selectedOrder.payment?.payment_method || selectedOrder.payment_method || "COD").toUpperCase()}
                    </div>
                    <div className="text-xs text-zinc-400">
                      Total: PKR {parseFloat(selectedOrder.total_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Shipment Details */}
              <div className="bg-[#0b0f17] border border-[#202b3d] p-4 rounded-xl space-y-3 text-xs">
                <div className="text-[11px] text-zinc-400 uppercase font-bold tracking-wider flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-zinc-300">
                    <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Shipment & Delivery Details
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {selectedOrder.shipping_address?.shipping_method || "Standard Delivery"}
                    </span>
                  </div>
                </div>

                {selectedOrder.shipping_address ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-500 uppercase font-semibold">Recipient & Contact</div>
                      <div className="text-sm font-bold text-white">
                        {selectedOrder.shipping_address.full_name}
                      </div>
                      <div className="text-xs text-zinc-400 flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        <span>{selectedOrder.shipping_address.phone_number}</span>
                      </div>
                      <div className="text-[11px] text-zinc-500 pt-1">
                        Delivery Method:{" "}
                        <span className="font-semibold text-zinc-300 capitalize">
                          {selectedOrder.shipping_address.shipping_method || "Standard"}
                        </span>
                        {selectedOrder.shipping_cost && (
                          <span> (PKR {parseFloat(selectedOrder.shipping_cost).toLocaleString()})</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-[11px] text-zinc-500 uppercase font-semibold">Shipping Address</div>
                      <div className="text-xs text-zinc-200 leading-relaxed bg-[#111723] p-2.5 rounded-lg border border-[#1d2738]">
                        <div className="font-medium text-white">
                          {selectedOrder.shipping_address.address_line_1}
                        </div>
                        {selectedOrder.shipping_address.address_line_2 && (
                          <div className="text-zinc-400">
                            {selectedOrder.shipping_address.address_line_2}
                          </div>
                        )}
                        <div className="text-zinc-400 text-[11px] mt-1 pt-1 border-t border-zinc-800">
                          {[
                            selectedOrder.shipping_address.city,
                            selectedOrder.shipping_address.state,
                            selectedOrder.shipping_address.postal_code,
                            selectedOrder.shipping_address.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-[#111723] border border-[#1d2738] text-zinc-400 text-xs flex items-center justify-between">
                    <span className="italic">Standard delivery address on file (no custom dispatch address recorded).</span>
                    <span className="font-semibold text-white">
                      Fee: PKR {parseFloat(selectedOrder.shipping_cost || 0).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Order Status Control */}
              <div className="bg-[#0b0f17] border border-[#202b3d] p-4 rounded-xl space-y-3">
                {(() => {
                  const currentStatus = (selectedOrder.status || selectedOrder.order_status || "pending").toLowerCase();
                  const allowedTransitions = ALLOWED_ORDER_TRANSITIONS[currentStatus] || [];
                  const isFinalStatus = allowedTransitions.length === 0;
                  const isChangingToAllowed =
                    pendingStatusSelection &&
                    pendingStatusSelection !== currentStatus &&
                    allowedTransitions.includes(pendingStatusSelection);

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                          Update Fulfillment Status
                        </div>
                        {isChangingToAllowed && (
                          <span className="text-[11px] text-amber-400 font-medium">
                            Status selected (click Update to save)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {["pending", "confirmed", "shipped", "delivered", "cancelled"].map((st) => {
                          const isCurrent = currentStatus === st;
                          const isAllowed = allowedTransitions.includes(st);
                          const isSelected = pendingStatusSelection === st;
                          const isDisabled = !isCurrent && !isAllowed;

                          return (
                            <button
                              key={st}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => {
                                if (isAllowed || isCurrent) {
                                  setPendingStatusSelection(st);
                                }
                              }}
                              title={
                                isCurrent
                                  ? `Current status: ${st}`
                                  : isAllowed
                                  ? `Click to select ${st}`
                                  : `Cannot transition from ${currentStatus} to ${st}`
                              }
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all flex items-center gap-1.5 ${
                                isSelected && !isCurrent
                                  ? "bg-emerald-500 text-black ring-2 ring-emerald-400 shadow-md shadow-emerald-500/20 cursor-pointer"
                                  : isCurrent
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm"
                                  : isAllowed
                                  ? "bg-[#182232] text-zinc-200 hover:bg-[#202c40] hover:text-white border border-[#24334a] cursor-pointer"
                                  : "bg-[#0d131d]/60 text-zinc-600 border border-zinc-800/40 cursor-not-allowed opacity-35 select-none"
                              }`}
                            >
                              {isCurrent && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              )}
                              <span>{st}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Final state message when no transitions allowed */}
                      {isFinalStatus && (
                        <div className="flex items-center gap-2 text-xs text-zinc-400 bg-[#0d131d] border border-[#1e2738] px-3 py-2 rounded-lg mt-1">
                          <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>
                            This order is <span className="font-bold text-zinc-200 uppercase">{currentStatus}</span> (final state). No further transitions are permitted.
                          </span>
                        </div>
                      )}

                      {/* Explicit Update Status Action: Only rendered when valid transition is selected */}
                      {isChangingToAllowed && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#1e283b] mt-2 animate-fade-in">
                          <div className="text-xs text-zinc-300">
                            Pending change:{" "}
                            <span className="font-bold text-zinc-400 uppercase px-1.5 py-0.5 rounded bg-zinc-800">
                              {currentStatus}
                            </span>{" "}
                            →{" "}
                            <span className="font-bold text-emerald-400 uppercase px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                              {pendingStatusSelection}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => setPendingStatusSelection(currentStatus)}
                              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={actionLoading}
                              onClick={() => handleUpdateOrderStatus(selectedOrder.id, pendingStatusSelection)}
                              className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-bold rounded-lg shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
                            >
                              {actionLoading ? (
                                <>
                                  <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                  <span>Updating...</span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                                  </svg>
                                  <span>Update Status</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Order Items */}
              <div className="space-y-3">
                <div className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                  Line Items ({selectedOrder.order_items?.length || 0})
                </div>
                <div className="divide-y divide-[#202d42] border border-[#202d42] rounded-xl overflow-hidden bg-[#0c121c]">
                  {(selectedOrder.order_items || []).map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-white">{item.product?.name || `Product #${item.product_id || item.id}`}</div>
                        <div className="text-[11px] text-zinc-400">Qty: {item.quantity} × PKR {parseFloat(item.unit_price || 0).toLocaleString()}</div>
                      </div>
                      <div className="font-bold text-emerald-400">
                        PKR {(parseFloat(item.unit_price || 0) * (item.quantity || 1)).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>


              {/* Financial Breakdown */}
              <div className="bg-[#0b0f17] border border-[#202b3d] p-4 rounded-xl space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Subtotal</span>
                  <span>PKR {parseFloat(selectedOrder.subtotal || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Shipping Cost</span>
                  <span>PKR {parseFloat(selectedOrder.shipping_cost || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-white font-bold text-sm pt-2 border-t border-[#202b3d]">
                  <span>Total Paid / Payable</span>
                  <span className="text-emerald-400">PKR {parseFloat(selectedOrder.total_amount || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#202d42] bg-[#162030] flex items-center justify-between">
              {["pending", "cancelled"].includes((selectedOrder.status || selectedOrder.order_status || "").toLowerCase()) ? (
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() =>
                    setDeleteConfirm({
                      type: "order",
                      id: selectedOrder.id,
                      title: `Order #${selectedOrder.order_number || selectedOrder.id}`,
                    })
                  }
                  className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500 hover:text-white text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  Delete Order
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD PRODUCT (Simple & Variant)
      ───────────────────────────────────────────────────────────── */}
      {isAddProductOpen && (
        <AddProductModal
          flatCategories={flatCategories}
          onClose={() => setIsAddProductOpen(false)}
          onSuccess={() => {
            setIsAddProductOpen(false);
            showToast("Product created successfully!");
            loadAdminData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT PRODUCT
      ───────────────────────────────────────────────────────────── */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          flatCategories={flatCategories}
          onClose={() => setEditingProduct(null)}
          onSuccess={() => {
            setEditingProduct(null);
            showToast("Product updated successfully!");
            loadAdminData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: MANAGE PRODUCT IMAGES
      ───────────────────────────────────────────────────────────── */}
      {managingImagesProduct && (
        <ManageImagesModal
          product={managingImagesProduct}
          onClose={() => setManagingImagesProduct(null)}
          onSuccess={() => {
            showToast("Images updated!");
            loadAdminData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: ADD CATEGORY
      ───────────────────────────────────────────────────────────── */}
      {isAddCategoryOpen && (
        <AddCategoryModal
          flatCategories={flatCategories}
          onClose={() => setIsAddCategoryOpen(false)}
          onSuccess={() => {
            setIsAddCategoryOpen(false);
            showToast("Category created!");
            loadAdminData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: BULK ADD CATEGORIES
      ───────────────────────────────────────────────────────────── */}
      {isBulkCategoryOpen && (
        <BulkCategoryModal
          flatCategories={flatCategories}
          onClose={() => setIsBulkCategoryOpen(false)}
          onSuccess={() => {
            setIsBulkCategoryOpen(false);
            showToast("Bulk categories created!");
            loadAdminData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: EDIT CATEGORY
      ───────────────────────────────────────────────────────────── */}
      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          flatCategories={flatCategories}
          onClose={() => setEditingCategory(null)}
          onSuccess={() => {
            setEditingCategory(null);
            showToast("Category updated!");
            loadAdminData();
          }}
        />
      )}

      {/* ─────────────────────────────────────────────────────────────
          MODAL: DELETE CONFIRMATION
      ───────────────────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#121926] border border-rose-500/30 rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl animate-scale-up text-center">
            <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 mx-auto flex items-center justify-center">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h4 className="text-base font-bold text-white">
                Delete {deleteConfirm.type === "product" ? "Product" : deleteConfirm.type === "order" ? "Order" : "Category"}?
              </h4>
              <p className="text-xs text-zinc-400 mt-1">
                Are you sure you want to permanently remove <span className="font-bold text-white">&quot;{deleteConfirm.title}&quot;</span>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => {
                  if (deleteConfirm.type === "product") {
                    handleDeleteProduct(deleteConfirm.id);
                  } else if (deleteConfirm.type === "order") {
                    handleDeleteOrder(deleteConfirm.id);
                  } else {
                    handleDeleteCategory(deleteConfirm.id);
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Confirm Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: ADD PRODUCT MODAL
// ─────────────────────────────────────────────────────────────
function AddProductModal({ flatCategories, onClose, onSuccess }) {
  const [inventoryType, setInventoryType] = useState("Simple"); // "Simple" | "Varient"
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState(flatCategories[0]?.id || "");
  const [stockQuantity, setStockQuantity] = useState(10);
  const [color, setColor] = useState("");
  const [size, setSize] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);

  // Variant rows
  const [variants, setVariants] = useState([
    { size: "M", color: "Black", quantity: 10 },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleAddVariantRow = () => {
    setVariants([...variants, { size: "L", color: "Black", quantity: 5 }]);
  };

  const handleRemoveVariantRow = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index, field, value) => {
    const next = [...variants];
    next[index][field] = field === "quantity" ? parseInt(value, 10) || 0 : value;
    setVariants(next);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        description,
        price: parseFloat(price),
        category_id: parseInt(categoryId, 10),
        inventory_type: inventoryType,
        is_featured: isFeatured,
        color: color || null,
        size: size || null,
      };

      if (inventoryType === "Simple") {
        payload.stock_quantity = parseInt(stockQuantity, 10) || 0;
      } else {
        if (!variants || variants.length === 0) {
          throw new Error("At least one variant row is required for variant products");
        }
        payload.variants = variants;
      }

      await createAdminProduct(payload);
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        <div className="p-4 border-b border-[#202d42] flex items-center justify-between bg-[#162030]">
          <h3 className="text-base font-bold text-white">Add New Product</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Inventory Type Toggle */}
          <div className="flex items-center gap-2 p-1 bg-[#0b0f17] border border-[#202b3d] rounded-lg">
            <button
              type="button"
              onClick={() => setInventoryType("Simple")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                inventoryType === "Simple" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Simple Product
            </button>
            <button
              type="button"
              onClick={() => setInventoryType("Varient")}
              className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                inventoryType === "Varient" ? "bg-emerald-500 text-black" : "text-zinc-400 hover:text-white"
              }`}
            >
              Variant Product (Sizes/Colors)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Product Title *</label>
              <input
                type="text"
                required
                maxLength={50}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Classic Oversized Trench"
                className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Price (PKR) *</label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="4500.00"
                className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Category *</label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
              >
                {flatCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-300 mb-1">Description *</label>
              <textarea
                required
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Crafted with pure wool blend fabric..."
                className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
              />
            </div>

            {inventoryType === "Simple" ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Stock Quantity *</label>
                  <input
                    type="number"
                    required
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Default Color (Optional)</label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    placeholder="e.g. Khaki"
                    className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
                  />
                </div>
              </>
            ) : (
              <div className="sm:col-span-2 space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 uppercase">Product Variants</label>
                  <button
                    type="button"
                    onClick={handleAddVariantRow}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold cursor-pointer"
                  >
                    + Add Variant Row
                  </button>
                </div>

                <div className="space-y-2">
                  {variants.map((v, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-[#0b0f17] rounded-lg border border-[#202b3d]">
                      <input
                        type="text"
                        placeholder="Size (e.g. M)"
                        value={v.size}
                        onChange={(e) => handleVariantChange(idx, "size", e.target.value)}
                        className="w-24 px-2 py-1 bg-[#151e2b] rounded text-xs text-white"
                      />
                      <input
                        type="text"
                        placeholder="Color (e.g. Black)"
                        value={v.color}
                        onChange={(e) => handleVariantChange(idx, "color", e.target.value)}
                        className="flex-1 px-2 py-1 bg-[#151e2b] rounded text-xs text-white"
                      />
                      <input
                        type="number"
                        placeholder="Qty"
                        value={v.quantity}
                        onChange={(e) => handleVariantChange(idx, "quantity", e.target.value)}
                        className="w-20 px-2 py-1 bg-[#151e2b] rounded text-xs text-white"
                      />
                      {variants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveVariantRow(idx)}
                          className="text-rose-400 hover:text-rose-300 text-xs px-2 cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isFeatured"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-500 bg-[#0b0f17] border-[#202b3d]"
              />
              <label htmlFor="isFeatured" className="text-xs text-zinc-300 cursor-pointer">
                Mark as Featured Product on Storefront
              </label>
            </div>
          </div>

          <div className="pt-4 border-t border-[#202d42] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Save Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: EDIT PRODUCT MODAL
// ─────────────────────────────────────────────────────────────
function EditProductModal({ product, flatCategories, onClose, onSuccess }) {
  const [name, setName] = useState(product.name || "");
  const [description, setDescription] = useState(product.description || "");
  const [price, setPrice] = useState(product.price || "");
  const [categoryId, setCategoryId] = useState(product.category_id || flatCategories[0]?.id || "");
  const [stockQuantity, setStockQuantity] = useState(product.stock_quantity ?? 0);
  const [color, setColor] = useState(product.color || "");
  const [size, setSize] = useState(product.size || "");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const payload = {
        name,
        description,
        price: parseFloat(price),
        category_id: parseInt(categoryId, 10),
        stock_quantity: parseInt(stockQuantity, 10),
        color: color || null,
        size: size || null,
      };

      await updateAdminProduct(product.id, payload);
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-lg flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        <div className="p-4 border-b border-[#202d42] flex items-center justify-between bg-[#162030]">
          <h3 className="text-base font-bold text-white">Edit Product #{product.id}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Product Title</label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Price (PKR)</label>
              <input
                type="number"
                step="0.01"
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Stock Quantity</label>
              <input
                type="number"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            >
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Description</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            />
          </div>

          <div className="pt-4 border-t border-[#202d42] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Update Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: MANAGE PRODUCT IMAGES MODAL
// ─────────────────────────────────────────────────────────────
function ManageImagesModal({ product, onClose, onSuccess }) {
  const [detail, setDetail] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isPrimary, setIsPrimary] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  const loadProductDetail = useCallback(async () => {
    try {
      const data = await fetchProductDetails(product.id);
      setDetail(data);
    } catch (err) {
      console.warn("Could not load details for product:", err);
    }
  }, [product.id]);

  useEffect(() => {
    loadProductDetail();
  }, [loadProductDetail]);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (selectedFiles.length === 0) return;
    setError("");
    setIsUploading(true);

    try {
      await uploadAdminProductImages(product.id, selectedFiles, isPrimary);
      setSelectedFiles([]);
      await loadProductDetail();
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to upload images");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteImage = async (imageId) => {
    try {
      await deleteProductImage(imageId, product.id);
      await loadProductDetail();
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to delete image");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-scale-up">
        <div className="p-4 border-b border-[#202d42] flex items-center justify-between bg-[#162030]">
          <div>
            <h3 className="text-base font-bold text-white">Media Gallery</h3>
            <p className="text-xs text-zinc-400">{product.name} (#{product.id})</p>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Upload Form */}
          <form onSubmit={handleUpload} className="p-4 bg-[#0b0f17] border border-[#202b3d] rounded-xl space-y-3">
            <div className="text-xs font-bold text-zinc-300 uppercase">Upload Media Files</div>
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
              className="text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-emerald-500 file:text-black hover:file:bg-emerald-400 cursor-pointer"
            />
            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isPrimary}
                  onChange={(e) => setIsPrimary(e.target.checked)}
                  className="rounded text-emerald-500"
                />
                <span>Set as Primary Thumbnail</span>
              </label>

              <button
                type="submit"
                disabled={isUploading || selectedFiles.length === 0}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs rounded-lg transition-colors cursor-pointer disabled:opacity-40"
              >
                {isUploading ? "Uploading..." : "Upload Files"}
              </button>
            </div>
          </form>

          {/* Existing Images Grid */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-zinc-300 uppercase">
              Current Images ({detail?.images?.length || 0})
            </div>

            {(!detail?.images || detail.images.length === 0) ? (
              <div className="py-8 text-center text-xs text-zinc-500 border border-dashed border-[#202b3d] rounded-xl">
                No images uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {detail.images.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-xl overflow-hidden border border-[#202b3d] bg-[#0b0f17] aspect-square"
                  >
                    <img
                      src={getImageUrl(img.image_url)}
                      alt={`Product Media ${img.id}`}
                      className="w-full h-full object-cover"
                    />

                    {img.is_primary && (
                      <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[9px] font-black uppercase">
                        Primary
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteImage(img.id)}
                      className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/70 hover:bg-rose-600 text-white transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Delete Image"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#202d42] bg-[#162030] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: ADD CATEGORY MODAL
// ─────────────────────────────────────────────────────────────
function AddCategoryModal({ flatCategories, onClose, onSuccess }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await createAdminCategory({
        name,
        parent_id: parentId ? parseInt(parentId, 10) : null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-[#202d42]">
          <h3 className="text-base font-bold text-white">Create Category</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Category Name *</label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Outerwear"
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Parent Category (Optional)</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            >
              <option value="">None (Top-level Category)</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Save Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: BULK CATEGORY MODAL
// ─────────────────────────────────────────────────────────────
function BulkCategoryModal({ flatCategories, onClose, onSuccess }) {
  const [categoriesInput, setCategoriesInput] = useState("Men\nWomen\nAccessories\nFootwear");
  const [parentId, setParentId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const names = categoriesInput
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean);

      if (names.length === 0) {
        throw new Error("Please enter at least one category name");
      }

      const pId = parentId ? parseInt(parentId, 10) : null;
      const payload = names.map((name) => ({ name, parent_id: pId }));

      await createAdminCategoriesBulk(payload);
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create categories");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-[#202d42]">
          <h3 className="text-base font-bold text-white">Bulk Add Categories</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">
              Category Names (One per line)
            </label>
            <textarea
              required
              rows={5}
              value={categoriesInput}
              onChange={(e) => setCategoriesInput(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Parent Category for All</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            >
              <option value="">None (Top-level Categories)</option>
              {flatCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Creating..." : "Create All"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// SUB-COMPONENT: EDIT CATEGORY MODAL
// ─────────────────────────────────────────────────────────────
function EditCategoryModal({ category, flatCategories, onClose, onSuccess }) {
  const [name, setName] = useState(category.name || "");
  const [parentId, setParentId] = useState(category.parent_id || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      await updateAdminCategory(category.id, {
        name,
        parent_id: parentId ? parseInt(parentId, 10) : null,
      });
      onSuccess();
    } catch (err) {
      setError(err.message || "Failed to update category");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#121926] border border-[#202d42] rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl animate-scale-up">
        <div className="flex items-center justify-between pb-3 border-b border-[#202d42]">
          <h3 className="text-base font-bold text-white">Edit Category #{category.id}</h3>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Category Name</label>
            <input
              type="text"
              required
              maxLength={50}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Parent Category</label>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full px-3 py-2 bg-[#0b0f17] border border-[#202b3d] rounded-lg text-xs text-white"
            >
              <option value="">None (Top-level Category)</option>
              {flatCategories
                .filter((c) => c.id !== category.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-semibold rounded-lg text-xs cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
