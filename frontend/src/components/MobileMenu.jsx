import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

export default function MobileMenu({
  isOpen,
  onClose,
  onOpenAuth,
  isLoggedIn,
  currentUser,
  handleLogout,
  categories = [],
}) {
  const [mounted, setMounted] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  // Mount/unmount lifecycle for smooth entrance and exit transitions
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll and listen for Escape key when menu is open
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  // Don't render anything in the DOM when closed and animation has finished
  if (!mounted && !isOpen) return null;

  const menuContent = (
    <div className="md:hidden">
      {/* 1. Backdrop Overlay */}
      <div
        onClick={onClose}
        className={`bg-black/60 backdrop-blur-sm fixed inset-0 z-[60] transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100 visible pointer-events-auto" : "opacity-0 invisible pointer-events-none"
        }`}
        aria-hidden="true"
      />

      {/* 2. Slide-Over Drawer Panel */}
      <aside
        id="mobile-navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        className={`fixed inset-y-0 left-0 w-[85%] max-w-sm bg-neutral-950 text-white z-[70] flex flex-col justify-between p-6 shadow-2xl border-r border-neutral-800/80 transition-transform duration-300 ease-in-out box-border ${
          isOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        }`}
      >
        {/* ==================== TOP: HEADER ==================== */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between pb-2">
            <Link
              to="/"
              onClick={onClose}
              className="font-display text-2xl font-bold tracking-tight text-white hover:opacity-90 transition-opacity"
            >
              ShopEase
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-900 transition-colors cursor-pointer"
              aria-label="Close navigation menu"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ==================== MIDDLE: LOOKBOOK NAVIGATION LINKS ==================== */}
        <div className="flex-1 overflow-y-auto my-6 space-y-1 pr-1 -mr-1">
          {/* 1. New Arrivals */}
          <Link
            to="/products"
            onClick={onClose}
            className="min-h-[48px] text-xl font-medium tracking-tight text-white hover:text-neutral-300 transition-colors py-2 flex items-center justify-between group"
          >
            <span>New Arrivals</span>
            <span className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              NEW
            </span>
          </Link>

          {/* 2. Shop All Products */}
          <Link
            to="/products"
            onClick={onClose}
            className="min-h-[48px] text-xl font-medium tracking-tight text-white hover:text-neutral-300 transition-colors py-2 flex items-center justify-between"
          >
            <span>Shop All Products</span>
            <svg className="w-5 h-5 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          {/* 3. Categories (Expandable Accordion) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsCategoriesOpen((prev) => !prev)}
              className="w-full min-h-[48px] text-xl font-medium tracking-tight text-white hover:text-neutral-300 transition-colors py-2 flex items-center justify-between text-left cursor-pointer"
              aria-expanded={isCategoriesOpen}
            >
              <span>Categories</span>
              <svg
                className={`w-5 h-5 text-neutral-400 transition-transform duration-200 ${
                  isCategoriesOpen ? "rotate-180 text-white" : ""
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isCategoriesOpen && (
              <div className="pl-3 pr-1 pb-2 pt-1 space-y-1 animate-fadeIn">
                {categories && categories.length > 0 ? (
                  categories.map((cat) => (
                    <div key={cat.id} className="py-1">
                      <Link
                        to={`/products?category_id=${cat.id}`}
                        onClick={onClose}
                        className="min-h-[40px] flex items-center justify-between text-sm font-medium text-neutral-300 hover:text-white py-1 transition-colors"
                      >
                        <span>{cat.name}</span>
                        <span className="text-xs text-neutral-600">&rarr;</span>
                      </Link>
                      {cat.children && cat.children.length > 0 && (
                        <div className="pl-3 space-y-1 border-l border-neutral-800 my-1">
                          {cat.children.map((sub) => (
                            <Link
                              key={sub.id}
                              to={`/products?category_id=${sub.id}`}
                              onClick={onClose}
                              className="block text-xs text-neutral-400 hover:text-white py-1 transition-colors"
                            >
                              {sub.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  [
                    { name: "Shirts", id: 1 },
                    { name: "Trousers", id: 2 },
                    { name: "Outerwear", id: 3 },
                    { name: "Footwear", id: 4 },
                  ].map((item) => (
                    <Link
                      key={item.name}
                      to={`/products?category_id=${item.id}`}
                      onClick={onClose}
                      className="min-h-[40px] flex items-center justify-between text-sm font-medium text-neutral-300 hover:text-white py-1 transition-colors"
                    >
                      <span>{item.name}</span>
                      <span className="text-xs text-neutral-600">&rarr;</span>
                    </Link>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ==================== BOTTOM: USER ACCOUNT & FOOTER SECTION ==================== */}
        <div className="flex-shrink-0 pt-4 space-y-4">
          {/* Account & Orders Links */}
          <div className="border-t border-neutral-800/80 pt-4 space-y-2">
            {isLoggedIn ? (
              <>
                {currentUser?.is_admin && (
                  <Link
                    to="/admin"
                    onClick={onClose}
                    className="flex items-center gap-3 py-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Store Admin Panel</span>
                  </Link>
                )}

                <Link
                  to="/account"
                  onClick={onClose}
                  className="flex items-center gap-3 py-2 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>My Profile ({currentUser?.name || "Account"})</span>
                </Link>

                <Link
                  to="/account?tab=orders"
                  onClick={onClose}
                  className="flex items-center gap-3 py-2 text-sm text-neutral-300 hover:text-white transition-colors"
                >
                  <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>My Orders</span>
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    handleLogout();
                  }}
                  className="flex items-center gap-3 py-2 text-sm text-rose-400 hover:text-rose-300 transition-colors w-full text-left cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Sign Out</span>
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAuth();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-semibold text-sm transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Sign In / Register</span>
                </button>

                <div className="flex items-center justify-between text-xs text-neutral-400 pt-2 px-1">
                  <Link
                    to="/account"
                    onClick={onClose}
                    className="hover:text-white transition-colors"
                  >
                    My Orders
                  </Link>
                  <span>•</span>
                  <Link
                    to="/products"
                    onClick={onClose}
                    className="hover:text-white transition-colors"
                  >
                    Wishlist
                  </Link>
                  <span>•</span>
                  <Link
                    to="/account"
                    onClick={onClose}
                    className="hover:text-white transition-colors"
                  >
                    Help &amp; Support
                  </Link>
                </div>
              </>
            )}
          </div>

          {/* Support & Minimal Footer (PKR amount removed) */}
          <div className="border-t border-neutral-800/80 pt-3 flex items-center justify-between text-xs text-neutral-400">
            <span className="text-xs text-neutral-400">Customer Support Available</span>
            <span className="text-[11px] text-neutral-500">© {new Date().getFullYear()} ShopEase</span>
          </div>
        </div>
      </aside>
    </div>
  );

  return createPortal(menuContent, document.body);
}
