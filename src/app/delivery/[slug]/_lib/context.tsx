'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { deliveryApi } from './api';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string | null;
};

export type Step = 'menu' | 'login' | 'address' | 'checkout' | 'tracking';

type Ctx = {
  slug: string;
  unit: any | null;
  menu: any | null;
  customer: any | null;
  loadingUnit: boolean;

  // Cart
  cart: CartItem[];
  cartSubtotal: number;
  cartCount: number;
  addToCart: (item: CartItem) => void;
  updateQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  // Flow
  step: Step;
  goTo: (s: Step) => void;

  // Checkout state
  orderType: 'delivery' | 'takeout';
  setOrderType: (t: 'delivery' | 'takeout') => void;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;

  // Auth
  loginSuccess: (customer: any) => void;
  logout: () => Promise<void>;

  // Tracking
  trackingOrderId: string | null;
  setTrackingOrderId: (id: string | null) => void;

  reload: () => Promise<void>;
};

const DeliveryContext = createContext<Ctx | null>(null);

export function useDelivery() {
  const c = useContext(DeliveryContext);
  if (!c) throw new Error('useDelivery must be used inside DeliveryProvider');
  return c;
}

const CART_KEY_PREFIX = 'delivery_cart_';

export function DeliveryProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const [unit, setUnit] = useState<any | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [loadingUnit, setLoadingUnit] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<Step>('menu');
  const [orderType, setOrderType] = useState<'delivery' | 'takeout'>('delivery');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  // Inicial: carrega unit + menu + me (session)
  useEffect(() => {
    (async () => {
      setLoadingUnit(true);
      const [infoRes, menuRes, meRes] = await Promise.all([
        deliveryApi.info(slug),
        deliveryApi.menu(slug),
        deliveryApi.me(),
      ]);
      if (infoRes.ok) setUnit(infoRes.data);
      if (menuRes.ok) setMenu(menuRes.data);
      if (meRes.ok) setCustomer(meRes.data.customer);

      // Carrinho do localStorage
      try {
        const saved = localStorage.getItem(CART_KEY_PREFIX + slug);
        if (saved) setCart(JSON.parse(saved));
      } catch {}

      // Set orderType padrão baseado em unit
      if (infoRes.ok) {
        if (!infoRes.data.deliveryEnabled && infoRes.data.takeoutEnabled) {
          setOrderType('takeout');
        }
      }

      setLoadingUnit(false);
    })();
  }, [slug]);

  // Persiste carrinho
  useEffect(() => {
    try { localStorage.setItem(CART_KEY_PREFIX + slug, JSON.stringify(cart)); } catch {}
  }, [cart, slug]);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((s, i) => s + i.quantity, 0),
    [cart],
  );

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((p) => p.productId === item.productId);
      if (existing) {
        return prev.map((p) =>
          p.productId === item.productId ? { ...p, quantity: p.quantity + item.quantity } : p,
        );
      }
      return [...prev, item];
    });
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) return removeFromCart(productId);
    setCart((prev) => prev.map((p) => (p.productId === productId ? { ...p, quantity: qty } : p)));
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((p) => p.productId !== productId));
  };

  const clearCart = () => setCart([]);

  const loginSuccess = (c: any) => {
    setCustomer(c);
    setStep(orderType === 'delivery' ? 'address' : 'checkout');
  };

  const logout = async () => {
    await deliveryApi.logout();
    setCustomer(null);
    setSelectedAddressId(null);
    setStep('menu');
  };

  const reload = async () => {
    const [infoRes, menuRes] = await Promise.all([
      deliveryApi.info(slug), deliveryApi.menu(slug),
    ]);
    if (infoRes.ok) setUnit(infoRes.data);
    if (menuRes.ok) setMenu(menuRes.data);
  };

  const value: Ctx = {
    slug, unit, menu, customer, loadingUnit,
    cart, cartSubtotal, cartCount,
    addToCart, updateQty, removeFromCart, clearCart,
    step, goTo: setStep,
    orderType, setOrderType,
    selectedAddressId, setSelectedAddressId,
    loginSuccess, logout,
    trackingOrderId, setTrackingOrderId,
    reload,
  };

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}
