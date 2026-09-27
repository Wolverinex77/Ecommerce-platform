import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import { fetchProducts } from "../services/api";
import heroImage from "../assets/hero-model.jpg";

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

  return (
    <main id="home" className="pb-12 sm:pb-16">
      {/* ==================== HERO ==================== */}
      <section className="hero w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 sm:py-3" aria-labelledby="hero-title">
        <div className="relative w-full rounded-xl sm:rounded-2xl overflow-hidden border border-hairline bg-[#11161f] min-h-[650px] h-[75vh] max-h-[850px] flex items-end sm:items-center shadow-2xl">
          {/* Main Hero Background Image - full 16:9 photo breathing room */}
          <img
            src={heroImage}
            alt="Man wearing light linen overshirt and casual trousers walking outdoors - ShopEase Men's Collection"
            className="absolute inset-0 w-full h-full object-cover object-[right_center] select-none"
            style={{ objectFit: "cover", objectPosition: "center right", width: "100%", height: "100%" }}
            loading="eager"
            decoding="async"
          />

          {/* Mobile Bottom-to-Top Scrim */}
          <div
            className="absolute inset-0 sm:hidden bg-gradient-to-t from-black/90 via-black/55 via-40% to-transparent pointer-events-none"
            aria-hidden="true"
          />

          {/* Desktop & Tablet Left-to-Right Scrim for High Typography Contrast without Darkening the Model */}
          <div
            className="absolute inset-0 hidden sm:block pointer-events-none"
            style={{
              background: "linear-gradient(to right, rgba(0, 0, 0, 0.72) 0%, rgba(0, 0, 0, 0.45) 30%, rgba(0, 0, 0, 0.15) 52%, transparent 72%)",
            }}
            aria-hidden="true"
          />

          {/* Subtle perimeter border depth */}
          <div
            className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl sm:rounded-2xl pointer-events-none"
            aria-hidden="true"
          />

          {/* Hero Content placed naturally in the landscape negative space */}
          <div className="relative z-10 w-full sm:max-w-md md:max-w-lg lg:max-w-xl px-5 sm:px-8 md:px-12 lg:px-14 py-6 sm:py-10 md:py-14 flex flex-col items-start space-y-3 sm:space-y-4 text-left">
            {/* Tasteful Category Eyebrow */}
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-zinc-100 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Men's Essentials</span>
            </div>

            {/* Refined Headline */}
            <h1
              id="hero-title"
              className="font-sans font-semibold text-2xl sm:text-3xl md:text-4xl lg:text-[3rem] text-white tracking-tight leading-[1.14] drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]"
            >
              Built for Everyday.
            </h1>

            {/* Supporting Line with strong contrast */}
            <p className="text-sm sm:text-base md:text-lg text-zinc-100 font-medium leading-relaxed max-w-sm sm:max-w-md drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
              Modern essentials for every day.
            </p>

            {/* Clear Primary CTA */}
            <div className="pt-2 sm:pt-3">
              <Link
                to="/products"
                className="inline-flex items-center justify-center gap-2.5 bg-white hover:bg-zinc-100 text-black px-6 sm:px-8 py-3 sm:py-3.5 rounded-lg text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-200 shadow-xl hover:shadow-2xl hover:-translate-y-0.5 active:translate-y-0 cursor-pointer group"
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

      {/* ==================== NEW ARRIVALS ==================== */}
      <section id="new-arrivals" className="product-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-hairline" aria-labelledby="new-arrivals-title">
        <header className="section-header flex items-end justify-between pb-8">
          <div>
            <p className="eyebrow text-xs font-semibold tracking-[0.14em] uppercase text-forest mb-1">Curated for you</p>
            <h2 id="new-arrivals-title" className="font-display font-bold text-3xl text-white">New arrivals</h2>
          </div>
          <Link to="/products" className="text-sm font-semibold text-forest hover:underline flex items-center gap-1">
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
        ) : products.length > 0 ? (
          <div id="all-products" className="product-grid grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center text-ink-soft">No products available at the moment.</div>
        )}
      </section>

      {/* ==================== FEATURED PRODUCTS ==================== */}
      <section id="featured-products" className="product-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-hairline" aria-labelledby="featured-title">
        <header className="section-header flex items-end justify-between pb-8">
          <div>
            <p className="eyebrow text-xs font-semibold tracking-[0.14em] uppercase text-forest mb-1">Handpicked</p>
            <h2 id="featured-title" className="font-display font-bold text-3xl text-white">Featured products</h2>
          </div>
          <Link to="/products" className="text-sm font-semibold text-forest hover:underline">View All Products &rarr;</Link>
        </header>

        {products.length > 4 && (
          <div className="product-grid grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6" id="featured-products-list">
            {products.slice(4, 8).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
