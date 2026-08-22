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

  return (
    <main id="home" className="pb-12 sm:pb-16">
      {/* ==================== HERO ==================== */}
      <section className="hero max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6" aria-labelledby="hero-title">
        <div className="relative rounded-md overflow-hidden border border-hairline bg-surface aspect-[4/5] sm:aspect-[16/8] lg:aspect-[21/9] min-h-[400px] flex items-center justify-center text-center">
          {/* Large Hero Banner Image */}
          <img
            src="https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?q=80&w=1600&auto=format&fit=crop"
            alt="New Collection Men's Fashion"
            className="absolute inset-0 w-full h-full object-cover object-center"
            loading="eager"
          />

          {/* Subtle Dark Overlay for Text Contrast */}
          <div className="absolute inset-0 bg-black/40 sm:bg-black/35" />

          {/* Hero Content */}
          <div className="relative z-10 max-w-xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col items-center space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase text-forest">
              New Collection
            </p>

            <h1
              id="hero-title"
              className="font-display font-bold text-3xl sm:text-5xl lg:text-6xl text-white tracking-tight leading-tight"
            >
              Essentials, Refined.
            </h1>

            <p className="text-sm sm:text-base text-neutral-200 max-w-md font-normal">
              Discover our latest collection crafted for everyday comfort and timeless style.
            </p>

            <div className="pt-2 sm:pt-3">
              <Link
                to="/products"
                className="inline-block bg-white text-black hover:bg-neutral-200 px-8 py-3.5 rounded-sm text-xs sm:text-sm font-bold uppercase tracking-wider transition-colors shadow-lg"
              >
                Shop Now
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
