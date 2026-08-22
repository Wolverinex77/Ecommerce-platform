import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams, Link } from "react-router-dom";
import HeroSection from "../components/HeroSection";
import ProductCard from "../components/ProductCard";
import { fetchProducts, fetchCategories, findCategoryAndParent } from "../services/api";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const PRICE_RANGES = [
  { id: "all", label: "All Prices", min: null, max: null },
  { id: "under-2000", label: "Under Rs. 2,000", min: null, max: 2000 },
  { id: "2000-5000", label: "Rs. 2,000 – Rs. 5,000", min: 2000, max: 5000 },
  { id: "5000-10000", label: "Rs. 5,000 – Rs. 10,000", min: 5000, max: 10000 },
  { id: "above-10000", label: "Above Rs. 10,000", min: 10000, max: null },
];

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Read URL Search Params
  const categoryIdParam = searchParams.get("category_id");
  const categoryId = categoryIdParam ? parseInt(categoryIdParam, 10) : null;
  const minPriceParam = searchParams.get("min_price");
  const maxPriceParam = searchParams.get("max_price");
  const inStockParam = searchParams.get("in_stock");
  const sizeParam = searchParams.get("size"); // comma-separated or single
  const sortParam = searchParams.get("sort") || "featured";

  // Data states
  const [rawProducts, setRawProducts] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [categoryInfo, setCategoryInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter UI Disclosure State
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Selected filter states
  const [selectedCategory, setSelectedCategory] = useState(categoryId);
  const [selectedPriceRange, setSelectedPriceRange] = useState(() => {
    if (minPriceParam === "10000") return "above-10000";
    if (minPriceParam === "5000" && maxPriceParam === "10000") return "5000-10000";
    if (minPriceParam === "2000" && maxPriceParam === "5000") return "2000-5000";
    if (maxPriceParam === "2000") return "under-2000";
    return "all";
  });
  const [selectedSizes, setSelectedSizes] = useState(() => {
    return sizeParam ? sizeParam.split(",").filter(Boolean) : [];
  });
  const [inStockOnly, setInStockOnly] = useState(inStockParam === "true");
  const [sortBy, setSortBy] = useState(sortParam);

  // Sync state when URL params change
  useEffect(() => {
    setSelectedCategory(categoryId);
    setInStockOnly(inStockParam === "true");
    setSortBy(sortParam);
    if (sizeParam) {
      setSelectedSizes(sizeParam.split(",").filter(Boolean));
    } else {
      setSelectedSizes([]);
    }

    if (minPriceParam === "10000") setSelectedPriceRange("above-10000");
    else if (minPriceParam === "5000" && maxPriceParam === "10000") setSelectedPriceRange("5000-10000");
    else if (minPriceParam === "2000" && maxPriceParam === "5000") setSelectedPriceRange("2000-5000");
    else if (maxPriceParam === "2000") setSelectedPriceRange("under-2000");
    else setSelectedPriceRange("all");
  }, [categoryId, minPriceParam, maxPriceParam, inStockParam, sizeParam, sortParam]);

  // Load Categories list on mount
  useEffect(() => {
    fetchCategories()
      .then((cats) => setCategoriesList(cats))
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  // Fetch Products based on active URL filters
  const loadProducts = useCallback(() => {
    setLoading(true);
    setError(null);

    const query = {};
    if (categoryId) query.category_id = categoryId;
    if (minPriceParam) query.min_price = minPriceParam;
    if (maxPriceParam) query.max_price = maxPriceParam;
    if (inStockParam === "true") query.in_stock = true;

    fetchProducts(query)
      .then((data) => {
        setRawProducts(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch products:", err);
        setError("Unable to load products. Please check that the server is running.");
        setRawProducts([]);
        setLoading(false);
      });
  }, [categoryId, minPriceParam, maxPriceParam, inStockParam]);

  useEffect(() => {
    loadProducts();

    if (categoryId && categoriesList.length > 0) {
      const match = findCategoryAndParent(categoriesList, categoryId);
      setCategoryInfo(match);
    } else {
      setCategoryInfo(null);
    }
  }, [loadProducts, categoryId, categoriesList]);

  // Apply filters to URL
  const applyFilters = () => {
    const params = new URLSearchParams();

    if (selectedCategory) {
      params.set("category_id", selectedCategory);
    }

    const priceConfig = PRICE_RANGES.find((p) => p.id === selectedPriceRange);
    if (priceConfig) {
      if (priceConfig.min !== null) params.set("min_price", priceConfig.min);
      if (priceConfig.max !== null) params.set("max_price", priceConfig.max);
    }

    if (inStockOnly) {
      params.set("in_stock", "true");
    }

    if (selectedSizes.length > 0) {
      params.set("size", selectedSizes.join(","));
    }

    if (sortBy && sortBy !== "featured") {
      params.set("sort", sortBy);
    }

    setSearchParams(params);
    setIsFilterOpen(false);
  };

  // Reset all filters
  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedPriceRange("all");
    setSelectedSizes([]);
    setInStockOnly(false);
    setSortBy("featured");
    setSearchParams(new URLSearchParams());
    setIsFilterOpen(false);
  };

  // Toggle size selection
  const handleSizeToggle = (size) => {
    setSelectedSizes((prev) =>
      prev.includes(size) ? prev.filter((s) => s !== size) : [...prev, size]
    );
  };

  // Handle Sort dropdown change
  const handleSortChange = (newSort) => {
    setSortBy(newSort);
    const params = new URLSearchParams(searchParams);
    if (newSort === "featured") {
      params.delete("sort");
    } else {
      params.set("sort", newSort);
    }
    setSearchParams(params);
  };

  // Client-side filtering for Size and Sorting
  const filteredAndSortedProducts = useMemo(() => {
    let result = [...rawProducts];

    // 1. Size filtering
    if (selectedSizes.length > 0) {
      result = result.filter((product) => {
        if (!product.size) return false;
        const prodSize = String(product.size).toUpperCase().trim();
        return selectedSizes.some((s) => prodSize.includes(s));
      });
    }

    // 2. Sorting
    if (sortBy === "price-asc") {
      result.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (sortBy === "price-desc") {
      result.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
    } else if (sortBy === "name-asc") {
      result.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    } else if (sortBy === "newest") {
      result.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    }

    return result;
  }, [rawProducts, selectedSizes, sortBy]);

  // Check if any filters are active
  const hasActiveFilters = Boolean(
    categoryId ||
    minPriceParam ||
    maxPriceParam ||
    inStockParam === "true" ||
    selectedSizes.length > 0 ||
    sortBy !== "featured"
  );

  return (
    <main>
      {/* Dynamic Hero Section */}
      <HeroSection
        categoryId={categoryId}
        categoryInfo={categoryInfo}
        productCount={filteredAndSortedProducts.length}
      />

      {/* ==================== TOOLBAR: FILTER MEGA MENU + SORT ==================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 relative z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4 relative">
          {/* Filter Mega Menu Disclosure */}
          <details
            id="filter-mega-menu"
            className="group"
            open={isFilterOpen}
            onToggle={(e) => setIsFilterOpen(e.currentTarget.open)}
          >
            <summary className="inline-flex items-center gap-2.5 border border-hairline bg-surface rounded-sm px-4 py-2.5 text-sm font-medium hover:border-forest transition-colors cursor-pointer list-none select-none focus:outline-none focus:ring-2 focus:ring-forest">
              <svg className="w-4 h-4 text-forest" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M3 5h14M6 10h8M8.5 15h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              <span>Filters &amp; Refinements</span>
              {hasActiveFilters && (
                <span className="w-2 h-2 rounded-full bg-forest animate-pulse"></span>
              )}
              <svg
                className={`w-3.5 h-3.5 transition-transform duration-200 ${
                  isFilterOpen ? "rotate-180" : ""
                }`}
                viewBox="0 0 12 8"
                fill="none"
                aria-hidden="true"
              >
                <path d="M1 1.5 6 6.5 11 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </summary>

            {/* Mega Menu Dropdown Panel */}
            <div className="absolute left-0 top-full mt-3 w-full max-w-[calc(100vw-2rem)] sm:max-w-5xl bg-surface border border-hairline rounded-md shadow-2xl p-4 sm:p-8 z-50 animate-fadeIn">

              <div className="flex items-center justify-between pb-4 border-b border-hairline mb-6">
                <div>
                  <h2 className="font-display font-semibold text-lg text-white">Filter Collection</h2>
                  <p className="text-xs text-ink-soft mt-0.5">Narrow down by category, price, size, and availability</p>
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs text-ink-soft hover:text-forest hover:underline"
                  >
                    Clear all filters
                  </button>
                )}
              </div>

              {/* Mega Menu Columns Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
                {/* 1. Category Filter */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-forest mb-1">
                    Category
                  </legend>
                  <div className="space-y-2 text-sm text-ink-soft max-h-48 overflow-y-auto pr-2">
                    <label className="flex items-center gap-2 cursor-pointer hover:text-white">
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === null}
                        onChange={() => setSelectedCategory(null)}
                        className="accent-forest w-4 h-4"
                      />
                      <span>All Categories</span>
                    </label>
                    {categoriesList.map((cat) => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:text-white">
                        <input
                          type="radio"
                          name="category"
                          checked={selectedCategory === cat.id}
                          onChange={() => setSelectedCategory(cat.id)}
                          className="accent-forest w-4 h-4"
                        />
                        <span className={selectedCategory === cat.id ? "text-forest font-semibold" : ""}>
                          {cat.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* 2. Price Filter */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-forest mb-1">
                    Price Range
                  </legend>
                  <div className="space-y-2 text-sm text-ink-soft">
                    {PRICE_RANGES.map((pr) => (
                      <label key={pr.id} className="flex items-center gap-2.5 cursor-pointer hover:text-white">
                        <input
                          type="radio"
                          name="price-range"
                          value={pr.id}
                          checked={selectedPriceRange === pr.id}
                          onChange={() => setSelectedPriceRange(pr.id)}
                          className="accent-forest w-4 h-4"
                        />
                        <span className={selectedPriceRange === pr.id ? "text-forest font-semibold" : ""}>
                          {pr.label}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>

                {/* 3. Size Filter */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-forest mb-1">
                    Size
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {SIZES.map((size) => {
                      const isChecked = selectedSizes.includes(size);
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => handleSizeToggle(size)}
                          className={`w-9 h-9 rounded-sm border text-xs font-bold transition-all flex items-center justify-center ${
                            isChecked
                              ? "bg-forest text-black border-forest shadow-sm"
                              : "border-hairline bg-paper text-white hover:border-forest"
                          }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                {/* 4. Stock & Availability */}
                <fieldset className="space-y-3">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-forest mb-1">
                    Availability
                  </legend>
                  <div className="space-y-2 text-sm text-ink-soft">
                    <label className="flex items-center gap-2.5 cursor-pointer hover:text-white">
                      <input
                        type="checkbox"
                        checked={inStockOnly}
                        onChange={(e) => setInStockOnly(e.target.checked)}
                        className="accent-forest w-4 h-4 rounded-xs"
                      />
                      <span className={inStockOnly ? "text-forest font-semibold" : ""}>
                        In Stock Only
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>

              {/* Mega Menu Footer Bar */}
              <div className="mt-8 pt-4 border-t border-hairline flex flex-wrap items-center justify-between gap-4">
                <p className="text-xs text-ink-soft">
                  Found <span className="text-white font-bold">{filteredAndSortedProducts.length}</span> matching products
                </p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="text-xs font-medium text-ink-soft hover:text-white px-3 py-2"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={applyFilters}
                    className="bg-forest text-black hover:bg-forest-dark px-6 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors shadow-md"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            </div>
          </details>

          {/* Right Toolbar: Sort Dropdown */}
          <div className="flex items-center gap-2 sm:ml-auto">
            <label htmlFor="sort" className="text-xs uppercase tracking-wider font-semibold text-ink-soft hidden sm:inline">
              Sort by
            </label>
            <select
              id="sort"
              name="sort"
              value={sortBy}
              onChange={(e) => handleSortChange(e.target.value)}
              className="bg-surface border border-hairline rounded-sm px-3.5 py-2 text-sm text-white font-medium focus:border-forest focus:outline-none transition-colors"
            >
              <option value="featured">Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="newest">Newest</option>
              <option value="name-asc">Alphabetical (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Active Filter Chips / Pills */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <span className="text-xs text-ink-soft mr-1 font-semibold uppercase tracking-wider">
              Active Filters:
            </span>

            {categoryId && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-surface border border-hairline px-3 py-1 rounded-full text-white">
                Category: {categoryInfo?.category?.name || `ID #${categoryId}`}
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    p.delete("category_id");
                    setSearchParams(p);
                  }}
                  className="hover:text-rust font-bold"
                  aria-label="Remove category filter"
                >
                  &times;
                </button>
              </span>
            )}

            {selectedPriceRange !== "all" && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-surface border border-hairline px-3 py-1 rounded-full text-white">
                Price: {PRICE_RANGES.find((p) => p.id === selectedPriceRange)?.label}
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    p.delete("min_price");
                    p.delete("max_price");
                    setSearchParams(p);
                  }}
                  className="hover:text-rust font-bold"
                  aria-label="Remove price filter"
                >
                  &times;
                </button>
              </span>
            )}

            {selectedSizes.map((size) => (
              <span key={size} className="inline-flex items-center gap-1.5 text-xs bg-surface border border-hairline px-3 py-1 rounded-full text-white">
                Size: {size}
                <button
                  type="button"
                  onClick={() => {
                    const remaining = selectedSizes.filter((s) => s !== size);
                    const p = new URLSearchParams(searchParams);
                    if (remaining.length > 0) p.set("size", remaining.join(","));
                    else p.delete("size");
                    setSearchParams(p);
                  }}
                  className="hover:text-rust font-bold"
                  aria-label={`Remove size ${size} filter`}
                >
                  &times;
                </button>
              </span>
            ))}

            {inStockParam === "true" && (
              <span className="inline-flex items-center gap-1.5 text-xs bg-surface border border-hairline px-3 py-1 rounded-full text-white">
                In Stock Only
                <button
                  type="button"
                  onClick={() => {
                    const p = new URLSearchParams(searchParams);
                    p.delete("in_stock");
                    setSearchParams(p);
                  }}
                  className="hover:text-rust font-bold"
                  aria-label="Remove in stock filter"
                >
                  &times;
                </button>
              </span>
            )}

            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-forest hover:underline font-semibold ml-2"
            >
              Clear all
            </button>
          </div>
        )}
      </section>

      {/* ==================== PRODUCT GRID ==================== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pb-20">
        {loading ? (
          <div className="py-20 text-center text-ink-soft">
            <p className="text-lg animate-pulse">Loading products...</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-ink-soft bg-surface border border-hairline rounded-md max-w-lg mx-auto p-8 space-y-4">
            <p className="text-lg font-bold text-white">Failed to load products</p>
            <p className="text-sm text-rust">{error}</p>
            <button
              onClick={loadProducts}
              className="bg-forest text-black hover:bg-forest-dark rounded-sm px-6 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="py-16 text-center text-ink-soft bg-surface border border-hairline rounded-md max-w-lg mx-auto p-8 space-y-4">
            <p className="text-lg font-bold text-white">No products found</p>
            <p className="text-sm">There are no products matching your selected filter criteria.</p>
            <button
              onClick={resetFilters}
              className="inline-block bg-forest text-black hover:bg-forest-dark rounded-sm px-6 py-2.5 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <div id="product-grid" className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 sm:gap-x-6 gap-y-8 sm:gap-y-10">
            {filteredAndSortedProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

        )}
      </section>
    </main>
  );
}
