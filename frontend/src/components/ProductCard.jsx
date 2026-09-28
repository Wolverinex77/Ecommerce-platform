import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getImageUrl } from "../services/api";

export default function ProductCard({ product, featured = false }) {
  const [imageError, setImageError] = useState(false);

  if (!product) return null;

  // Handle both primary_image (from backend ProductResponse) and fallback image_url
  const rawImage = product.primary_image || product.image_url;
  const fullImageUrl = getImageUrl(rawImage);
  const showImage = Boolean(fullImageUrl && !imageError);

  const hasStockInfo = product.stock_quantity !== undefined && product.stock_quantity !== null;
  const isOutOfStock = hasStockInfo && product.stock_quantity <= 0;
  const inStock = !hasStockInfo || product.stock_quantity > 0;

  const formattedPrice =
    product.price !== undefined && product.price !== null
      ? typeof product.price === "number" || !isNaN(Number(product.price))
        ? Number(product.price).toLocaleString("en-PK")
        : product.price
      : "0";

  return (
    <article className="group min-w-0 w-full flex flex-col h-full">
      <Link to={`/products/${product.id}`} className="block product-link min-w-0 w-full flex-1 flex flex-col">
        {/* Image Container with strict 3/4 fashion ratio and smooth hover zoom */}
        <div
          className={`relative w-full aspect-[3/4] bg-neutral-900 border border-hairline overflow-hidden rounded-xl transition-all duration-300 group-hover:border-white/20 group-hover:shadow-xl ${
            featured
              ? "min-h-[380px] xs:min-h-[420px] md:min-h-0"
              : ""
          } ${isOutOfStock ? "opacity-70" : ""}`}
          role="img"
          aria-label={product.name}
        >
          {showImage ? (
            <img
              src={fullImageUrl}
              alt={product.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900 text-neutral-500 p-4 select-none">
              <svg
                className="w-10 h-10 mb-2 text-neutral-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.2"
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <span className="text-xs text-neutral-400 font-medium">No image</span>
            </div>
          )}

          {/* Badge: Top Right */}
          {hasStockInfo && (
            <span
              className={`absolute top-3 right-3 text-[11px] uppercase tracking-wider font-medium px-2.5 py-1 rounded-full backdrop-blur-md border shadow-sm ${
                isOutOfStock
                  ? "bg-black/80 text-neutral-400 border-white/10"
                  : "bg-black/60 text-neutral-300 border-white/10"
              }`}
            >
              {inStock ? "In stock" : "Out of stock"}
            </span>
          )}

          {/* Desktop Quick-Action Hover Button: slides up smoothly */}
          <div className="absolute bottom-3 inset-x-3 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 py-2.5 bg-white text-black font-medium text-xs tracking-wider uppercase rounded-lg shadow-lg hover:bg-neutral-200 text-center pointer-events-none hidden md:block">
            Quick View
          </div>
        </div>

        {/* Clean Info Below Image */}
        <div className="mt-3 flex flex-col justify-between flex-1">
          <h3
            className={`font-sans text-sm font-medium text-white group-hover:text-neutral-300 transition-colors break-words ${
              featured
                ? "text-xl sm:text-2xl md:text-sm line-clamp-2 md:line-clamp-1"
                : "line-clamp-1"
            }`}
          >
            {product.name}
          </h3>

          <p className="text-sm font-semibold text-neutral-200 mt-1">
            Rs. {formattedPrice}
          </p>

          {/* Mobile Featured Action Button */}
          {featured && (
            <div className="pt-3 md:hidden">
              <span className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg bg-white hover:bg-neutral-100 text-black font-bold text-sm tracking-wide shadow-md active:scale-[0.98] transition-all">
                <span>View Product</span>
                <svg
                  className="w-4 h-4 transition-transform group-hover:translate-x-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </span>
            </div>
          )}
        </div>
      </Link>
    </article>
  );
}
