-- Manual migration para adicionar suporte a Web Push Notifications
-- Rodar na VPS via:
--   docker exec -i mesa_mysql mysql -u root -p<senha> mesadigital < push_notifications.sql
-- OU via prisma db push (recomendado se o schema local estiver em dia)

-- 1) Campos VAPID na tabela Unit
ALTER TABLE `Unit`
  ADD COLUMN `pushVapidPublicKey`  TEXT NULL,
  ADD COLUMN `pushVapidPrivateKey` TEXT NULL,
  ADD COLUMN `pushVapidSubject`    VARCHAR(191) NULL;

-- 2) Tabela PushSubscription
CREATE TABLE `PushSubscription` (
  `id`         VARCHAR(191) NOT NULL,
  `unitId`     VARCHAR(191) NOT NULL,
  `customerId` VARCHAR(191) NULL,
  `endpoint`   VARCHAR(500) NOT NULL,
  `p256dh`     VARCHAR(255) NOT NULL,
  `auth`       VARCHAR(255) NOT NULL,
  `userAgent`  VARCHAR(500) NULL,
  `lastSeenAt` DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt`  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `PushSubscription_endpoint_key` (`endpoint`),
  INDEX `PushSubscription_unitId_idx`     (`unitId`),
  INDEX `PushSubscription_customerId_idx` (`customerId`),
  CONSTRAINT `PushSubscription_unitId_fkey`     FOREIGN KEY (`unitId`)     REFERENCES `Unit`(`id`)     ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `PushSubscription_customerId_fkey` FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
