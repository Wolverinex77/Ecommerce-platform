import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import MegaMenu from "./MegaMenu";
import MobileMenu from "./MobileMenu";
import AuthModal from "./AuthModal";
import { fetchCart, fetchCategories, fetchUserProfile, getAuthToken, setAuthToken } from "../services/api";
import { getGuestCartCount } from "../services/cartStorage";

/**
 * Navbar — Sticky header with brand, navigation links, mega-menu,
 * responsive mobile hamburger menu, and utility links (account, cart).
 */
export default function Navbar() {
  const location = useLocation();

  const isHomePage = location.pathname === "/";
  const [isScrolled, setIsScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(getAuthToken()));
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    if (!isHomePage) {
      setIsScrolled(false);
      return;
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 40);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  const loadCount = useCallback(async () => {
    const token = getAuthToken();
    const hasToken = Boolean(token);
    setIsLoggedIn(hasToken);

    if (!hasToken) {
      setCurrentUser(null);
      setCartCount(getGuestCartCount());
      return;
    }

    // Authenticated mode: fetch count and user profile
    try {
      const [cartRes, profileRes] = await Promise.allSettled([
        fetchCart(),
        fetchUserProfile(),
      ]);

      if (cartRes.status === "fulfilled" && cartRes.value) {
        setCartCount(cartRes.value.total_items || 0);
      } else {
        if (cartRes.reason?.message === "UNAUTHORIZED") {
          setAuthToken(null);
          setIsLoggedIn(false);
          setCurrentUser(null);
          setCartCount(getGuestCartCount());
          return;
        }
        setCartCount(getGuestCartCount());
      }

      if (profileRes.status === "fulfilled" && profileRes.value) {
        setCurrentUser(profileRes.value);
      } else {
        if (profileRes.reason?.message === "UNAUTHORIZED") {
          setAuthToken(null);
          setIsLoggedIn(false);
          setCurrentUser(null);
        } else {
          setCurrentUser(null);
        }
      }
    } catch {
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
  }, [location.pathname]);



  useEffect(() => {
    loadCount();

    // Listen for custom cart-updated and auth-changed events
    const handleCartUpdate = () => {
      loadCount();
    };

    window.addEventListener("cart-updated", handleCartUpdate);
    window.addEventListener("auth-changed", handleCartUpdate);
    window.addEventListener("storage", handleCartUpdate);

    return () => {
      window.removeEventListener("cart-updated", handleCartUpdate);
      window.removeEventListener("auth-changed", handleCartUpdate);
      window.removeEventListener("storage", handleCartUpdate);
    };
  }, [location.pathname, loadCount]);

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to sign out?")) {
      setAuthToken(null);
      setIsLoggedIn(false);
      setCurrentUser(null);
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
      <header
        className={
          isHomePage
            ? `fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
                isScrolled
                  ? "bg-[#121212]/95 backdrop-blur-md border-b border-hairline shadow-md"
                  : "bg-transparent border-b border-transparent shadow-none"
              }`
            : "sticky top-0 z-50 bg-[#121212]/95 backdrop-blur-md border-b border-hairline"
        }
      >
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
              className="md:hidden p-2 -ml-2 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] hover:text-white/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-md transition-colors cursor-pointer"
              aria-label={isMobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={isMobileMenuOpen}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {/* Brand */}
            <Link
              to="/"
              onClick={() => setIsMobileMenuOpen(false)}
              className="font-display text-xl font-bold tracking-tight whitespace-nowrap text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
            >
              ShopEase
            </Link>

            {/* Desktop Primary Links */}
            <ul className="hidden md:flex items-center gap-6 text-sm font-medium">
              <li>
                <Link
                  to="/products"
                  className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] hover:text-white/80 transition-colors"
                >
                  Shop All
                </Link>
              </li>

              {/* Categories Mega Menu Dropdown */}
              <li className="navigation-dropdown">
                <button
                  type="button"
                  className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] hover:text-white/80 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  Categories
                  <svg className="w-3.5 h-3.5" viewBox="0 0 12 8" fill="none" aria-hidden="true">
                    <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </button>
                <MegaMenu />
              </li>

              <li>
                <Link
                  to="/products"
                  className="text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] hover:text-white/80 transition-colors"
                >
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
                  {currentUser?.is_admin && (
                    <Link
                      to="/admin"
                      className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-black border border-emerald-500/30 text-xs font-bold transition-all shadow-sm"
                      title="Open Store Admin Panel"
                    >
                      Admin
                    </Link>
                  )}
                  <Link
                    to="/account"
                    className="hover:text-forest transition-colors flex items-center gap-1.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
                    aria-label="My Account"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Account</span>
                  </Link>
                  <span className="text-white/40">|</span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="hover:text-rust transition-colors text-white/80 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] text-xs font-semibold cursor-pointer"
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
                  className="hover:text-forest transition-colors flex items-center gap-1.5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] cursor-pointer"
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
                className="hover:text-forest transition-colors flex items-center gap-1.5 cursor-pointer text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]"
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
      </header>

      {/* Modern Slide-Over Mobile Hamburger Menu */}
      <MobileMenu
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        handleLogout={handleLogout}
        categories={categories}
      />

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
