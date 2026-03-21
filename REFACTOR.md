# CPA Platform — Refactor Checklist

## ШАГ 1 — БЕЗОПАСНОСТЬ (критично, блокер запуска)

### 1.1 Заменить SHA256 на bcrypt для паролей
- [ ] Установить `bcrypt`: `npm install bcrypt`
- [ ] В `backend/src/routes/auth.js`:
  - Заменить `createHash('sha256').update(password + SALT).digest('hex')` → `bcrypt.hash(password, 12)`
  - Заменить сравнение hash → `bcrypt.compare(password, user.passwordHash)`
- [ ] Удалить `PASSWORD_SALT` из `.env` (больше не нужна)
- [ ] Добавить миграцию: при следующем логине пересохранять пароль в bcrypt (или сбросить пароли через письма)

### 1.2 Хешировать refresh токены в базе
- [ ] В `routes/auth.js` при создании сессии:
  - Генерировать `rawToken = crypto.randomBytes(32).toString('hex')`
  - Сохранять в базе `tokenHash = createHash('sha256').update(rawToken).digest('hex')`
  - Возвращать клиенту `rawToken`
- [ ] При refresh: входящий токен хешировать и искать по хешу
- [ ] При logout: удалять по хешу

### 1.3 API ключи только через заголовок Authorization
- [ ] В `backend/src/routes/api/v1/offers.js`:
  - Убрать `req.query.api_key`
  - Читать только из `req.headers.authorization` (формат: `Bearer <api_key>`)
- [ ] Обновить документацию/README

### 1.4 JWT и токены — перенести из localStorage в httpOnly cookie
- [ ] В `backend/src/server.js` добавить `@fastify/cookie`
- [ ] В `routes/auth.js` при логине устанавливать:
  ```
  reply.setCookie('refreshToken', rawToken, { httpOnly: true, sameSite: 'Strict', secure: true })
  ```
- [ ] В `frontend/src/context/AuthContext.jsx`:
  - Убрать `localStorage.setItem('token', ...)`
  - Access token хранить только в памяти (useState)
  - Refresh читать из cookie автоматически браузером
- [ ] В `frontend/src/api/client.js`:
  - Убрать `localStorage.getItem('token')`
  - Добавить `withCredentials: true` в axios

---

## ШАГ 2 — НАДЁЖНОСТЬ

### 2.1 Атомарные операции с балансом (race condition)
- [ ] В `backend/src/services/balance.service.js`:
  - Функция `holdFunds()`: обернуть в `prisma.$transaction` с проверкой `available >= amount`
  - Функция `releaseHoldToAvailable()`: проверять что `hold >= amount` перед release
  - Функция `debitForPayout()`: атомарно проверять и списывать
  - Пример паттерна:
    ```js
    await prisma.$transaction(async (tx) => {
      const bal = await tx.publisherBalance.findFirst({ where: ... })
      if (bal.available < amount) throw new Error('INSUFFICIENT_FUNDS')
      await tx.publisherBalance.update({ ... })
    })
    ```

### 2.2 Единый формат ошибок
- [ ] Создать `backend/src/lib/errors.js`:
  ```js
  export class AppError extends Error {
    constructor(code, message, statusCode = 400) { ... }
  }
  export const errorCodes = { UNAUTHORIZED: 401, NOT_FOUND: 404, ... }
  ```
- [ ] В `server.js` добавить глобальный error handler через `fastify.setErrorHandler()`
- [ ] Заменить все `reply.code(4xx).send({ error: '...' })` на `throw new AppError(...)`
- [ ] Фронтенд: в `api/client.js` обрабатывать `error.response.data.code` единообразно

### 2.3 Валидация входных данных через Zod
- [ ] Создать `backend/src/schemas/` директорию
- [ ] `schemas/auth.schema.js`: валидация email (regex), password (min 8, complexity), role
- [ ] `schemas/offer.schema.js`: URL validation, enum проверки, числа с min/max
- [ ] `schemas/payout.schema.js`: amount > 0, method enum, requisites не пустые
- [ ] Подключить к роутам через Fastify hooks или inline в handler
- [ ] Фронтенд: добавить базовую валидацию форм (Login, Register, Balance)

### 2.4 Добавить недостающие индексы в Prisma схему
- [ ] В `prisma/schema.prisma` добавить:
  ```prisma
  @@index([status, createdAt])       // Conversion
  @@index([publisherId, status])     // Dispute
  @@index([offerId, createdAt])      // Click
  @@index([fraudScore])              // Click
  @@index([publisherId, currency])   // PublisherBalance
  ```
- [ ] Запустить `npx prisma db push` или создать migration

---

## ШАГ 3 — ЗАВЕРШИТЬ НЕЗАКОНЧЕННЫЕ ФИЧИ

### 3.1 Реферальная система (worker не реализован)
- [ ] В `backend/src/workers/system.worker.js`:
  - Найти job `referral_bonus`
  - Реализовать логику:
    1. По `referredById` найти реферера
    2. Взять `referralPercent` из Publisher модели
    3. Вычислить бонус: `conversion.payout * (referralPercent / 100)`
    4. Вызвать `balance.service.creditPublisher(referrerId, bonus, currency)`
    5. Создать `PublisherTransaction` с type `REFERRAL_BONUS`
    6. Отправить уведомление рефереру

