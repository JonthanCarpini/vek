export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  available: boolean;
  preparationTimeMin: number;
  tags: string[];
  ingredients?: string[];
};

export type Category = {
  id: string;
  name: string;
  imageUrl: string | null;
  products: Product[];
};

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  imageUrl?: string | null;
};

export type OrderItem = {
  id?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  notes?: string | null;
  status?: string;
};

export type Order = {
  id: string;
  sequenceNumber: number;
  status: string;
  total: number;
  subtotal?: number;
  serviceFee?: number;
  createdAt: string;
  items: OrderItem[];
};

export type Call = {
  id: string;
  type: 'waiter' | 'bill' | 'help';
  reason: string | null;
  paymentHint: string | null;
  splitCount: number | null;
  status: 'pending' | 'attended' | 'cancelled';
  createdAt: string;
};

export type Session = {
  id: string;
  tableNumber: number;
  customerName: string;
};

export type Unit = {
  id?: string;
  name?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  serviceFee?: number;
  paymentMethods?: string;
  onlinePaymentEnabled?: boolean;
};

export const ORDER_STATUS_STEPS = [
  { key: 'received', label: 'Recebido', icon: '📝' },
  { key: 'accepted', label: 'Aceito', icon: '✅' },
  { key: 'preparing', label: 'Preparando', icon: '👨‍🍳' },
  { key: 'ready', label: 'Pronto', icon: '🔔' },
  { key: 'delivered', label: 'Entregue', icon: '🍽️' },
] as const;

export const STATUS_LABEL: Record<string, string> = {
  received: 'Recebido', accepted: 'Aceito', preparing: 'Em preparo',
  ready: 'Pronto', delivered: 'Entregue', cancelled: 'Cancelado',
};

export const WAITER_REASONS = [
  { id: 'water', label: '💧 Mais água', text: 'Trazer água' },
  { id: 'napkin', label: '🧻 Guardanapos', text: 'Trazer guardanapos' },
  { id: 'cutlery', label: '🍴 Talheres', text: 'Trazer talheres' },
  { id: 'plate', label: '🍽️ Pratos/copos', text: 'Trazer pratos ou copos' },
  { id: 'change', label: '🔄 Trocar item', text: 'Trocar/ajustar item do pedido' },
  { id: 'doubt', label: '❓ Tenho uma dúvida', text: 'Cliente tem uma dúvida' },
  { id: 'other', label: '✏️ Outro motivo', text: '' },
] as const;

export const PAYMENT_HINTS = [
  { id: 'cash', label: 'Dinheiro', icon: '💵' },
  { id: 'credit', label: 'Crédito', icon: '💳' },
  { id: 'debit', label: 'Débito', icon: '💳' },
  { id: 'pix', label: 'Pix', icon: '📱' },
  { id: 'split', label: 'Dividir', icon: '👥' },
] as const;
