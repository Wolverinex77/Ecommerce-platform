const rawApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || "http://localhost:8000";
export const API_URL = rawApiUrl.replace(/\/+$/, "");
export const API_BASE = API_URL;

/**
 * Construct full image URL from backend image path.
 * Handles relative paths like '/uploads/products/image.jpg' as well as absolute URLs.
 * @param {string|null} imagePath
 * @returns {string|null}
 */
export function getImageUrl(imagePath) {
  if (!imagePath) return null;
  if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
    return imagePath;
  }
  const normalizedPath = imagePath.startsWith("/") ? imagePath : `/${imagePath}`;
  return `${API_URL}${normalizedPath}`;
}

/**
 * Resolve the most specific image for a cart item, prioritizing variant-specific images.
 * @param {object} item - Cart item object (with product, variant, variant_id, etc.)
 * @returns {string|null} Full image URL
 */
export function getCartItemImageUrl(item) {
  if (!item) return null;

  // 1. Direct custom image on item
  if (item.image_url) return getImageUrl(item.image_url);
  if (item.variant_image) return getImageUrl(item.variant_image);

  const product = item.product;
  if (!product) return null;

  const targetVariantId = item.variant_id ?? item.variant?.id ?? null;
  const targetColor = (item.variant?.color || item.color || "").trim().toLowerCase();

  // 2. Search product.images
  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    // 2a. Match strictly by variant_id
    if (targetVariantId) {
      const variantImage = product.images.find(
        (img) => typeof img === "object" && img !== null && img.variant_id === targetVariantId
      );
      if (variantImage) {
        return getImageUrl(typeof variantImage === "object" ? variantImage.image_url : variantImage);
      }
    }

    // 2b. Match by image's linked variant color (img.variant.color)
    if (targetColor) {
      const colorImageByVariant = product.images.find((img) => {
        if (typeof img !== "object" || !img) return false;
        if (img.variant && img.variant.color) {
          return img.variant.color.trim().toLowerCase() === targetColor;
        }
        if (img.variant_id && Array.isArray(product.variants)) {
          const matchedVar = product.variants.find((v) => v.id === img.variant_id);
          if (matchedVar && matchedVar.color) {
            return matchedVar.color.trim().toLowerCase() === targetColor;
          }
        }
        return false;
      });

      if (colorImageByVariant) {
        return getImageUrl(colorImageByVariant.image_url);
      }
    }

    // 2c. Match by color name in image URL
    if (targetColor) {
      const colorImageByUrl = product.images.find((img) => {
        const url = typeof img === "object" ? img.image_url : img;
        return typeof url === "string" && url.toLowerCase().includes(targetColor);
      });
      if (colorImageByUrl) {
        return getImageUrl(typeof colorImageByUrl === "object" ? colorImageByUrl.image_url : colorImageByUrl);
      }
    }

    // 2d. Fallback to primary image
    const primary = product.images.find((img) => typeof img === "object" && img.is_primary);
    if (primary) {
      return getImageUrl(typeof primary === "object" ? primary.image_url : primary);
    }

    // 2e. Fallback to first image
    const first = product.images[0];
    if (first) {
      return getImageUrl(typeof first === "object" ? first.image_url : first);
    }
  }

  // 3. Fallback to product.primary_image or product.image_url
  if (product.primary_image) return getImageUrl(product.primary_image);
  if (product.image_url) return getImageUrl(product.image_url);

  return null;
}



/**
 * Fetch all categories (tree structure with children).
 * @returns {Promise<Array>} Array of category objects with nested children
 */
