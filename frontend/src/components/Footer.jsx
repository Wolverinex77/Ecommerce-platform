import { Link } from "react-router-dom";

/**
 * Footer — Site-wide footer with branding, shop links, and help links.
 * Ported from the <footer> in both index.html and products.html.
 */
export default function Footer() {
  return (
    <footer id="footer" className="site-footer bg-[#050505] border-t border-hairline text-white">
      <div className="footer-content max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 grid grid-cols-1 sm:grid-cols-3 gap-10">
        <section className="footer-brand" aria-labelledby="footer-brand-title">
          <h2 id="footer-brand-title" className="font-display text-2xl font-bold">ShopEase</h2>
          <p className="mt-2 text-sm text-ink-soft">Thoughtful goods for a life well lived.</p>
        </section>

        <nav className="footer-navigation grid grid-cols-2 gap-10 sm:col-span-2" aria-label="Footer navigation">
          <section aria-labelledby="shop-links-title">
            <h2 id="shop-links-title" className="text-sm font-semibold tracking-wide uppercase text-forest">
              Shop Categories
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li>
                <Link to="/products" className="hover:text-white transition-colors">Shop All Products</Link>
              </li>
              <li>
                <Link to="/products?category_id=1" className="hover:text-white transition-colors">View All Clothes</Link>
              </li>
              <li>
                <Link to="/products?category_id=7" className="hover:text-white transition-colors">View All Footwear</Link>
              </li>
              <li>
                <Link to="/products?category_id=11" className="hover:text-white transition-colors">View All Accessories</Link>
              </li>
            </ul>
          </section>
          <section aria-labelledby="help-links-title">
            <h2 id="help-links-title" className="text-sm font-semibold tracking-wide uppercase text-forest">Help</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-soft">
              <li><a href="#" className="hover:text-white transition-colors">Contact us</a></li>
              <li><a href="#" className="hover:text-white transition-colors">Shipping &amp; returns</a></li>
              <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
            </ul>
          </section>
        </nav>
      </div>
      <p className="copyright text-center text-xs text-neutral-500 pb-8 border-t border-hairline/50 pt-6 max-w-7xl mx-auto">
        &copy; 2026 ShopEase. All rights reserved.
      </p>
    </footer>
  );
}
