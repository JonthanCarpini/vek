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
  imageUrl: z.string().url().optional().nullable(),
  active: z.boolean().optional(),
  available: z.boolean().optional(),
  preparationTimeMin: z.number().int().min(0).max(240).optional(),
  station: z.enum(['cozinha', 'bar', 'grill']).optional(),
  sortOrder: z.number().int().optional(),
  tags: z.string().optional().nullable(),
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