export async function fetchCategories() {
  const response = await fetch(`${API_URL}/categories`);
  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch products, optionally filtered by category, price, and stock.
 * Supports both an object of filter parameters and a legacy numeric categoryId.
 * @param {object|number|string|null} params - Filter options or category ID
 * @returns {Promise<Array>} Array of product objects
 */
export async function fetchProducts(params = null) {
  let url = `${API_URL}/products`;

  if (params) {
    if (typeof params === "number" || (typeof params === "string" && !isNaN(Number(params)))) {
      url += `?category_id=${params}`;
    } else if (typeof params === "object") {
      const searchParams = new URLSearchParams();
      if (params.category_id !== undefined && params.category_id !== null && params.category_id !== "") {
        searchParams.append("category_id", params.category_id);
      }
      if (params.min_price !== undefined && params.min_price !== null && params.min_price !== "") {
        searchParams.append("min_price", params.min_price);
      }
      if (params.max_price !== undefined && params.max_price !== null && params.max_price !== "") {
        searchParams.append("max_price", params.max_price);
      }
      if (params.in_stock !== undefined && params.in_stock !== null && params.in_stock !== "") {
        searchParams.append("in_stock", params.in_stock);
      }
      if (params.size !== undefined && params.size !== null && params.size !== "") {
        searchParams.append("size", params.size);
      }
      const qs = searchParams.toString();
      if (qs) {
        url += `?${qs}`;
      }
    }
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch products: ${response.status}`);
  }
  return response.json();
}


/**
 * Fetch a single product by ID.
 * @param {number|string} id - Product ID
 * @returns {Promise<object>} Product object
 */
export async function fetchProductById(id) {
  const response = await fetch(`${API_URL}/products/${id}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Product not found");
    }
    throw new Error(`Failed to fetch product: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch variants for a product by ID.
 * @param {number|string} id - Product ID
 * @returns {Promise<Array>} List of product variants
 */
export async function fetchProductVariants(id) {
  try {
    const response = await fetch(`${API_URL}/products/${id}/variants`);
    if (!response.ok) {
      return [];
    }
    return response.json();
  } catch (err) {
    console.warn("Could not fetch product variants:", err);
    return [];
  }
}

/**
 * Find a category and its parent within a nested category tree.
 * @param {Array} nodes - Category tree nodes
 * @param {number} targetId - The category ID to find
 * @param {object|null} parent - Parent node (used in recursion)
 * @returns {{ category: object, parent: object|null } | null}
 */
export function findCategoryAndParent(nodes, targetId, parent = null) {
  for (const node of nodes) {
    if (node.id === targetId) {
      return { category: node, parent };
    }
    if (node.children && node.children.length > 0) {
      const found = findCategoryAndParent(node.children, targetId, node);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Fetch reviews for a product.
 * Falls back gracefully if the reviews endpoint doesn't exist yet.
 * @param {number|string} productId - Product ID
 * @returns {Promise<Array>} List of review objects
 */
export async function fetchProductReviews(productId) {
  try {
    const response = await fetch(`${API_URL}/reviews?product_id=${productId}`);
    if (!response.ok) {
      return [];
    }
    return response.json();
  } catch (err) {
    console.warn("Could not fetch product reviews:", err);
    return [];
  }
}

/**
 * Delete a product image (admin only).
 * @param {number|string} imageId - Product Image ID
 * @param {number|string|null} productId - Optional Product ID
 */
export async function deleteProductImage(imageId, productId = null) {
  const url = productId
    ? `${API_URL}/products/${productId}/images/${imageId}`
    : `${API_URL}/products/images/${imageId}`;
  const response = await fetch(url, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("UNAUTHORIZED");
    if (response.status === 403) throw new Error("ADMIN_REQUIRED");
    if (response.status === 404) throw new Error("Image not found");
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete product image");
  }
  return true;
}


/**
 * Auth Token Management
 */
export function getAuthToken() {
  return localStorage.getItem("token") || localStorage.getItem("access_token") || "";
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
  }
}

export function getAuthHeaders() {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch current user's cart.
 */
export async function fetchCart() {
  const response = await fetch(`${API_URL}/cart/`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    throw new Error(`Failed to fetch cart: ${response.status}`);
  }
  return response.json();
}

/**
 * Add items to cart.
 * @param {Array<{product_id: number, variant_id?: number|null, quantity: number}>} products
 */
export async function addToCart(products) {
  const response = await fetch(`${API_URL}/cart/items`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({ products }),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to add to cart: ${response.status}`);
  }
  return response.json();
}

/**
 * Update a cart item quantity.
 * @param {number} itemId
 * @param {number} quantity
 */
export async function updateCartItemQuantity(itemId, quantity) {
  const response = await fetch(`${API_URL}/cart/items/${itemId}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ quantity }),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to update quantity: ${response.status}`);
  }
  return response.json();
}

/**
 * Delete a specific cart item.
 * @param {number} itemId
 */
export async function deleteCartItem(itemId) {
  const response = await fetch(`${API_URL}/cart/items/${itemId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to delete cart item: ${response.status}`);
  }
  return true;
}

/**
 * Clear all cart items.
 */
export async function clearCart() {
  const response = await fetch(`${API_URL}/cart/`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to clear cart: ${response.status}`);
  }
  return true;
}

/**
 * Fetch checkout summary preview (GET /cart/checkout).
 */
export async function fetchCheckoutSummary() {
  const response = await fetch(`${API_URL}/cart/checkout`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to fetch checkout summary: ${response.status}`);
  }
  return response.json();
}

/**
 * Create a checkout session (POST /cart/checkout).
 * @param {{
 *   shipping_address_id?: number|null,
 *   shipping_address_create?: object|null,
 *   shipping_method: 'standard' | 'express',
 *   payment_method: 'COD' | 'STRIPE'
 * }} payload
 */
