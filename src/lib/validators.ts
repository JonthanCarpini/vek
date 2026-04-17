import { z } from 'zod';

export const checkinSchema = z.object({
  qrToken: z.string().min(4),
  name: z.string().min(2).max(80),
  phone: z.string().min(8).max(20),
});

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).max(99),
  notes: z.string().max(200).optional(),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1).max(50),
  notes: z.string().max(500).optional(),
});

export const createCallSchema = z.object({
  type: z.enum(['waiter', 'bill', 'help']),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const productSchema = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional().nullable(),
  price: z.number().nonnegative(),
  imageUrl: z.string().max(500).optional().nullable(),
  active: z.boolean().optional(),
  available: z.boolean().optional(),
  preparationTimeMin: z.number().int().min(0).max(240).optional(),
  station: z.enum(['cozinha', 'bar', 'grill']).optional(),
  sortOrder: z.number().int().optional(),
  tags: z.string().optional().nullable(),
  featured: z.boolean().optional(),
  videoUrl: z.string().max(500).optional().nullable(),
  ingredients: z.array(z.object({
    ingredientId: z.string().min(1),
    quantity: z.number().positive(),
    optional: z.boolean().optional().default(false),
  })).optional(),
});

export const categorySchema = z.object({
  name: z.string().min(1).max(80),
  sortOrder: z.number().int().optional(),
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
});

export const tableSchema = z.object({
  number: z.number().int().min(1),
  label: z.string().max(40).optional().nullable(),
  capacity: z.number().int().min(1).max(50).optional(),
  status: z.enum(['free', 'occupied', 'disabled', 'reserved']).optional(),
});

export const userSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(4).optional(),
  role: z.enum(['admin', 'manager', 'waiter', 'kitchen', 'cashier']),
  active: z.boolean().optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(['received', 'accepted', 'preparing', 'ready', 'delivered', 'cancelled']),
});

export const itemStatusSchema = z.object({
  status: z.enum(['pending', 'preparing', 'ready', 'delivered']),
});

export const callAttendSchema = z.object({}).optional();

// Fase 2
export const openStoreDaySchema = z.object({
  openingCash: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
});
export const closeStoreDaySchema = z.object({
  closingCash: z.number().min(0),
  notes: z.string().max(500).optional(),
});

export const storeOverrideSchema = z.object({
  type: z.enum(['open', 'closed']),
  reason: z.string().min(2).max(200),
  endsAt: z.string().datetime().optional().nullable(),
});

export const businessHourItem = z.object({
  weekday: z.number().int().min(0).max(6),
  openTime: z.string().regex(/^\d{2}:\d{2}$/),
  closeTime: z.string().regex(/^\d{2}:\d{2}$/),
  active: z.boolean().default(true),
});
export const businessHoursSchema = z.object({
  hours: z.array(businessHourItem).max(7),
});

export const PAYMENT_METHODS = ['cash', 'credit', 'debit', 'pix', 'voucher', 'other'] as const;
export const sessionPaymentSchema = z.object({
  method: z.enum(PAYMENT_METHODS),
  amount: z.number().positive(),
  changeGiven: z.number().min(0).optional().default(0),
  reference: z.string().max(80).optional().nullable(),
  partLabel: z.string().max(40).optional().nullable(),
  notes: z.string().max(300).optional().nullable(),
});

export const closeSessionSchema = z.object({
  // Finaliza a sessão. Se amountsPaid já cobre o total, não precisa enviar nada.
  // Se enviar payments aqui, eles serão criados antes de fechar.
  payments: z.array(sessionPaymentSchema).optional().default([]),
  force: z.boolean().optional().default(false), // ignora diferença
});

export const ingredientSchema = z.object({
  name: z.string().min(1).max(80),
  unitOfMeasure: z.enum(['un', 'g', 'kg', 'ml', 'L']).default('un'),
  stock: z.number().min(0).optional(),
  minStock: z.number().min(0).optional(),
  cost: z.number().min(0).optional(),
  active: z.boolean().optional(),
});

export const stockAdjustSchema = z.object({
  delta: z.number(),
  reason: z.string().max(200).optional(),
});

export const productIngredientItem = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().positive(),
  optional: z.boolean().optional().default(false),
});

export const settingsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  address: z.string().max(200).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  whatsapp: z.string().max(30).optional().nullable(),
  logoUrl: z.string().max(500).optional().nullable(),
  primaryColor: z.string().max(16).optional().nullable(),
  serviceFee: z.number().min(0).max(1).optional(),
});
