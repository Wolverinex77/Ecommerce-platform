import React from "react";
import { Link } from "react-router-dom";

export default function HeroSection({
  categoryInfo,
  productCount,
  categoryId,
}) {
  const { category, parent } = categoryInfo || {};

  const eyebrow = category
    ? parent
      ? `${parent.name} Collection`
      : `${category.name} Collection`
    : "The full collection";

  const title = category ? category.name : "Shop All";

  const description = category
    ? `Explore our curated selection of ${category.name.toLowerCase()} — thoughtfully crafted with quality materials and designed for everyday versatility.`
    : "Every product we carry, in one place — built with honest materials and chosen for how they wear, not just how they look on day one. Use the filters to narrow things down by category, price, or size.";

  return (
    <section className="bg-[#121212] border-b border-hairline py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="mb-4">
          <ol className="flex items-center gap-2 text-xs text-ink-soft">
            <li>
              <Link to="/" className="hover:text-forest hover:underline">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            {parent && (
              <>
                <li>
                  <Link
                    to={`/products?category_id=${parent.id}`}
                    className="hover:text-forest hover:underline"
                  >
                    {parent.name}
                  </Link>
                </li>
                <li aria-hidden="true">/</li>
              </>
            )}
            <li aria-current="page" className="text-white">
              {title}
            </li>
          </ol>
        </nav>

        {/* Hero Title & Description */}
        <div className="max-w-3xl">
          <p className="text-xs font-semibold tracking-[0.14em] uppercase text-forest mb-2">
            {eyebrow}
          </p>
          <h1 className="font-display font-bold text-4xl sm:text-5xl text-white">
            {title}
          </h1>
          <p className="mt-4 text-ink-soft text-base sm:text-lg leading-relaxed">
            {description}
          </p>
        </div>

        {/* Product Count Pill */}
        <div className="mt-6">
          <span className="inline-flex items-center text-xs text-ink-soft bg-surface border border-hairline px-3 py-1.5 rounded-sm">
            Showing&nbsp;
            <span className="text-white font-medium">{productCount}</span>
            &nbsp;{productCount === 1 ? "product" : "products"}
          </span>
        </div>
      </div>
    </section>
  );
}
