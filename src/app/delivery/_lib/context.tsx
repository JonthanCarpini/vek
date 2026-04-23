'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { deliveryApi } from './api';

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string | null;
};

export type Step = 'menu' | 'login' | 'address' | 'checkout';

const ACTIVE_STATUSES = new Set(['received', 'accepted', 'preparing', 'ready', 'dispatched']);

type Ctx = {
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

  // Home-tab internal stack (menu → login → address → checkout)
  step: Step;
  goTo: (s: Step) => void;

  orderType: 'delivery' | 'takeout';
  setOrderType: (t: 'delivery' | 'takeout') => void;
  selectedAddressId: string | null;
  setSelectedAddressId: (id: string | null) => void;

  // Auth
  loginSuccess: (customer: any) => void;
  logout: () => Promise<void>;

  // Shared data across tabs
  orders: any[];
  activeOrdersCount: number;
  loadingOrders: boolean;
  reloadOrders: () => Promise<void>;

  addresses: any[];
  loadingAddresses: boolean;
  reloadAddresses: () => Promise<void>;

  reload: () => Promise<void>;
};

const DeliveryContext = createContext<Ctx | null>(null);

export function useDelivery() {
  const c = useContext(DeliveryContext);
  if (!c) throw new Error('useDelivery must be used inside DeliveryProvider');
  return c;
}

const CART_KEY = 'delivery_cart';

export function DeliveryProvider({ children }: { children: React.ReactNode }) {
  const [unit, setUnit] = useState<any | null>(null);
  const [menu, setMenu] = useState<any | null>(null);
  const [customer, setCustomer] = useState<any | null>(null);
  const [loadingUnit, setLoadingUnit] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStepRaw] = useState<Step>('menu');

  // Back-button mobile: sincroniza step com history.pushState/popstate
  // Ao avançar para sub-step (login/address/checkout), empilhamos um entry no history.
  // Quando o usuário toca o back button, o popstate dispara e voltamos ao step anterior.
  const stepStackRef = useRef<Step[]>(['menu']);

  const setStep = useCallback((s: Step) => {
    setStepRaw((prev) => {
      if (prev === s) return s;
      if (typeof window !== 'undefined') {
        if (s === 'menu') {
          // Volta ao root: substitui entry atual ao invés de empilhar
          stepStackRef.current = ['menu'];
          window.history.replaceState({ deliveryStep: 'menu' }, '');
        } else {
          stepStackRef.current = [...stepStackRef.current, s];
          window.history.pushState({ deliveryStep: s }, '');
        }
      }
      return s;
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPopState = (e: PopStateEvent) => {
      // Se estamos em sub-step, retrocede na stack; se já em menu, deixa o browser sair normalmente
      setStepRaw((prev) => {
        if (prev === 'menu') return prev;
        const stack = stepStackRef.current;
        stack.pop();
        const next = stack[stack.length - 1] || 'menu';
        stepStackRef.current = next === 'menu' ? ['menu'] : [...stack];
        return next;
      });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  const [orderType, setOrderType] = useState<'delivery' | 'takeout'>('delivery');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingUnit(true);
      const [infoRes, menuRes, meRes] = await Promise.all([
        deliveryApi.info(),
        deliveryApi.menu(),
        deliveryApi.me(),
      ]);
      if (infoRes.ok) setUnit(infoRes.data);
      if (menuRes.ok) setMenu(menuRes.data);
      if (meRes.ok) setCustomer(meRes.data.customer);

      try {
        const saved = localStorage.getItem(CART_KEY);
        if (saved) setCart(JSON.parse(saved));
      } catch {}

      if (infoRes.ok) {
        if (!infoRes.data.deliveryEnabled && infoRes.data.takeoutEnabled) {
          setOrderType('takeout');
        }
      }

      setLoadingUnit(false);
    })();
  }, []);

  useEffect(() => {
    try { localStorage.setItem(CART_KEY, JSON.stringify(cart)); } catch {}
  }, [cart]);

  const reloadOrders = useCallback(async () => {
    if (!customer) { setOrders([]); return; }
    setLoadingOrders(true);
    const res = await deliveryApi.listOrders();
    setLoadingOrders(false);
    if (res.ok) setOrders(res.data.orders);
  }, [customer]);

  const reloadAddresses = useCallback(async () => {
    if (!customer) { setAddresses([]); return; }
    setLoadingAddresses(true);
    const res = await deliveryApi.listAddresses();
    setLoadingAddresses(false);
    if (res.ok) setAddresses(res.data.addresses);
  }, [customer]);

  // Auto-load orders/addresses once customer is known
  useEffect(() => {
    if (!customer) return;
    reloadOrders();
    reloadAddresses();
  }, [customer, reloadOrders, reloadAddresses]);

  // Poll active orders every 30s to keep the Pedidos badge fresh
  useEffect(() => {
    if (!customer) return;
    const interval = setInterval(reloadOrders, 30_000);
    return () => clearInterval(interval);
  }, [customer, reloadOrders]);

  const cartSubtotal = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.quantity, 0),
    [cart],
  );
  const cartCount = useMemo(
    () => cart.reduce((s, i) => s + i.quantity, 0),
    [cart],
  );
  const activeOrdersCount = useMemo(
    () => orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
    [orders],
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
    setOrders([]);
    setAddresses([]);
    setStep('menu');
  };

  const reload = async () => {
    const [infoRes, menuRes] = await Promise.all([
      deliveryApi.info(), deliveryApi.menu(),
    ]);
    if (infoRes.ok) setUnit(infoRes.data);
    if (menuRes.ok) setMenu(menuRes.data);
  };

  const value: Ctx = {
    unit, menu, customer, loadingUnit,
    cart, cartSubtotal, cartCount,
    addToCart, updateQty, removeFromCart, clearCart,
    step, goTo: setStep,
    orderType, setOrderType,
    selectedAddressId, setSelectedAddressId,
    loginSuccess, logout,
    orders, activeOrdersCount, loadingOrders, reloadOrders,
    addresses, loadingAddresses, reloadAddresses,
    reload,
  };

  return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
}
