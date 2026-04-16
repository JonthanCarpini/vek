import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seed iniciando...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: { name: 'Lanchonete Demo', slug: 'demo' },
  });

  const unit = await prisma.unit.upsert({
    where: { id: 'unit_demo' },
    update: {},
    create: {
      id: 'unit_demo',
      tenantId: tenant.id,
      name: 'Unidade Centro',
      address: 'Rua Principal, 123',
      phone: '(11) 99999-0000',
      serviceFee: 0.10,
    },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@mesadigital.com';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const hash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: { name: 'Administrador', email: adminEmail, passwordHash: hash, role: 'admin', unitId: unit.id },
  });
  await prisma.user.upsert({
    where: { email: 'cozinha@mesadigital.com' },
    update: {},
    create: { name: 'Cozinha', email: 'cozinha@mesadigital.com', passwordHash: hash, role: 'kitchen', unitId: unit.id },
  });
  await prisma.user.upsert({
    where: { email: 'garcom@mesadigital.com' },
    update: {},
    create: { name: 'Garçom João', email: 'garcom@mesadigital.com', passwordHash: hash, role: 'waiter', unitId: unit.id },
  });
  await prisma.user.upsert({
    where: { email: 'caixa@mesadigital.com' },
    update: {},
    create: { name: 'Caixa', email: 'caixa@mesadigital.com', passwordHash: hash, role: 'cashier', unitId: unit.id },
  });

  // Categorias
  const catsData = [
    { name: 'Lanches', sortOrder: 1 },
    { name: 'Bebidas', sortOrder: 2 },
    { name: 'Porções', sortOrder: 3 },
    { name: 'Sobremesas', sortOrder: 4 },
  ];
  const cats: any = {};
  for (const c of catsData) {
    const existing = await prisma.category.findFirst({ where: { unitId: unit.id, name: c.name } });
    cats[c.name] = existing ?? await prisma.category.create({ data: { ...c, unitId: unit.id } });
  }

  // Produtos
  const productsData = [
    { cat: 'Lanches', name: 'X-Burger Clássico', description: 'Pão brioche, burger 150g, queijo, alface, tomate', price: 24.9, station: 'grill' },
    { cat: 'Lanches', name: 'X-Bacon Duplo', description: 'Dois burgers 150g, bacon crocante, queijo cheddar', price: 34.9, station: 'grill' },
    { cat: 'Lanches', name: 'X-Salada Veggie', description: 'Hambúrguer de grão-de-bico, maionese vegana', price: 26.0, station: 'grill' },
    { cat: 'Bebidas', name: 'Coca-Cola 350ml', description: '', price: 7.0, station: 'bar' },
    { cat: 'Bebidas', name: 'Suco Natural Laranja', description: '500ml, sem açúcar', price: 9.5, station: 'bar' },
    { cat: 'Bebidas', name: 'Água sem gás', description: '500ml', price: 5.0, station: 'bar' },
    { cat: 'Porções', name: 'Batata Frita G', description: 'Porção generosa', price: 22.0, station: 'cozinha' },
    { cat: 'Porções', name: 'Onion Rings', description: 'Anéis de cebola empanados', price: 19.0, station: 'cozinha' },
    { cat: 'Sobremesas', name: 'Brownie com Sorvete', description: 'Brownie quente + sorvete de creme', price: 18.0, station: 'cozinha' },
    { cat: 'Sobremesas', name: 'Milkshake Chocolate', description: '500ml', price: 16.0, station: 'bar' },
  ];
  for (const p of productsData) {
    const exists = await prisma.product.findFirst({ where: { unitId: unit.id, name: p.name } });
    if (!exists) {
      await prisma.product.create({
        data: { unitId: unit.id, categoryId: cats[p.cat].id, name: p.name, description: p.description || null, price: p.price, station: p.station, active: true, available: true },
      });
    }
  }

  // Mesas
  for (let n = 1; n <= 10; n++) {
    const exists = await prisma.tableEntity.findFirst({ where: { unitId: unit.id, number: n } });
    if (!exists) {
      await prisma.tableEntity.create({
        data: { unitId: unit.id, number: n, qrToken: randomBytes(18).toString('base64url'), capacity: 4 },
      });
    }
  }

  const demoTables = await prisma.tableEntity.findMany({ where: { unitId: unit.id }, orderBy: { number: 'asc' } });
  console.log('✅ Seed concluído');
  console.log(`👤 Admin: ${adminEmail} / ${adminPassword}`);
  console.log(`🪑 Mesas criadas: ${demoTables.length}`);
  console.log(`🔗 Exemplo de URL de mesa: /m/${demoTables[0]?.qrToken}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
