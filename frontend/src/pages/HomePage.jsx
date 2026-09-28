import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../services/api";

export default function HomePage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProducts = () => {
    setLoading(true);
    setError(null);
    fetchProducts()
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching homepage products:", err);
        setError("Unable to load products. Please check that the server is running.");
        setLoading(false);
      });
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const featuredList = products.filter((p) => p.is_featured);
  const displayFeatured = featuredList.length > 0 ? featuredList.slice(0, 8) : products.slice(0, 4);
  const displayNewArrivals =
    featuredList.length > 0
      ? products.filter((p) => !p.is_featured).slice(0, 8)
      : products.slice(4, 12).length > 0
      ? products.slice(4, 12)
      : products.slice(0, 8);

  return (
    <main id="home" className="pb-12 sm:pb-16">
      {/* ==================== HERO ==================== */}
      <section
        className="hero hero-container-fullview relative w-full overflow-hidden bg-[#11161f] flex flex-col justify-end md:justify-center items-start m-0 p-0"
        style={{ height: "100svh", maxHeight: "100svh" }}
        aria-labelledby="hero-title"
      >
        {/* Main Hero Background Picture - Responsive Art Direction */}
        <picture className="absolute inset-0 w-full h-full block">
          {/* Mobile (< 768px): loads vertical 9:16 portrait */}
          <source media="(max-width: 767px)" srcSet="/hero-mobile.jpg" />
          {/* Desktop (>= 768px): loads wide 16:9 landscape */}
          <img
            src="/hero-desktop.jpg"
            alt="Men's Essentials Collection"
            className="hero-image-responsive w-full h-full select-none"
            loading="eager"
            decoding="async"
          />
        </picture>

        {/* Subtle Top Scrim for high contrast navbar against sky */}
        <div
          className="absolute inset-x-0 top-0 h-36 pointer-events-none z-10"
          style={{
            background: "linear-gradient(to bottom, rgba(0, 0, 0, 0.60) 0%, rgba(0, 0, 0, 0.25) 50%, rgba(0, 0, 0, 0.05) 80%, transparent 100%)",
            filter: "none",
          }}
          aria-hidden="true"
        />

        {/* Mobile Bottom-to-Top Scrim over gravel area */}
        <div
          className="absolute inset-0 md:hidden pointer-events-none"
          style={{
            background: "linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.35) 35%, rgba(0, 0, 0, 0.10) 55%, transparent 75%)",
            filter: "none",
          }}
          aria-hidden="true"
        />

        {/* Desktop & Tablet Left-to-Right Scrim for High Typography Contrast without Darkening the Model */}
        <div
          className="absolute inset-0 hidden md:block pointer-events-none"
          style={{
            background: "linear-gradient(to right, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.45) 32%, rgba(0, 0, 0, 0.12) 55%, transparent 75%)",
            filter: "none",
          }}
          aria-hidden="true"
        />

        {/* Hero Content: left-aligned with ample padding below navbar on desktop, bottom-anchored with clean clearance on mobile */}
        <div className="relative z-10 w-full max-w-7xl mx-auto px-6 sm:px-8 md:px-12 lg:px-16 pt-24 pb-8 md:pt-28 md:pb-12 flex flex-col justify-end md:justify-center items-start h-full">
          <div className="w-full sm:max-w-md md:max-w-lg lg:max-w-xl flex flex-col items-start space-y-3 sm:space-y-4 text-left">
            {/* Category Eyebrow */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 border border-white/20 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-zinc-100 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Men's Essentials</span>
            </div>

            {/* Refined Headline with text-shadow */}
            <h1
              id="hero-title"
              style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.35)" }}
              className="font-sans font-semibold text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] text-white tracking-tight leading-[1.14]"
            >
              Built for Everyday.
            </h1>

            {/* Supporting Line with text-shadow */}
            <p
              style={{ textShadow: "0 2px 6px rgba(0, 0, 0, 0.35)" }}
              className="text-base sm:text-lg md:text-xl text-zinc-100 font-medium leading-relaxed max-w-sm sm:max-w-md"
            >
              Modern essentials for every day.
            </p>

            {/* Clear Primary CTA with >24px bottom clearance on mobile */}
            <div className="pt-2 sm:pt-3">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-100 text-black px-6 sm:px-8 py-3.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
              >
                <span>Shop Collection</span>
                <svg
                  className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== 1. FEATURED PRODUCTS (DISPLAYS FIRST) ==================== */}
      <section
        id="featured-products"
        className="product-section max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24 border-t border-hairline"
        aria-labelledby="featured-title"
      >
        <header className="section-header flex items-end justify-between pb-6 sm:pb-8">
          <div>
            <h2 id="featured-title" className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
              Featured products
            </h2>
          </div>
          <Link to="/products" className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white transition">
            View All Products &rarr;
          </Link>
        </header>

        {loading ? (
          <div className="py-12 text-center text-ink-soft">Loading products...</div>
        ) : error ? (
          <div className="py-12 text-center text-ink-soft">
            <p className="text-red-400 mb-3">{error}</p>
            <button
              onClick={loadProducts}
              className="text-xs font-semibold text-forest border border-hairline px-4 py-2 rounded-sm hover:bg-surface transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : displayFeatured.length > 0 ? (
          /* Mobile: 1 column stacked vertically (big & immersive); Desktop: balanced 4-column grid (3-column on md) */
          <div
            id="featured-products-list"
            className="product-grid grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-8 md:gap-6 lg:gap-8"
          >
            {displayFeatured.map((product) => (
              <ProductCard key={product.id} product={product} featured={true} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-ink-soft">No featured products available at the moment.</div>
        )}
      </section>

      {/* ==================== 2. NEW ARRIVALS (DISPLAYS SECOND) ==================== */}
      <section
        id="new-arrivals"
        className="product-section max-w-7xl mx-auto px-6 lg:px-8 py-16 lg:py-24 border-t border-hairline"
        aria-labelledby="new-arrivals-title"
      >
        <header className="section-header flex items-end justify-between pb-6 sm:pb-8">
          <div>
            <h2 id="new-arrivals-title" className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
              New arrivals
            </h2>
          </div>
          <Link to="/products" className="text-xs sm:text-sm font-medium text-neutral-300 hover:text-white transition flex items-center gap-1">
            View All Products &rarr;
          </Link>
        </header>

        {loading ? (
          <div className="py-12 text-center text-ink-soft">Loading products...</div>
        ) : displayNewArrivals.length > 0 ? (
          /* Mobile: optimized compact 2-column grid; Desktop: balanced 4-column grid (3-column on md) */
          <div
            id="all-products"
            className="product-grid grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5 md:gap-6 lg:gap-8"
          >
            {displayNewArrivals.map((product) => (
              <ProductCard key={product.id} product={product} featured={false} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-ink-soft">No products available at the moment.</div>
        )}
      </section>
    </main>
  );
}
