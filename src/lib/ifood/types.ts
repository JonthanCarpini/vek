// Tipos da API iFood (Merchant API v1.0/v2.0)
// Referência: https://developer.ifood.com.br/pt-BR/docs/references/

export interface IfoodAuthResponse {
  accessToken: string;
  type: string;
  expiresIn: number; // segundos
}

export interface IfoodEventDTO {
  id: string;              // id único do evento (para acknowledgment)
  code: string;            // PLC | CFM | CAN | DSP | CON | RPR ...
  fullCode?: string;       // PLACED | CONFIRMED | ...
  orderId: string;         // id do pedido iFood
  createdAt: string;       // ISO
  merchantId?: string;
  metadata?: Record<string, any>;
}

export interface IfoodAcknowledgmentItem {
  id: string;
}

export interface IfoodOrderCustomer {
  id?: string;
  name: string;
  phone?: {
    number?: string;
    localizer?: string;
    localizerExpiration?: string;
  };
  documentNumber?: string;
  ordersCountOnMerchant?: number;
}

export interface IfoodOrderItem {
  id?: string;
  index?: number;
  name: string;
  externalCode?: string;
  quantity: number;
  unit?: string; // UN | KG | L
  unitPrice?: { value: number; currency: string };
  totalPrice?: { value: number; currency: string };
  price?: { value: number; currency: string };
  observations?: string;
  options?: Array<{
    name: string;
    quantity: number;
    price?: { value: number; currency: string };
  }>;
}

export interface IfoodDeliveryAddress {
  formattedAddress?: string;
  streetName?: string;
  streetNumber?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  reference?: string;
  coordinates?: { latitude: number; longitude: number };
}

export interface IfoodOrderDTO {
  id: string;
  displayId: string; // código curto (ex: AB12)
  createdAt: string;
  orderType: 'DELIVERY' | 'TAKEOUT' | 'INDOOR';
  orderTiming?: 'IMMEDIATE' | 'SCHEDULED';
  salesChannel?: string;
  merchant?: { id: string; name: string };
  customer?: IfoodOrderCustomer;
  items: IfoodOrderItem[];
  total?: {
    subTotal?: number;
    deliveryFee?: number;
    benefits?: number;
    orderAmount?: number;
    additionalFees?: number;
  };
  payments?: {
    prepaid?: number;
    pending?: number;
    methods?: Array<{
      method: string;
      type: string;
      value: number;
      prepaid?: boolean;
      currency?: string;
      cash?: { changeFor?: number };
    }>;
  };
  delivery?: {
    mode?: 'DEFAULT' | 'MERCHANT' | 'OURDELIVERY';
    deliveredBy?: string;
    deliveryAddress?: IfoodDeliveryAddress;
    deliveryDateTime?: string;
    pickupCode?: string;
  };
  takeout?: {
    mode?: string;
    takeoutDateTime?: string;
  };
  indoor?: {
    mode?: string;
    indoorDateTime?: string;
  };
  extraInfo?: string;
  status?: string;
}

export interface IfoodMerchantStatus {
  available: boolean;
  state: 'AVAILABLE' | 'UNAVAILABLE' | 'OPEN' | 'CLOSED';
  message?: string;
  reopenable?: boolean;
  validations?: Array<{ id: string; state: string; message?: string }>;
}

export interface IfoodCancellationReason {
  cancelCodeId: string;
  description: string;
}
