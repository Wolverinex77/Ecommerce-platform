import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthModal from "../components/AuthModal";
import {
  fetchUserProfile,
  updateUserProfile,
  fetchShippingAddresses,
  createShippingAddress,
  updateShippingAddress,
  deleteShippingAddress,
  fetchUserOrders,
  fetchOrderDetails,
  getAuthToken,
  setAuthToken,
} from "../services/api";

const PROVINCES = [
  "Punjab",
  "Sindh",
  "KPK",
  "Balochistan",
  "Gilgit Baltistan",
  "AJK",
  "Islamabad",
];

export default function AccountPage() {
  const navigate = useNavigate();

  // Active Tab: 'profile' | 'addresses' | 'orders'
  const [activeTab, setActiveTab] = useState("profile");

  // Authentication & Global loading
  const [token, setToken] = useState(getAuthToken());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // ==================== PROFILE STATE ====================
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(null);
  const [profileSuccess, setProfileSuccess] = useState(null);

  // Profile Edit form fields
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // ==================== ADDRESSES STATE ====================
  const [addresses, setAddresses] = useState([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [addressError, setAddressError] = useState(null);
  const [addressSuccess, setAddressSuccess] = useState(null);

  // Address Modal (Add / Edit)
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [addressForm, setAddressForm] = useState({
    full_name: "",
    phone_number: "",
    country: "Pakistan",
    state: "Punjab",
    city: "",
    postal_code: "",
    address_line_1: "",
    address_line_2: "",
  });
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [deletingAddressId, setDeletingAddressId] = useState(null);

  // ==================== ORDERS STATE ====================
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState(null);

  // Order Details Modal
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);

  // ==================== DATA LOADERS ====================

  // Load Profile
  const loadProfile = useCallback(async () => {
    if (!getAuthToken()) return;
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await fetchUserProfile();
      setProfile(data);
      setEditName(data.username || "");
      setEditEmail(data.email || "");
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        setAuthToken(null);
        setToken("");
      } else {
        setProfileError(err.message || "Failed to load profile");
      }
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // Load Addresses
  const loadAddresses = useCallback(async () => {
    if (!getAuthToken()) return;
    setAddressesLoading(true);
    setAddressError(null);
    try {
      const data = await fetchShippingAddresses();
      setAddresses(data || []);
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        setAuthToken(null);
        setToken("");
      } else {
        setAddressError(err.message || "Failed to load shipping addresses");
      }
    } finally {
      setAddressesLoading(false);
    }
  }, []);

  // Load Orders
  const loadOrders = useCallback(async () => {
    if (!getAuthToken()) return;
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const data = await fetchUserOrders();
      setOrders(data || []);
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        setAuthToken(null);
        setToken("");
      } else {
        setOrdersError(err.message || "Failed to load orders");
      }
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  // Initial load & Tab switching
  useEffect(() => {
    const currentToken = getAuthToken();
    setToken(currentToken);

    if (currentToken) {
      if (activeTab === "profile") loadProfile();
      if (activeTab === "addresses") loadAddresses();
      if (activeTab === "orders") loadOrders();
    }
  }, [activeTab, loadProfile, loadAddresses, loadOrders]);

  // ==================== HANDLERS: PROFILE ====================

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setIsUpdatingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    try {
      const payload = {};
      if (editName.trim() && editName.trim() !== profile?.username) {
        payload.name = editName.trim();
      }
      if (editEmail.trim() && editEmail.trim() !== profile?.email) {
        payload.email = editEmail.trim();
      }
      if (editPassword.trim()) {
        payload.password = editPassword.trim();
      }

      if (Object.keys(payload).length === 0) {
        setProfileSuccess("No changes to update.");
        setIsUpdatingProfile(false);
        return;
      }

      const updated = await updateUserProfile(payload);
      setProfile(updated);
      setEditName(updated.username || "");
      setEditEmail(updated.email || "");
      setEditPassword("");
      setProfileSuccess("Profile updated successfully!");
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err) {
      setProfileError(err.message || "Failed to update profile");
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // ==================== HANDLERS: ADDRESSES ====================

  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm({
      full_name: "",
      phone_number: "",
      country: "Pakistan",
      state: "Punjab",
      city: "",
      postal_code: "",
      address_line_1: "",
      address_line_2: "",
    });
    setAddressError(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      full_name: addr.full_name || "",
      phone_number: addr.phone_number || "",
      country: addr.country || "Pakistan",
      state: addr.state || "Punjab",
      city: addr.city || "",
      postal_code: addr.postal_code || "",
      address_line_1: addr.address_line_1 || "",
      address_line_2: addr.address_line_2 || "",
    });
    setAddressError(null);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setIsSavingAddress(true);
    setAddressError(null);

    const payload = {
      full_name: addressForm.full_name.trim(),
      phone_number: addressForm.phone_number.trim(),
      country: addressForm.country.trim() || "Pakistan",
      state: addressForm.state,
      city: addressForm.city.trim(),
      postal_code: addressForm.postal_code.trim() || null,
      address_line_1: addressForm.address_line_1.trim(),
      address_line_2: addressForm.address_line_2.trim() || null,
    };

    try {
      if (editingAddressId) {
        await updateShippingAddress(editingAddressId, payload);
        setAddressSuccess("Address updated successfully!");
      } else {
        await createShippingAddress(payload);
        setAddressSuccess("Address added successfully!");
      }
      setIsAddressModalOpen(false);
      loadAddresses();
      setTimeout(() => setAddressSuccess(null), 4000);
    } catch (err) {
      setAddressError(err.message || "Failed to save shipping address");
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id) => {
    if (!window.confirm("Are you sure you want to delete this shipping address?")) return;
    setDeletingAddressId(id);
    try {
      await deleteShippingAddress(id);
      setAddressSuccess("Address deleted successfully.");
      loadAddresses();
      setTimeout(() => setAddressSuccess(null), 3000);
    } catch (err) {
      setAddressError(err.message || "Failed to delete address");
    } finally {
      setDeletingAddressId(null);
    }
  };

  // ==================== HANDLERS: ORDERS ====================

  const handleViewOrderDetails = async (orderId) => {
    setSelectedOrderId(orderId);
    setOrderDetails(null);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const data = await fetchOrderDetails(orderId);
      setOrderDetails(data);
    } catch (err) {
      setDetailsError(err.message || "Failed to load order details");
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      setAuthToken(null);
      setToken("");
      window.dispatchEvent(new CustomEvent("cart-updated"));
      navigate("/");
    }
  };

  // Format status badge styling
  const getStatusBadge = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "delivered") {
      return "bg-forest/10 text-forest border-forest/30";
    }
    if (s === "shipped") {
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
    if (s === "confirmed") {
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    }
    if (s === "cancelled") {
      return "bg-rust/10 text-rust border-rust/30";
    }
    return "bg-amber-500/10 text-amber-400 border-amber-500/30";
  };

  // ==================== UNAUTHENTICATED STATE ====================
  if (!token) {
    return (
      <main className="max-w-xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-8 sm:p-12 shadow-2xl space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-forest/10 border border-forest/20 flex items-center justify-center text-forest">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
              Sign In to Your Account
            </h1>
            <p className="text-ink-soft text-sm leading-relaxed max-w-md mx-auto">
              Please sign in to view your profile details, manage saved shipping addresses, and track your order history.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setIsAuthModalOpen(true)}
              className="bg-forest text-black hover:bg-forest-dark px-8 py-3 rounded-sm text-sm font-bold uppercase tracking-wider transition-all w-full sm:w-auto shadow-lg"
            >
              Sign In / Register
            </button>
            <Link
              to="/products"
              className="border border-hairline text-white hover:border-forest px-6 py-3 rounded-sm text-sm font-semibold transition-colors w-full sm:w-auto"
            >
              Continue Browsing
            </Link>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={() => {
            const freshToken = getAuthToken();
            setToken(freshToken);
            loadProfile();
          }}
        />
      </main>
    );
  }

  // ==================== AUTHENTICATED ACCOUNT DASHBOARD ====================
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Account Header */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-4 border-b border-hairline pb-6 mb-8">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white">
            My Account
          </h1>
          <p className="text-sm text-ink-soft mt-1">
            Manage your personal profile, delivery addresses, and track orders.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="text-xs font-semibold text-ink-soft hover:text-rust transition-colors uppercase tracking-wider self-start sm:self-auto flex items-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>

      {/* Main Grid: Sidebar Navigation (3 cols) + Content (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ==================== LEFT: TAB NAVIGATION ==================== */}
        <aside className="lg:col-span-3">
          <nav
            className="bg-surface border border-hairline rounded-md p-2 space-y-1"
            aria-label="Account navigation"
          >
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-semibold transition-all text-left ${
                activeTab === "profile"
                  ? "bg-forest text-black shadow-md font-bold"
                  : "text-white hover:bg-paper hover:text-forest"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>Profile &amp; Security</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("addresses")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-semibold transition-all text-left ${
                activeTab === "addresses"
                  ? "bg-forest text-black shadow-md font-bold"
                  : "text-white hover:bg-paper hover:text-forest"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Shipping Addresses</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("orders")}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-sm text-sm font-semibold transition-all text-left ${
                activeTab === "orders"
                  ? "bg-forest text-black shadow-md font-bold"
                  : "text-white hover:bg-paper hover:text-forest"
              }`}
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              <span>Order History</span>
            </button>
          </nav>
        </aside>

        {/* ==================== RIGHT: TAB CONTENT PANELS ==================== */}
        <div className="lg:col-span-9 space-y-6">
          {/* ============================================================ */}
          {/* TAB 1: PROFILE & SECURITY                                   */}
          {/* ============================================================ */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Profile Overview Card */}
              <div className="bg-surface border border-hairline rounded-md p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-hairline pb-4">
                  <div>
                    <h2 className="font-display text-xl font-bold text-white">
                      Profile Information
                    </h2>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Your registered account credentials.
                    </p>
                  </div>
                  {profile?.id && (
                    <span className="text-xs font-mono font-semibold text-forest bg-forest/10 border border-forest/20 px-2.5 py-1 rounded-sm">
                      User ID: #{profile.id}
                    </span>
                  )}
                </div>

                {profileLoading ? (
                  <div className="animate-pulse space-y-4">
                    <div className="h-10 bg-paper rounded border border-hairline"></div>
                    <div className="h-10 bg-paper rounded border border-hairline"></div>
                  </div>
                ) : (
                  <form onSubmit={handleUpdateProfile} className="space-y-5 max-w-xl">
                    {profileSuccess && (
                      <div className="p-3.5 bg-forest/10 border border-forest/30 rounded-sm text-forest text-xs font-medium flex items-center gap-2">
                        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {profileSuccess}
                      </div>
                    )}

                    {profileError && (
                      <div className="p-3.5 bg-rust/10 border border-rust/30 rounded-sm text-rust text-xs font-medium">
                        {profileError}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                        Username
                      </label>
                      <input
                        type="text"
                        required
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Your username"
                        className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                        Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1.5">
                        New Password (Optional)
                      </label>
                      <input
                        type="password"
                        value={editPassword}
                        onChange={(e) => setEditPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-forest"
                      />
                      <p className="text-[11px] text-ink-soft mt-1">
                        Must contain at least 8 characters with upper, lower, number, and special character.
                      </p>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isUpdatingProfile}
                        className="bg-forest text-black hover:bg-forest-dark px-6 py-2.5 rounded-sm text-sm font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                      >
                        {isUpdatingProfile ? "Updating..." : "Save Changes"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 2: SHIPPING ADDRESSES                                   */}
          {/* ============================================================ */}
          {activeTab === "addresses" && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-hairline pb-4">
                <div>
                  <h2 className="font-display text-xl font-bold text-white">
                    Saved Shipping Addresses
                  </h2>
                  <p className="text-xs text-ink-soft mt-0.5">
                    Addresses for order delivery and calculation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleOpenAddAddress}
                  className="bg-forest text-black hover:bg-forest-dark px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add Address
                </button>
              </div>

              {addressSuccess && (
                <div className="p-3.5 bg-forest/10 border border-forest/30 rounded-sm text-forest text-xs font-medium">
                  {addressSuccess}
                </div>
              )}

              {addressError && (
                <div className="p-3.5 bg-rust/10 border border-rust/30 rounded-sm text-rust text-xs font-medium">
                  {addressError}
                </div>
              )}

              {addressesLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-40 bg-surface rounded-md border border-hairline animate-pulse"></div>
                  ))}
                </div>
              ) : addresses.length === 0 ? (
                <div className="bg-surface border border-hairline rounded-lg p-10 text-center space-y-4">
                  <div className="w-14 h-14 mx-auto rounded-full bg-paper border border-hairline flex items-center justify-center text-ink-soft/40">
                    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-white mb-1">
                      No Shipping Addresses Saved
                    </h3>
                    <p className="text-xs text-ink-soft max-w-sm mx-auto">
                      Add a delivery address to make checkout fast and seamless.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenAddAddress}
                    className="inline-flex items-center gap-1.5 bg-forest text-black hover:bg-forest-dark px-5 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    Add Address Now
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {addresses.map((addr) => {
                    const isDeleting = deletingAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        className={`bg-surface border border-hairline rounded-md p-5 flex flex-col justify-between space-y-4 transition-all ${
                          isDeleting ? "opacity-40 pointer-events-none" : ""
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-display text-base font-bold text-white">
                              {addr.full_name}
                            </h3>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-forest bg-forest/10 border border-forest/20 px-2 py-0.5 rounded-sm">
                              {addr.state}
                            </span>
                          </div>

                          <p className="text-xs text-white leading-relaxed">
                            {addr.address_line_1}
                            {addr.address_line_2 && `, ${addr.address_line_2}`}
                          </p>
                          <p className="text-xs text-ink-soft">
                            {addr.city}, {addr.state} {addr.postal_code ? `(${addr.postal_code})` : ""} - {addr.country}
                          </p>
                          <p className="text-xs text-ink-soft">
                            Phone: <span className="text-white font-medium">{addr.phone_number}</span>
                          </p>
                        </div>

                        {/* Action buttons */}
                        <div className="pt-3 border-t border-hairline flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleOpenEditAddress(addr)}
                            className="text-xs font-semibold text-white hover:text-forest transition-colors"
                          >
                            Edit
                          </button>
                          <span className="text-hairline">|</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(addr.id)}
                            className="text-xs font-semibold text-ink-soft hover:text-rust transition-colors"
                          >
                            {isDeleting ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ============================================================ */}
          {/* TAB 3: ORDER HISTORY                                        */}
          {/* ============================================================ */}
          {activeTab === "orders" && (
            <div className="space-y-6">
              <div className="border-b border-hairline pb-4">
                <h2 className="font-display text-xl font-bold text-white">
                  Order History
                </h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  Track and review all previous purchases.
                </p>
              </div>

              {ordersError && (
                <div className="p-3.5 bg-rust/10 border border-rust/30 rounded-sm text-rust text-xs font-medium">
                  {ordersError}
                </div>
              )}

              {ordersLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-surface rounded-md border border-hairline animate-pulse"></div>
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <div className="bg-surface border border-hairline rounded-lg p-12 text-center space-y-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-paper border border-hairline flex items-center justify-center text-ink-soft/40">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-display text-xl font-bold text-white mb-1">
                      You haven't placed any orders yet.
                    </h3>
                    <p className="text-xs text-ink-soft max-w-sm mx-auto">
                      Explore our collections and discover timeless essentials for your everyday life.
                    </p>
                  </div>
                  <Link
                    to="/products"
                    className="inline-flex items-center gap-2 bg-forest text-black hover:bg-forest-dark px-6 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                  >
                    Start Shopping
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {orders.map((order) => {
                    const dateFormatted = order.created_at
                      ? new Date(order.created_at).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "Recently";

                    const totalFormatted = Number(order.total_amount || 0).toLocaleString("en-PK");

                    return (
                      <div
                        key={order.id}
                        className="bg-surface border border-hairline rounded-md p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-forest/40"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="font-display text-base font-bold text-white">
                              Order #{order.id}
                            </span>
                            <span
                              className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-sm border ${getStatusBadge(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>

                          <p className="text-xs text-ink-soft">
                            Placed on <span className="text-white">{dateFormatted}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-hairline">
                          <div className="text-left sm:text-right">
                            <p className="text-xs text-ink-soft">Total Amount</p>
                            <p className="text-base font-bold text-white">
                              Rs. {totalFormatted}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleViewOrderDetails(order.id)}
                            className="bg-paper border border-hairline hover:border-forest text-white hover:text-forest px-4 py-2 rounded-sm text-xs font-semibold transition-colors"
                          >
                            View Details &rarr;
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ============================================================ */}
      {/* MODAL: ADD / EDIT SHIPPING ADDRESS                           */}
      {/* ============================================================ */}
      {isAddressModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="address-modal-title"
        >
          <div className="relative w-full max-w-lg bg-surface border border-hairline rounded-lg p-6 sm:p-8 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute top-4 right-4 text-ink-soft hover:text-white p-1"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div>
              <h2 id="address-modal-title" className="font-display text-xl font-bold text-white">
                {editingAddressId ? "Edit Shipping Address" : "Add New Shipping Address"}
              </h2>
              <p className="text-xs text-ink-soft mt-0.5">
                Fill in the accurate delivery destination details.
              </p>
            </div>

            {addressError && (
              <div className="p-3 bg-rust/10 border border-rust/30 rounded-sm text-rust text-xs">
                {addressError}
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.full_name}
                    onChange={(e) => setAddressForm({ ...addressForm, full_name: e.target.value })}
                    placeholder="Recipient name"
                    className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.phone_number}
                    onChange={(e) => setAddressForm({ ...addressForm, phone_number: e.target.value })}
                    placeholder="+92 300 1234567"
                    className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                  Street Address (Line 1) *
                </label>
                <input
                  type="text"
                  required
                  value={addressForm.address_line_1}
                  onChange={(e) => setAddressForm({ ...addressForm, address_line_1: e.target.value })}
                  placeholder="House / Apartment #, Street, Area"
                  className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                  Address Line 2 (Optional)
                </label>
                <input
                  type="text"
                  value={addressForm.address_line_2}
                  onChange={(e) => setAddressForm({ ...addressForm, address_line_2: e.target.value })}
                  placeholder="Nearby landmark or building"
                  className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="e.g. Lahore, Karachi"
                    className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                    Province / State *
                  </label>
                  <select
                    value={addressForm.state}
                    onChange={(e) => setAddressForm({ ...addressForm, state: e.target.value })}
                    className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                  >
                    {PROVINCES.map((prov) => (
                      <option key={prov} value={prov}>
                        {prov}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                    Postal Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={addressForm.postal_code}
                    onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                    placeholder="e.g. 54000"
                    className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-ink mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    required
                    value={addressForm.country}
                    onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                    className="w-full bg-paper border border-hairline rounded-sm px-3.5 py-2 text-sm text-white focus:outline-none focus:border-forest"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-3 border-t border-hairline">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="px-4 py-2 border border-hairline rounded-sm text-xs font-semibold text-ink-soft hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="px-6 py-2 bg-forest text-black hover:bg-forest-dark rounded-sm text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {isSavingAddress ? "Saving..." : editingAddressId ? "Update Address" : "Save Address"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: ORDER DETAILS                                         */}
      {/* ============================================================ */}
      {selectedOrderId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-modal-title"
        >
          <div className="relative w-full max-w-2xl bg-surface border border-hairline rounded-lg p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setSelectedOrderId(null)}
              className="absolute top-4 right-4 text-ink-soft hover:text-white p-1"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="border-b border-hairline pb-4">
              <div className="flex items-center gap-3">
                <h2 id="order-modal-title" className="font-display text-2xl font-bold text-white">
                  Order #{selectedOrderId}
                </h2>
                {orderDetails?.status && (
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-sm border ${getStatusBadge(
                      orderDetails.status
                    )}`}
                  >
                    {orderDetails.status}
                  </span>
                )}
              </div>
              {orderDetails?.created_at && (
                <p className="text-xs text-ink-soft mt-1">
                  Placed on {new Date(orderDetails.created_at).toLocaleString()}
                </p>
              )}
            </div>

            {detailsLoading ? (
              <div className="py-12 text-center text-ink-soft">
                Loading order details...
              </div>
            ) : detailsError ? (
              <div className="p-4 bg-rust/10 border border-rust/30 rounded-sm text-rust text-xs">
                {detailsError}
              </div>
            ) : orderDetails ? (
              <div className="space-y-6">
                {/* Itemized list */}
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-forest mb-3">
                    Items in this Order
                  </h3>

                  <div className="space-y-3">
                    {orderDetails.order_items && orderDetails.order_items.length > 0 ? (
                      orderDetails.order_items.map((item) => {
                        const unitPrice = Number(item.unit_price || 0);
                        const itemSubtotal = unitPrice * item.quantity;
                        const productName = item.product?.name || `Product #${item.product?.id || item.id}`;

                        return (
                          <div
                            key={item.id}
                            className="bg-paper border border-hairline rounded-sm p-3.5 flex items-center justify-between gap-4"
                          >
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {productName}
                              </p>
                              <p className="text-xs text-ink-soft mt-0.5">
                                Qty: <span className="text-white font-medium">{item.quantity}</span> &times; Rs. {unitPrice.toLocaleString("en-PK")}
                              </p>
                            </div>

                            <p className="text-sm font-bold text-white whitespace-nowrap">
                              Rs. {itemSubtotal.toLocaleString("en-PK")}
                            </p>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-xs text-ink-soft italic">No items detailed.</p>
                    )}
                  </div>
                </div>

                {/* Total breakdown */}
                <div className="pt-4 border-t border-hairline flex items-baseline justify-between">
                  <span className="font-display text-base font-bold text-white">
                    Total Amount
                  </span>
                  <span className="font-display text-2xl font-bold text-white">
                    Rs. {Number(orderDetails.total_amount || 0).toLocaleString("en-PK")}
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </main>
  );
}
