import React, { useState } from "react";
import { Link } from "react-router-dom";
import { getImageUrl } from "../services/api";

export default function ProductCard({ product }) {
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
    <article className="group min-w-0">
      <Link to={`/products/${product.id}`} className="block product-link min-w-0">
        <div
          className={`relative aspect-[4/5] bg-surface border border-hairline rounded-sm overflow-hidden ${
            isOutOfStock ? "opacity-70" : ""
          }`}
          role="img"
          aria-label={product.name}
        >
          {showImage ? (
            <img
              src={fullImageUrl}
              alt={product.name}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-surface text-ink-soft/40 p-4 select-none">
              <svg
                className="w-12 h-12 mb-2 text-ink-soft/30"
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
              <span className="text-xs text-ink-soft/50 font-medium">No image</span>
            </div>
          )}

          {hasStockInfo && (
            <span
              className={`absolute top-3 right-3 text-[11px] font-medium uppercase tracking-wide px-2 py-1 rounded-sm border border-hairline ${
                isOutOfStock
                  ? "bg-ink text-paper"
                  : "bg-surface text-ink-soft"
              }`}
            >
              {inStock ? "In stock" : "Out of stock"}
            </span>
          )}
        </div>

        <h3 className="mt-3 font-display text-base sm:text-lg leading-snug text-white group-hover:text-forest transition-colors break-words line-clamp-2">
          {product.name}
        </h3>

        <p className="mt-1 font-medium text-sm sm:text-base text-white">Rs. {formattedPrice}</p>
      </Link>
    </article>
  );

}