export async function createCheckoutSession(payload) {
  const response = await fetch(`${API_URL}/cart/checkout`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Checkout creation failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Create an order from a checkout session (POST /orders).
 * @param {{ checkout_id: number }} payload
 */
export async function createOrder(payload) {
  const response = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Order placement failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Create payment and retrieve Safepay checkout URL (POST /orders/admin/{order_id}/payment).
 * @param {number} orderId
 * @param {{ payment_method: 'STRIPE' | 'COD' }} payload
 * @returns {Promise<{ checkout_url: string }>}
 */
export async function createOrderPayment(orderId, payload = { payment_method: "STRIPE" }) {
  const response = await fetch(`${API_URL}/orders/admin/${orderId}/payment`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Payment initiation failed: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetch payment status from backend database (GET /payment/status/{order_id}).
 * @param {number|string|object} orderId - Order ID or metadata object
 * @returns {Promise<{ payment_status: string, order_status: string }>}
 */
export async function fetchPaymentStatus(orderId) {
  let cleanId = orderId;
  if (typeof orderId === "object" && orderId !== null) {
    cleanId = orderId.value || orderId.order_id || orderId.id;
  } else if (typeof orderId === "string") {
    // If it's a stringified JSON or dict representation, extract value or number
    const match = orderId.match(/['"]?value['"]?\s*:\s*['"]?(\d+)['"]?/);
    if (match) {
      cleanId = match[1];
    } else {
      const numMatch = orderId.match(/^\d+$/);
      if (numMatch) {
        cleanId = numMatch[0];
      }
    }
  }

  const numericId = parseInt(cleanId, 10);
  const finalId = isNaN(numericId) ? cleanId : numericId;

  const response = await fetch(`${API_URL}/payment/status/${finalId}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    if (response.status === 403) {
      throw new Error("ACCESS_DENIED");
    }
    if (response.status === 404) {
      throw new Error("ORDER_NOT_FOUND");
    }
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.detail || `Failed to fetch payment status: ${response.status}`);
  }
  return response.json();
}




/**
 * Login user with email and password.
 * @param {{ email: string, password: string }} credentials
 * @returns {Promise<{ access_token: string, token_type: string }>}
 */
export async function loginUser(credentials) {

  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Invalid email or password");
  }

  return response.json();
}

/**
 * Register user with username, email, and password.
 * @param {{ username: string, email: string, password: string }} userData
 * @returns {Promise<{ id: number, username: string, email: string }>}
 */
export async function registerUser(userData) {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(userData),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Registration failed");
  }

  return response.json();
}

/**
 * Fetch current user profile.
 * @returns {Promise<{ id: number, username: string, email: string }>}
 */
export async function fetchUserProfile() {
  const response = await fetch(`${API_URL}/user/me`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch profile: ${response.status}`);
  }

  return response.json();
}

/**
 * Update current user profile.
 * @param {{ name?: string, email?: string, password?: string }} payload
 * @returns {Promise<{ id: number, username: string, email: string }>}
 */
export async function updateUserProfile(payload) {
  const response = await fetch(`${API_URL}/user/profile`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update profile");
  }

  return response.json();
}

/**
 * Fetch all saved shipping addresses for current user.
 * @returns {Promise<Array>} List of shipping addresses
 */
export async function fetchShippingAddresses() {
  const response = await fetch(`${API_URL}/shipping`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch shipping addresses: ${response.status}`);
  }

  return response.json();
}

/**
 * Create a new shipping address.
 * @param {object} addressData
 * @returns {Promise<object>} Created address
 */
export async function createShippingAddress(addressData) {
  const response = await fetch(`${API_URL}/shipping`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(addressData),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to create shipping address");
  }

  return response.json();
}

/**
 * Update an existing shipping address.
 * @param {number} addressId
 * @param {object} addressData
 * @returns {Promise<object>} Updated address
 */
export async function updateShippingAddress(addressId, addressData) {
  const response = await fetch(`${API_URL}/shipping/${addressId}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(addressData),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to update shipping address");
  }

  return response.json();
}

/**
 * Delete a shipping address.
 * @param {number} addressId
 * @returns {Promise<boolean>}
 */
export async function deleteShippingAddress(addressId) {
  const response = await fetch(`${API_URL}/shipping/${addressId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to delete shipping address");
  }

  return true;
}

/**
 * Fetch all orders for current user.
 * @returns {Promise<Array>} List of user orders
 */
export async function fetchUserOrders() {
  const response = await fetch(`${API_URL}/orders`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    if (response.status === 404) {
      return [];
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || `Failed to fetch orders: ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch details for a specific order.
 * @param {number|string|object} orderId
 * @returns {Promise<object>} Order details with line items
 */
export async function fetchOrderDetails(orderId) {
  let cleanId = orderId;
  if (typeof orderId === "object" && orderId !== null) {
    cleanId = orderId.value || orderId.order_id || orderId.id;
  } else if (typeof orderId === "string") {
    const match = orderId.match(/['"]?value['"]?\s*:\s*['"]?(\d+)['"]?/);
    if (match) {
      cleanId = match[1];
    } else {
      const numMatch = orderId.match(/^\d+$/);
      if (numMatch) {
        cleanId = numMatch[0];
      }
    }
  }

  const numericId = parseInt(cleanId, 10);
  const finalId = isNaN(numericId) ? cleanId : numericId;

  const response = await fetch(`${API_URL}/orders/${finalId}`, {
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to fetch order details");
  }

  return response.json();
}


/**
 * Cancel an order if allowed.
 * @param {number} orderId
 * @returns {Promise<object>}
 */
export async function cancelUserOrder(orderId) {
  const response = await fetch(`${API_URL}/orders/${orderId}/cancel`, {
    method: "POST",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("UNAUTHORIZED");
    }
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || "Failed to cancel order");
  }

  return response.json();
}


