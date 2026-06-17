export interface CartItem {
  listingId: string;
  title: string;
  price: number;
  currency: string;
  quantity: number;
}

const CART_KEY = "tpt-cart";

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) ?? "[]") as CartItem[];
  } catch {
    return [];
  }
}

export function setCart(items: CartItem[]): void {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event("cart-updated"));
}

export function addToCart(item: Omit<CartItem, "quantity">): void {
  const cart = getCart();
  const existing = cart.find((i) => i.listingId === item.listingId);
  if (existing) {
    existing.quantity += 1;
    setCart(cart);
  } else {
    setCart([...cart, { ...item, quantity: 1 }]);
  }
}

export function removeFromCart(listingId: string): void {
  setCart(getCart().filter((i) => i.listingId !== listingId));
}

export function updateQuantity(listingId: string, quantity: number): void {
  if (quantity <= 0) {
    removeFromCart(listingId);
    return;
  }
  setCart(getCart().map((i) => (i.listingId === listingId ? { ...i, quantity } : i)));
}

export function clearCart(): void {
  setCart([]);
}
