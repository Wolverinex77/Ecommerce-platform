import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  fetchProductById,
  fetchProducts,
  fetchProductVariants,
  fetchProductReviews,
  fetchCategories,
  findCategoryAndParent,
  getImageUrl,
  addToCart,
  getAuthToken,
} from "../services/api";
import { addGuestCartItem } from "../services/cartStorage";
import ImageZoomModal from "../components/ImageZoomModal";

export default function ProductDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [categoriesList, setCategoriesList] = useState([]);
  const [categoryInfo, setCategoryInfo] = useState(null);

  const [selectedColor, setSelectedColor] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [isZoomOpen, setIsZoomOpen] = useState(false);


  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageError, setImageError] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const [reviews, setReviews] = useState([]);

  // Load product, variants, and categories
  const loadProductData = async () => {
    setLoading(true);
    setError(null);
    setImageError(false);
    setAddedToCart(false);

    try {
      // 1. Fetch Product details
      let productData = await fetchProductById(id);

      // If GET /products/{id} has no primary_image, resolve it from fetchProducts() list
      if (!productData.primary_image) {
        try {
          const allProducts = await fetchProducts();
          const matched = allProducts.find((p) => String(p.id) === String(id));
          if (matched && matched.primary_image) {
            productData = { ...productData, primary_image: matched.primary_image };
          }
        } catch (listErr) {
          console.warn("Could not retrieve primary_image fallback:", listErr);
        }
      }

      setProduct(productData);

      // 2. Fetch Variants in parallel if available
      try {
        const variantsData = await fetchProductVariants(id);
        setVariants(variantsData || []);

        // Pre-select first variant if available
        if (variantsData && variantsData.length > 0) {
          const first = variantsData[0];
          if (first.color) setSelectedColor(first.color);
          if (first.size) setSelectedSize(first.size);
        }
      } catch {
        setVariants([]);
      }

      // 3. Fetch Categories for breadcrumb resolution
      try {
        const cats = await fetchCategories();
        setCategoriesList(cats);
        if (productData.category_id) {
          const match = findCategoryAndParent(cats, productData.category_id);
          setCategoryInfo(match);
        }
      } catch (catErr) {
        console.warn("Could not load categories for breadcrumb:", catErr);
      }

      // 4. Fetch Reviews
      try {
        const reviewsData = await fetchProductReviews(id);
        setReviews(reviewsData || []);
      } catch {
        setReviews([]);
      }

      setLoading(false);
    } catch (err) {
      console.error("Error loading product details:", err);
      setError(err.message || "Failed to load product details");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProductData();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [id]);

  // Determine inventory type
  const isVariantType =
    (product?.inventory_type &&
      String(product.inventory_type).toLowerCase().includes("var")) ||
    (variants && variants.length > 0);

  // Extract unique colors and sizes for variant products
  const availableColors = Array.from(
    new Set(variants.map((v) => v.color).filter(Boolean))
  );
  const availableSizes = Array.from(
    new Set(variants.map((v) => v.size).filter(Boolean))
  );

  // Find currently matched variant
  const selectedVariant = isVariantType
    ? variants.find((v) => {
      const colorMatch = !selectedColor || v.color === selectedColor;
      const sizeMatch = !selectedSize || v.size === selectedSize;
      return colorMatch && sizeMatch;
    })
    : null;

  // Determine stock availability
  let isOutOfStock = false;
  let stockDisplay = null;

  if (isVariantType) {
    if (selectedVariant) {
      if (selectedVariant.quantity !== null && selectedVariant.quantity !== undefined) {
        isOutOfStock = selectedVariant.quantity <= 0;
        stockDisplay = `${selectedVariant.quantity} in stock`;
      } else {
        isOutOfStock = false;
        stockDisplay = "In stock";
      }
    } else if (variants.length > 0) {
      isOutOfStock = !variants.some(
        (v) => v.quantity === null || v.quantity === undefined || v.quantity > 0
      );
      stockDisplay = isOutOfStock ? "Out of stock" : "In stock";
    }
  } else {
    // Simple product
    if (product?.stock_quantity !== null && product?.stock_quantity !== undefined) {
      isOutOfStock = product.stock_quantity <= 0;
      stockDisplay = `${product.stock_quantity} in stock`;
    } else {
      isOutOfStock = false;
      stockDisplay = "In stock";
    }
  }

  // Image list handling — prioritize primary_image
  const rawImages = [];
  if (product?.primary_image) {
    rawImages.push(product.primary_image);
  }
  if (product?.images && Array.isArray(product.images)) {
    for (const img of product.images) {
      const url = typeof img === "string" ? img : img.image_url;
      if (url && !rawImages.includes(url)) {
        rawImages.push(url);
      }
    }
  }
  if (rawImages.length === 0 && product?.image_url) {
    rawImages.push(product.image_url);
  }

  // Bind image strictly to selected variant / color
  let activeRawImage = null;
  const targetVariantId = selectedVariant?.id;

  // 1. Match by exact variant_id in product.images
  if (targetVariantId && product?.images && Array.isArray(product.images)) {
    const variantImg = product.images.find(
      (img) => typeof img === "object" && img !== null && img.variant_id === targetVariantId
    );
    if (variantImg) {
      activeRawImage = typeof variantImg === "object" ? variantImg.image_url : variantImg;
    }
  }

  // 1.5. Match by selected color in product.images via linked variant metadata
  if (!activeRawImage && selectedColor && product?.images && Array.isArray(product.images)) {
    const colorNorm = selectedColor.trim().toLowerCase();
    const colorImg = product.images.find((img) => {
      if (typeof img !== "object" || !img) return false;
      if (img.variant && img.variant.color) {
        return img.variant.color.trim().toLowerCase() === colorNorm;
      }
      if (img.variant_id && Array.isArray(variants)) {
        const v = variants.find((item) => item.id === img.variant_id);
        if (v && v.color) {
          return v.color.trim().toLowerCase() === colorNorm;
        }
      }
      return false;
    });
    if (colorImg) {
      activeRawImage = colorImg.image_url;
    }
  }

  // 2. Match by selected color name in rawImages
  if (!activeRawImage && selectedColor && rawImages.length > 0) {
    const matchByColorName = rawImages.find(
      (img) =>
        typeof img === "string" &&
        img.toLowerCase().includes(selectedColor.toLowerCase())
    );
    if (matchByColorName) {
      activeRawImage = matchByColorName;
    } else if (availableColors.length > 0) {
      const colorIdx = availableColors.indexOf(selectedColor);
      if (colorIdx !== -1 && rawImages[colorIdx]) {
        activeRawImage = rawImages[colorIdx];
      }
    }
  }

  // 3. Fallback to first image or primary image
  if (!activeRawImage) {
    activeRawImage = rawImages[0] || product?.primary_image || product?.image_url;
  }



  const activeImageUrl = getImageUrl(activeRawImage);

  // Price formatting
  const formattedPrice =
    product?.price !== undefined && product?.price !== null
      ? typeof product.price === "number" || !isNaN(Number(product.price))
        ? Number(product.price).toLocaleString("en-PK")
        : product.price
      : "0";

  // Quantity handlers
  const handleQuantityChange = (delta) => {
    setQuantity((prev) => {
      const next = prev + delta;
      return next < 1 ? 1 : next;
    });
  };

  const handleAddToCart = async () => {
    if (isOutOfStock) return;
    if (isVariantType && availableColors.length > 0 && !selectedColor) {
      alert("Please select a color before adding to cart.");
      return;
    }
    if (isVariantType && availableSizes.length > 0 && !selectedSize) {
      alert("Please select a size before adding to cart.");
      return;
    }

    const vid = selectedVariant?.id || null;

    if (getAuthToken()) {
      try {
        await addToCart([
          {
            product_id: product.id,
            variant_id: vid,
            quantity: quantity,
          },
        ]);
        window.dispatchEvent(new CustomEvent("cart-updated"));
      } catch (err) {
        if (err.message === "UNAUTHORIZED") {
          // Token expired or invalid: save to guest cart
          addGuestCartItem({
            product_id: product.id,
            variant_id: vid,
            quantity: quantity,
          });
          window.dispatchEvent(new CustomEvent("cart-updated"));
        } else {
          console.warn("Backend add to cart error:", err);
          alert(
            err.message === "Failed to fetch"
              ? "Unable to connect to the backend server. Please make sure the backend API is reachable."
              : err.message || "Failed to add item to cart."
          );
          return;
        }
      }
    } else {
      // Guest mode: save to localStorage
      addGuestCartItem({
        product_id: product.id,
        variant_id: vid,
        quantity: quantity,
      });
    }

    setAddedToCart(true);
    window.dispatchEvent(new CustomEvent("open-cart-drawer"));
    setTimeout(() => setAddedToCart(false), 3000);
  };





  // ==================== LOADING STATE ====================
  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="animate-pulse space-y-8">
          <div className="h-4 bg-surface rounded w-48 border border-hairline"></div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-5 max-w-md w-full mx-auto lg:mx-0 aspect-[4/5] max-h-[440px] bg-surface rounded-md border border-hairline"></div>
            <div className="lg:col-span-7 space-y-6">
              <div className="h-8 bg-surface rounded w-3/4 border border-hairline"></div>
              <div className="h-6 bg-surface rounded w-1/3 border border-hairline"></div>
              <div className="h-24 bg-surface rounded border border-hairline"></div>
              <div className="h-12 bg-surface rounded border border-hairline"></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ==================== ERROR / 404 STATE ====================
  if (error || !product) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="bg-surface border border-hairline rounded-lg p-10 shadow-2xl">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-rust/10 flex items-center justify-center text-rust">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white mb-2">
            Product Not Found
          </h1>
          <p className="text-ink-soft text-sm sm:text-base max-w-md mx-auto mb-6">
            {error || "The product you are looking for does not exist or may have been removed."}
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={() => navigate("/products")}
              className="bg-forest text-black hover:bg-forest-dark px-6 py-2.5 rounded-sm text-sm font-semibold transition-colors"
            >
              Browse All Products
            </button>
            <button
              onClick={loadProductData}
              className="border border-hairline text-white hover:border-forest px-6 py-2.5 rounded-sm text-sm font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </main>
    );
  }

  const categoryName = categoryInfo?.category?.name || "Catalog";

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* ==================== BREADCRUMB ==================== */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center flex-wrap gap-2 text-xs text-ink-soft">
          <li>
            <Link to="/" className="hover:text-forest transition-colors">
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-hairline">/</li>
          <li>
            <Link to="/products" className="hover:text-forest transition-colors">
              Products
            </Link>
          </li>
          {product.category_id && (
            <>
              <li aria-hidden="true" className="text-hairline">/</li>
              <li>
                <Link
                  to={`/products?category_id=${product.category_id}`}
                  className="hover:text-forest transition-colors"
                >
                  {categoryName}
                </Link>
              </li>
            </>
          )}
          <li aria-hidden="true" className="text-hairline">/</li>
          <li aria-current="page" className="text-white font-medium truncate max-w-xs sm:max-w-md">
            {product.name}
          </li>
        </ol>
      </nav>      {/* ==================== MAIN PRODUCT SECTION ==================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* ==================== LEFT: SINGLE HERO IMAGE (COLOR-BOUND WITH ZOOM) ==================== */}
        <div className="lg:col-span-5 max-w-md w-full mx-auto lg:mx-0 space-y-4 min-w-0">
          <div
            onClick={() => activeImageUrl && !imageError && setIsZoomOpen(true)}
            className={`relative aspect-[4/5] max-h-[440px] bg-surface border border-hairline rounded-md overflow-hidden shadow-xl group ${
              activeImageUrl && !imageError ? "cursor-zoom-in" : ""
            }`}
            title={activeImageUrl && !imageError ? "Click to open full zoom viewer" : ""}
          >
            {activeImageUrl && !imageError ? (
              <>
                <img
                  src={activeImageUrl}
                  alt={`${product.name} ${selectedColor ? `- ${selectedColor}` : ""}`}
                  onError={() => setImageError(true)}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                {/* Zoom Hint Icon on Hover */}
                <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/70 border border-hairline rounded-sm p-1.5 text-white flex items-center gap-1.5 backdrop-blur-md pointer-events-none">
                  <svg className="w-4 h-4 text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                  </svg>
                  <span className="text-[11px] font-semibold tracking-wide">Zoom</span>
                </div>
              </>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-ink-soft/40 p-8 select-none">
                <svg
                  className="w-16 h-16 mb-2 text-ink-soft/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <span className="text-xs text-ink-soft/60 font-medium">Image not available</span>
              </div>
            )}

            {/* Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 pointer-events-none">
              {product.is_featured && (
                <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-forest text-black px-2 py-0.5 rounded-sm shadow-md">
                  Featured
                </span>
              )}
              <span
                className={`inline-flex items-center text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-sm border backdrop-blur-md ${isOutOfStock
                    ? "bg-black/70 text-rust border-rust/30"
                    : "bg-black/70 text-forest border-forest/30"
                  }`}
              >
                {isOutOfStock ? "Out of Stock" : "In Stock"}
              </span>
            </div>
          </div>
        </div>

        {/* ==================== RIGHT: PRODUCT INFO & PURCHASE (7 COLS) ==================== */}
        <div className="lg:col-span-7 space-y-6 min-w-0">
          {/* Header & Title */}

          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-forest mb-2">
              {categoryName}
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">
              {product.name}
            </h1>
          </div>

          {/* Price & Stock Pill */}
          <div className="flex items-baseline gap-4 border-b border-hairline pb-6">
            <div className="font-sans font-bold text-3xl text-white">
              Rs. {formattedPrice}
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-sm border ${isOutOfStock
                  ? "bg-rust/10 text-rust border-rust/30"
                  : "bg-forest/10 text-forest border-forest/30"
                }`}
            >
              {stockDisplay}
            </span>
          </div>

          {/* ==================== ATTRIBUTES & VARIANTS SECTION ==================== */}

          {isVariantType && (
            <div className="space-y-5">


              {/* Color Selector */}
              {availableColors.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-sm font-bold uppercase tracking-wider text-white">
                      Color: <span className="text-forest font-semibold ml-1">{selectedColor || "Select"}</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {availableColors.map((color) => {
                      const isSelected = selectedColor === color;
                      return (
                        <button
                          key={color}
                          type="button"
                          onClick={() => {
                            setSelectedColor(color);
                            setImageError(false);
                          }}
                          className={`px-4 py-2.5 text-sm font-semibold rounded-sm border transition-all ${isSelected
                              ? "bg-forest text-black border-forest font-bold shadow-md ring-1 ring-forest/50"
                              : "bg-surface text-white border-hairline hover:border-forest"
                            }`}
                        >
                          {color}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Size Selector */}
              {availableSizes.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <label className="text-sm font-bold uppercase tracking-wider text-white">
                      Size: <span className="text-forest font-semibold ml-1">{selectedSize || "Select"}</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2.5">
                    {availableSizes.map((size) => {
                      const isSelected = selectedSize === size;
                      return (
                        <button
                          key={size}
                          type="button"
                          onClick={() => setSelectedSize(size)}
                          className={`min-w-[46px] h-[44px] px-4 flex items-center justify-center text-sm font-bold rounded-sm border transition-all ${isSelected
                              ? "bg-forest text-black border-forest font-bold shadow-md ring-1 ring-forest/50"
                              : "bg-surface text-white border-hairline hover:border-forest"
                            }`}
                        >
                          {size}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Fixed Attributes for Simple Products when color or size is provided */}
          {!isVariantType && (product?.color || product?.size) && (
            <div className="flex flex-wrap gap-6 pt-3 border-t border-hairline text-sm">
              {product.color && (
                <div className="flex items-center gap-2">
                  <span className="text-ink font-bold uppercase tracking-wider text-xs">Color:</span>
                  <span className="text-white font-bold text-sm bg-surface px-3 py-1 rounded-sm border border-hairline">{product.color}</span>
                </div>
              )}
              {product.size && (
                <div className="flex items-center gap-2">
                  <span className="text-ink font-bold uppercase tracking-wider text-xs">Size:</span>
                  <span className="text-white font-bold text-sm bg-surface px-3 py-1 rounded-sm border border-hairline">{product.size}</span>
                </div>
              )}
            </div>
          )}

          {/* Quantity Selector & Add to Cart */}
          <div className="space-y-3 pt-2 border-t border-hairline">
            <label className="text-xs font-semibold uppercase tracking-wider text-ink block">
              Quantity
            </label>
            <div className="flex flex-col sm:flex-row items-stretch gap-3">
              {/* Stepper */}
              <div className="flex items-center border border-hairline rounded-sm bg-surface">
                <button
                  type="button"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1 || isOutOfStock}
                  className="w-11 h-11 flex items-center justify-center text-white hover:text-forest disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Decrease quantity"
                >
                  &minus;
                </button>
                <span className="w-12 text-center text-sm font-semibold text-white">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => handleQuantityChange(1)}
                  disabled={isOutOfStock}
                  className="w-11 h-11 flex items-center justify-center text-white hover:text-forest disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Increase quantity"
                >
                  &#43;
                </button>
              </div>

              {/* Add to Cart Button */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={isOutOfStock}
                className={`flex-1 py-3.5 px-6 rounded-sm text-sm font-semibold tracking-wide uppercase transition-all shadow-lg flex items-center justify-center gap-2 ${isOutOfStock
                    ? "bg-surface border border-hairline text-ink-soft cursor-not-allowed"
                    : addedToCart
                      ? "bg-forest text-black"
                      : "bg-forest text-black hover:bg-forest-dark"
                  }`}
              >
                {addedToCart ? (
                  <>
                    <svg className="w-5 h-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    Added to Cart!
                  </>
                ) : isOutOfStock ? (
                  "Out of Stock"
                ) : (
                  "Add to Cart"
                )}
              </button>
            </div>
          </div>

          {/* ==================== TRUST & VALUE PROPOSITIONS ==================== */}
          <div className="border-t border-hairline pt-6 grid grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <svg className="w-5 h-5 mx-auto text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
              <p className="text-[11px] font-medium text-white">Fast Delivery</p>
              <p className="text-[10px] text-ink-soft">2-4 business days</p>
            </div>
            <div className="space-y-1">
              <svg className="w-5 h-5 mx-auto text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <p className="text-[11px] font-medium text-white">100% Authentic</p>
              <p className="text-[10px] text-ink-soft">Direct from source</p>
            </div>
            <div className="space-y-1">
              <svg className="w-5 h-5 mx-auto text-forest" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <p className="text-[11px] font-medium text-white">Easy Returns</p>
              <p className="text-[10px] text-ink-soft">7-day hassle-free</p>
            </div>
          </div>

          {/* ==================== ACCORDION / ADDITIONAL DETAILS ==================== */}
          <div className="border-t border-hairline pt-4 space-y-3 text-sm">
            <details className="group border border-hairline rounded-sm bg-surface/40">
              <summary className="flex items-center justify-between p-3.5 cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-white hover:text-forest">
                <span>Shipping &amp; Delivery</span>
                <span className="transition-transform duration-200 group-open:rotate-180">&#9662;</span>
              </summary>
              <div className="p-3.5 pt-0 text-xs text-ink-soft border-t border-hairline mt-2 space-y-1">
                <p>• Standard shipping (2-4 business days) available nationwide.</p>
                <p>• Express shipping available at checkout.</p>
                <p>• Real-time tracking link sent immediately upon dispatch.</p>
              </div>
            </details>

            <details className="group border border-hairline rounded-sm bg-surface/40">
              <summary className="flex items-center justify-between p-3.5 cursor-pointer list-none text-xs font-semibold uppercase tracking-wider text-white hover:text-forest">
                <span>Care &amp; Specifications</span>
                <span className="transition-transform duration-200 group-open:rotate-180">&#9662;</span>
              </summary>
              <div className="p-3.5 pt-0 text-xs text-ink-soft border-t border-hairline mt-2 space-y-1">
                <p>• Machine wash cold inside out with similar colors.</p>
                <p>• Do not tumble dry. Line dry in shade.</p>
                <p>• Made with premium ethically-sourced materials.</p>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* ==================== ABOUT THIS ITEM ==================== */}
      <section className="mt-14 border-t border-hairline pt-10">
        <h2 className="font-display text-2xl font-bold text-white mb-6 flex items-center gap-2.5">
          <svg className="w-5 h-5 text-forest flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          About This Item
        </h2>

        {product.description ? (
          <div className="text-sm sm:text-base text-ink-soft leading-relaxed whitespace-pre-line max-w-4xl">
            {product.description}
          </div>
        ) : (
          <p className="text-sm text-ink-soft italic">No description available for this item.</p>
        )}
      </section>

      {/* ==================== CUSTOMER REVIEWS ==================== */}
      <section className="mt-14 border-t border-hairline pt-10 pb-4">
        <h2 className="font-display text-2xl font-bold text-white mb-6 flex items-center gap-2.5">
          <svg className="w-5 h-5 text-forest flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          Customer Reviews
          {reviews.length > 0 && (
            <span className="text-sm font-normal text-ink-soft ml-1">
              ({reviews.length} {reviews.length === 1 ? "review" : "reviews"})
            </span>
          )}
        </h2>

        {reviews.length === 0 ? (
          /* ---- Empty State ---- */
          <div className="bg-surface border border-hairline rounded-lg p-10 text-center">
            <div className="flex justify-center mb-4">
              {[...Array(5)].map((_, i) => (
                <svg
                  key={i}
                  className="w-6 h-6 text-hairline"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              ))}
            </div>
            <h3 className="text-lg font-semibold text-white mb-1.5">No Reviews Yet</h3>
            <p className="text-sm text-ink-soft max-w-sm mx-auto">
              Be the first to share your thoughts on this product. Your feedback helps other shoppers make informed decisions.
            </p>
          </div>
        ) : (
          /* ---- Reviews List ---- */
          <div className="space-y-5">
            {/* Overall Summary Bar */}
            {(() => {
              const rated = reviews.filter((r) => r.rating != null);
              if (rated.length === 0) return null;
              const avg = rated.reduce((s, r) => s + r.rating, 0) / rated.length;
              return (
                <div className="flex items-center gap-4 bg-surface border border-hairline rounded-lg px-5 py-4 mb-2">
                  <div className="text-3xl font-bold text-white">{avg.toFixed(1)}</div>
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <svg
                        key={i}
                        className={`w-5 h-5 ${i < Math.round(avg) ? "text-amber-400" : "text-hairline"}`}
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    ))}
                  </div>
                  <span className="text-sm text-ink-soft">
                    Based on {rated.length} {rated.length === 1 ? "review" : "reviews"}
                  </span>
                </div>
              );
            })()}

            {/* Individual Review Cards */}
            {reviews.map((review, idx) => (
              <div
                key={review.id || idx}
                className="bg-surface border border-hairline rounded-lg p-5 space-y-2.5"
              >
                {/* Header: stars + date */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {review.rating != null && (
                      <div className="flex items-center gap-0.5">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${i < review.rating ? "text-amber-400" : "text-hairline"}`}
                            fill="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                          </svg>
                        ))}
                      </div>
                    )}
                    {review.customer_name && (
                      <span className="text-sm font-semibold text-white">{review.customer_name}</span>
                    )}
                    {review.verified && (
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-forest bg-forest/10 border border-forest/20 px-1.5 py-0.5 rounded-sm">
                        Verified
                      </span>
                    )}
                  </div>
                  {review.created_at && (
                    <span className="text-xs text-ink-soft">
                      {new Date(review.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>

                {/* Title */}
                {review.title && (
                  <h4 className="text-sm font-semibold text-white">{review.title}</h4>
                )}

                {/* Body */}
                {review.comment && (
                  <p className="text-sm text-ink-soft leading-relaxed">{review.comment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ==================== LIGHTBOX IMAGE ZOOM MODAL ==================== */}
      <ImageZoomModal
        isOpen={isZoomOpen}
        onClose={() => setIsZoomOpen(false)}
        images={rawImages.length > 0 ? rawImages : [activeRawImage].filter(Boolean)}
        initialIndex={
          rawImages.indexOf(activeRawImage) !== -1
            ? rawImages.indexOf(activeRawImage)
            : 0
        }
        productName={product.name}
      />
    </main>
  );
}

