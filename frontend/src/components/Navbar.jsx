import { useState, useEffect, useCallback, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import MegaMenu from "./MegaMenu";
import AuthModal from "./AuthModal";
import { fetchCart, fetchCategories, getAuthToken, setAuthToken } from "../services/api";
import { getGuestCartCount } from "../services/cartStorage";

/**
 * Navbar — Sticky header with brand, navigation links, mega-menu,
 * responsive mobile hamburger menu, and utility links (account, cart).
 */
export default function Navbar() {
  const location = useLocation();
  const menuRef = useRef(null);

  const [cartCount, setCartCount] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getAuthToken()));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCategoriesAccordionOpen, setIsCategoriesAccordionOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  const loadCount = useCallback(async () => {
    const token = getAuthToken();
    setIsLoggedIn(Boolean(token));

    if (!token) {
      // Guest mode: read count from localStorage
      setCartCount(getGuestCartCount());
      return;
    }

    // Authenticated mode: fetch count from backend
    try {
      const cart = await fetchCart();
      setCartCount(cart?.total_items || 0);
    } catch (err) {
      if (err.message === "UNAUTHORIZED") {
        setAuthToken(null);
        setIsLoggedIn(false);
      }
      setCartCount(getGuestCartCount());
    }
  }, []);

  // Fetch categories for mobile menu accordion
  useEffect(() => {
    fetchCategories()
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Close mobile menu whenever the route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsCategoriesAccordionOpen(false);
  }, [location.pathname]);

  // Handle click outside and Escape key to close mobile menu
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileMenuOpen]);

  useEffect(() => {
    loadCount();

    // Listen for custom cart-updated events from cartStorage
    const handleCartUpdate = () => {
      loadCount();
    };

    window.addEventListener("cart-updated", handleCartUpdate);
    window.addEventListener("storage", handleCartUpdate);

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
      window.removeEventListener("storage", handleCartUpdate);
    };
  }, [location.pathname, loadCount]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      setAuthToken(null);
      setIsLoggedIn(false);
      loadCount();
      setIsMobileMenuOpen(false);
      window.dispatchEvent(new CustomEvent("cart-updated"));
    }
  };

  const handleOpenCart = () => {
    setIsMobileMenuOpen(false);
    window.dispatchEvent(new CustomEvent("open-cart-drawer"));
  };

  return (
    <>
      <header ref={menuRef} className="bg-[#121212]/90 backdrop-blur-md border-b border-hairline sticky top-0 z-30">
        <nav
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8"
          aria-label="Main navigation"
        >
          {/* Left Group: Hamburger (Mobile) + Brand Logo + Primary Navigation Links (Desktop) */}
          <div className="flex items-center gap-3 sm:gap-9">
            {/* Mobile Hamburger Button */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 -ml-2 text-ink-soft hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-forest rounded-md transition-colors cursor-pointer"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                // Close 'X' icon
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                // 3-bar hamburger icon
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Brand */}
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-display text-xl font-bold tracking-tight whitespace-nowrap"
            >
              ShopEase
            </Link>

            {/* Desktop Primary Links (Unchanged) */}
            <ul className="hidden md:flex items-center gap-6 text-sm font-medium">
              <li>
                <Link to="/products" className="hover:text-forest transition-colors">
                  Shop All
                </Link>
              </li>

              {/* Categories Mega Menu Dropdown */}
              <li className="navigation-dropdown">
                <button
                  type="button"
                  className="hover:text-forest transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Categories
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                    <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <MegaMenu />
              </li>

              <li>
                <Link to="/products" className="hover:text-forest transition-colors">
                  New Arrivals
                </Link>
              </li>
            </ul>
          </div>

          {/* Right Group: Account & Cart */}
          <ul className="flex items-center gap-4 sm:gap-6 text-sm font-medium">
            <li className="hidden sm:flex items-center gap-4">
              {isLoggedIn ? (
                <>
                  <Link
                    to="/account"
                    className="hover:text-forest transition-colors flex items-center gap-1.5 text-white"
                    aria-label="My Account"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Account</span>
                  </Link>
                  <span className="text-hairline">|</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="hover:text-rust transition-colors text-ink-soft text-xs font-semibold cursor-pointer"
                    aria-label="Sign out"
                    title="Click to sign out"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsAuthModalOpen(true)}
                  className="hover:text-forest transition-colors flex items-center gap-1.5 text-white cursor-pointer"
                  aria-label="Sign in"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Sign In</span>
                </button>
              )}
            </li>

            <li>
              <button
                type="button"
                onClick={handleOpenCart}
                className="hover:text-forest transition-colors flex items-center gap-1.5 cursor-pointer text-white"
                aria-label="Open Cart Bag"
              >
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span className="hidden xs:inline sm:inline">Cart</span>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-forest text-black text-xs font-bold cart-count">
                  {cartCount}
                </span>
              </button>
            </li>
          </ul>
        </nav>

        {/* Mobile Slide-Down Menu */}
        <div
          className={`md:hidden overflow-hidden transition-all duration-300 ease-in-out border-t border-hairline/50 bg-[#121212] ${
            isMobileMenuOpen ? "max-h-[85vh] opacity-100 py-5 shadow-2xl" : "max-h-0 opacity-0 py-0"
          }`}
        >
          <div className="px-4 sm:px-6 space-y-5 overflow-y-auto max-h-[calc(85vh-2rem)]">
            {/* Mobile Navigation Links */}
            <ul className="space-y-1 text-sm font-medium border-b border-hairline pb-4">
              <li>
                <Link
                  to="/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface hover:text-forest transition-colors"
                >
                  <span>Shop All Products</span>
                  <span className="text-xs text-ink-soft">&rarr;</span>
                </Link>
              </li>

              {/* Collapsible Mobile Categories */}
              <li>
                <button
                  type="button"
                  onClick={() => setIsCategoriesAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface hover:text-forest transition-colors text-left cursor-pointer"
                >
                  <span className="flex items-center gap-2">Categories</span>
                  <svg
                    className={`w-4 h-4 text-ink-soft transition-transform duration-200 ${
                      isCategoriesAccordionOpen ? "rotate-180 text-forest" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Categories Submenu */}
                {isCategoriesAccordionOpen && (
                  <div className="pl-4 pr-2 py-2 space-y-3 bg-[#181818]/60 rounded-lg my-1 border border-hairline/60">
                    {categories.length === 0 ? (
                      <p className="text-xs text-ink-soft py-1">Loading categories...</p>
                    ) : (
                      categories.map((category) => (
                        <div key={category.id} className="space-y-1.5 pb-2 border-b border-hairline/40 last:border-0 last:pb-0">
                          <Link
                            to={`/products?category_id=${category.id}`}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="text-xs font-semibold text-forest uppercase tracking-wider block hover:underline"
                          >
                            {category.name}
                          </Link>
                          {category.children && category.children.length > 0 && (
                            <ul className="pl-2 space-y-1 text-xs text-ink-soft">
                              {category.children.map((sub) => (
                                <li key={sub.id}>
                                  <Link
                                    to={`/products?category_id=${sub.id}`}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="block py-1 hover:text-white transition-colors"
                                  >
                                    {sub.name}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </li>

              <li>
                <Link
                  to="/products"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-surface hover:text-forest transition-colors"
                >
                  <span>New Arrivals</span>
                  <span className="text-xs px-2 py-0.5 rounded bg-forest/20 text-forest font-semibold">New</span>
                </Link>
              </li>
            </ul>

            {/* Mobile Account / Cart Utilities */}
            <div className="space-y-2 pt-1 pb-2">
              {isLoggedIn ? (
                <>
                  <Link
                    to="/account"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface hover:text-forest transition-colors text-sm font-medium"
                  >
                    <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>My Account</span>
                  </Link>

                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-surface text-rust hover:text-rust transition-colors text-sm font-medium text-left cursor-pointer"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    <span>Sign Out</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    setIsAuthModalOpen(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-forest text-black font-semibold text-sm hover:bg-forest-dark transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span>Sign In / Register</span>
                </button>
              )}

              {/* Mobile Cart Button */}
              <button
                type="button"
                onClick={handleOpenCart}
                className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-surface hover:bg-hairline text-ink transition-colors text-sm font-medium cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                  <span>Shopping Cart</span>
                </div>
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-forest text-black text-xs font-bold">
                  {cartCount} items
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Background Dim Backdrop when Mobile Menu is Open */}
      {isMobileMenuOpen && (
        <div
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 md:hidden transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={() => {
          setIsLoggedIn(true);
          loadCount();
        }}
      />
    </>
  );
}
