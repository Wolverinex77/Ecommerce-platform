import { addToCart, fetchCart, getAuthToken } from "./api";

const GUEST_CART_KEY = "cart";

/**
 * Read the guest cart from localStorage.
 * Guaranteed to return an array of { product_id: number, quantity: number, variant_id: number|null }.
 * @returns {Array<{product_id: number, quantity: number, variant_id: number|null}>}
 */
export function getGuestCart() {
  try {
    const raw = localStorage.getItem(GUEST_CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    // Sanitize and validate items
    return parsed
      .map((item) => ({
        product_id: Number(item.product_id),
        quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
        variant_id:
          item.variant_id !== undefined &&
          item.variant_id !== null &&
          item.variant_id !== "null"
            ? Number(item.variant_id)
            : null,
      }))
      .filter((item) => item.product_id && !isNaN(item.product_id));
  } catch (err) {
    console.error("Error reading guest cart from localStorage:", err);
    return [];
  }
}

/**
 * Save the guest cart array to localStorage and notify listeners.
 * @param {Array<{product_id: number, quantity: number, variant_id: number|null}>} items
 */
export function saveGuestCart(items) {
  try {
    const sanitized = (items || []).map((item) => ({
      product_id: Number(item.product_id),
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      variant_id:
        item.variant_id !== undefined &&
        item.variant_id !== null &&
        item.variant_id !== "null"
          ? Number(item.variant_id)
          : null,
    }));

    localStorage.setItem(GUEST_CART_KEY, JSON.stringify(sanitized));
    window.dispatchEvent(new CustomEvent("cart-updated", { detail: sanitized }));
  } catch (err) {
    console.error("Error saving guest cart to localStorage:", err);
  }
}

/**
 * Add an item to the guest cart in localStorage.
 * Merges quantity if product_id + variant_id already exists.
 * @param {{ product_id: number, quantity?: number, variant_id?: number|null }} item
 * @returns {Array} Updated guest cart items
 */
export function addGuestCartItem({ product_id, quantity = 1, variant_id = null }) {
  const currentCart = getGuestCart();
  const targetPid = Number(product_id);
  const targetVid =
    variant_id !== undefined && variant_id !== null && variant_id !== "null"
      ? Number(variant_id)
      : null;
  const qtyToAdd = Math.max(1, parseInt(quantity, 10) || 1);

  const existingIndex = currentCart.findIndex(
    (item) =>
      item.product_id === targetPid &&
      (item.variant_id ?? null) === targetVid
  );

  if (existingIndex > -1) {
    currentCart[existingIndex].quantity += qtyToAdd;
  } else {
    currentCart.push({
      product_id: targetPid,
      quantity: qtyToAdd,
      variant_id: targetVid,
    });
  }

  saveGuestCart(currentCart);
  return currentCart;
}

/**
 * Update the quantity of a specific item in the guest cart.
 * @param {number} productId
 * @param {number|null} variantId
 * @param {number} newQuantity
 * @returns {Array} Updated guest cart items
 */
export function updateGuestCartItemQuantity(productId, variantId, newQuantity) {
  const currentCart = getGuestCart();
  const targetPid = Number(productId);
  const targetVid =
    variantId !== undefined && variantId !== null && variantId !== "null"
      ? Number(variantId)
      : null;
  const qty = parseInt(newQuantity, 10);

  if (qty < 1) {
    return removeGuestCartItem(productId, variantId);
  }

  const item = currentCart.find(
    (it) =>
      it.product_id === targetPid &&
      (it.variant_id ?? null) === targetVid
  );

  if (item) {
    item.quantity = qty;
    saveGuestCart(currentCart);
  }

  return currentCart;
}

/**
 * Remove an item from the guest cart.
 * @param {number} productId
 * @param {number|null} variantId
 * @returns {Array} Updated guest cart items
 */
export function removeGuestCartItem(productId, variantId) {
  const currentCart = getGuestCart();
  const targetPid = Number(productId);
  const targetVid =
    variantId !== undefined && variantId !== null && variantId !== "null"
      ? Number(variantId)
      : null;

  const filtered = currentCart.filter(
    (it) =>
      !(
        it.product_id === targetPid &&
        (it.variant_id ?? null) === targetVid
      )
  );

  saveGuestCart(filtered);
  return filtered;
}

/**
 * Clear the entire guest cart from localStorage.
 */
export function clearGuestCart() {
  localStorage.removeItem(GUEST_CART_KEY);
  window.dispatchEvent(new CustomEvent("cart-updated", { detail: [] }));
}

/**
 * Calculate the total item count in the guest cart.
 * @returns {number}
 */
export function getGuestCartCount() {
  const items = getGuestCart();
  return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
}

/**
 * Synchronize guest cart items with the backend after user logs in.
 * Sends guest cart items to the existing POST /cart/items API.
 * Clears localStorage only upon successful backend merge.
 * @returns {Promise<{synced: boolean, cart?: object, error?: string}>}
 */
export async function syncGuestCartWithBackend() {
  const token = getAuthToken();
  if (!token) {
    return { synced: false, error: "User is not authenticated." };
  }

  const guestItems = getGuestCart();
  if (!guestItems || guestItems.length === 0) {
    return { synced: false, message: "No guest items to synchronize." };
  }

  try {
    const payload = guestItems.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      variant_id: item.variant_id || null,
    }));

    // Send to existing backend add-to-cart API
    await addToCart(payload);

    // If successful, clear guest cart from localStorage
    clearGuestCart();

    // Fetch fresh database cart
    const updatedCart = await fetchCart();
    return { synced: true, cart: updatedCart };
  } catch (err) {
    console.error("Cart synchronization failed:", err);
    // IMPORTANT: Do NOT delete localStorage cart on failure so items are not lost
    return { synced: false, error: err.message || "Failed to sync cart" };
  }
}
