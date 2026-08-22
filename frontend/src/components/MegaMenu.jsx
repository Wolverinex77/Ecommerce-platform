import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { fetchCategories } from "../services/api";

/**
 * MegaMenu — Fetches categories from the API and renders
 * the dropdown mega-menu with parent categories and subcategory links.
 * Ported from legacy categories.js
 */
export default function MegaMenu() {
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    fetchCategories()
      .then(setCategories)
      .catch((err) => console.error("Failed to load categories:", err));
  }, []);

  if (categories.length === 0) return null;

  return (
    <ul className="mega-menu">
      {categories.map((category) => (
        <li key={category.id} className="mega-menu__group">
          <div className="mega-menu__parent-header border-b border-hairline pb-2 mb-3">
            <h3 className="text-xs font-semibold uppercase text-forest">
              {category.name}
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-ink-soft">
            {category.children?.map((sub) => (
              <li key={sub.id}>
                <Link to={`/products?category_id=${sub.id}`}>{sub.name}</Link>
              </li>
            ))}
            <li className="mega-menu__shop-all pt-2 border-t border-dashed border-hairline mt-2">
              <Link
                to={`/products?category_id=${category.id}`}
                className="text-xs font-semibold text-forest hover:underline"
              >
                View All {category.name} &rarr;
              </Link>
            </li>
          </ul>
        </li>
      ))}
    </ul>
  );
}