### 3.2 Weekly/Monthly капы офферов
- [ ] В `backend/src/routes/tracker.js` в обработчике клика:
  - Сейчас проверяется только `dailyCap`
  - Добавить проверку `weeklyCap`:
    ```js
    const weekStart = dayjs().startOf('week').toDate()
    const weeklyCount = await prisma.conversion.count({
      where: { offerId, createdAt: { gte: weekStart }, status: { not: 'REJECTED' } }
    })
    if (offer.weeklyCap && weeklyCount >= offer.weeklyCap) return reply.redirect(fallbackUrl)
    ```
  - Аналогично для `monthlyCap` и `totalCap`

### 3.3 GDPR реализация
- [ ] В `backend/src/routes/publisher/gdpr.js`:
  - `GET /api/publisher/gdpr/export`: собрать все данные пользователя (User, Publisher, Clicks, Conversions, Transactions, Disputes) → вернуть JSON
  - `DELETE /api/publisher/gdpr/delete`: анонимизировать данные:
    - User: email → `deleted_<id>@deleted.com`, passwordHash → случайный
    - Publisher: обнулить telegram, phone, website
    - Click: ipAddress → `0.0.0.0`, fingerprint → null
    - Не удалять финансовые записи (юридическое требование)
  - Добавить rate limit: 1 запрос на экспорт в 24 часа

---

## ШАГ 4 — КАЧЕСТВО КОДА

### 4.1 Вынести auth middleware в одно место
- [ ] Создать `backend/src/middleware/auth.js`:
  ```js
  export const requireAuth = async (req, reply) => {
    await req.jwtVerify()
  }
  export const requireRole = (role) => async (req, reply) => {
    await req.jwtVerify()
    if (req.user.role !== role) throw new AppError('FORBIDDEN', 403)
  }
  ```
- [ ] Заменить дублирующуюся проверку роли в каждом route handler на `preHandler: requireRole('PUBLISHER')`

### 4.2 Убрать mock данные с фронтенда
- [ ] В `frontend/src/pages/publisher/Dashboard.jsx`:
  - Убрать генерацию `mockData` при пустом ответе API
  - Вместо этого показывать empty state: "Нет данных за период"
  - Реальные ошибки API показывать через Toast
- [ ] Аналогично проверить `advertiser/Dashboard.jsx`

### 4.3 Дедупликация query для Dispute
- [ ] Создать `backend/src/lib/dispute.queries.js` с общим include/where
- [ ] Использовать в `publisher/disputes.js`, `advertiser/disputes.js`, `admin/disputes.js`

### 4.4 Аудит-лог для admin действий
- [ ] Добавить модель `AuditLog` в `prisma/schema.prisma`:
  ```prisma
  model AuditLog {
    id        String   @id @default(uuid())
    adminId   String
    action    String   // 'RESOLVE_DISPUTE', 'APPROVE_PAYOUT', 'BAN_USER', ...
    entityId  String
    before    Json?
    after     Json?
    createdAt DateTime @default(now())
  }
  ```
- [ ] Логировать в: `admin/disputes.js` (resolve), payout approve, user ban

### 4.5 Убрать магические числа/строки
- [ ] Создать `backend/src/lib/constants.js`:
  ```js
  export const PUBLISHER_DISPUTE_WINDOW_DAYS = 7
  export const ADVERTISER_REPLY_HOURS = 72
  export const MIN_PAYOUT = { USDT_TRC20: 20, BTC: 50, ... }
  export const FRAUD_SCORE_AUTO_REJECT = 80
  export const TOKEN_EXPIRY = { ACCESS: '15m', REFRESH: '30d' }
  ```
- [ ] Заменить hardcoded значения в `dispute.service.js`, `balance.service.js`, `ctit.service.js`

---

## ШАГ 5 — OBSERVABILITY

### 5.1 Health check endpoints
- [ ] В `server.js` расширить `/health`:
  ```js
  {
    status: 'ok',
    db: await prisma.$queryRaw`SELECT 1` ? 'ok' : 'error',
    redis: await redis.ping() === 'PONG' ? 'ok' : 'error',
    uptime: process.uptime()
  }
  ```

### 5.2 Структурированное логирование
- [ ] В workers использовать `fastify.log` или отдельный pino logger вместо `console.log`
- [ ] Добавить `requestId` в каждый лог через `fastify.addHook('onRequest', ...)`

---

## ПОРЯДОК ВЫПОЛНЕНИЯ

```
1.1 bcrypt → 1.2 refresh tokens → 1.3 API keys → 2.1 balance race →
2.2 errors → 2.3 zod → 2.4 indexes → 3.1 referral → 3.2 caps →
3.3 gdpr → 4.1 auth middleware → 4.2 mock data → 4.3 dispute dedup →
4.4 audit log → 4.5 constants → 5.1 health → 5.2 logging
```

---

## СТАТУС

- [x] 1.1 bcrypt
- [x] 1.2 refresh token hashing
- [x] 1.3 API key header only
- [x] 1.4 httpOnly cookies
- [x] 2.1 atomic balance
- [x] 2.2 unified errors
- [x] 2.3 zod validation
- [x] 2.4 db indexes
- [x] 3.1 referral worker
- [x] 3.2 weekly/monthly caps
- [x] 3.3 gdpr
- [x] 4.1 auth middleware
- [x] 4.2 remove mock data
- [x] 4.3 dispute query dedup
- [x] 4.4 audit log
- [x] 4.5 constants
- [x] 5.1 health check
- [x] 5.2 structured logging
