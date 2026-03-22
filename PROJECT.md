# CPA-GROW — Полное описание проекта

> **Для ИИ-агентов**: Прочитай этот файл **первым** перед любой работой с кодом.
> Здесь описана полная архитектура, стек, бизнес-логика и соглашения платформы.

---

## 1. Что такое CPA-GROW

**CPA-GROW** — партнёрская CPA-платформа (Cost-Per-Action) для управления:
- **Офферами** (рекламными предложениями) рекламодателей
- **Паблишерами** (источниками трафика)
- **Конверсиями** (выполненными целевыми действиями)
- **Выплатами** (расчёт с паблишерами)
- **Фродом** (защита от мошеннического трафика)

Платформа работает на трёх ролях: **ADMIN**, **PUBLISHER**, **ADVERTISER**.

---

## 2. Технологический стек

| Слой | Технология | Версия |
|------|-----------|--------|
| HTTP-сервер | Fastify | 4.28.1 |
| Runtime | Node.js ESM | 20+ |
| ORM | Prisma | 5.22.0 |
| База данных | PostgreSQL | 16 |
| Кеш / очередь | Redis | 7 |
| Фоновые задачи | BullMQ | 5.13.0 |
| Аналитика | ClickHouse | 24 |
| Frontend-фреймворк | React | 18.3.1 |
| Сборщик | Vite | 5.4.8 |
| Роутинг (FE) | React Router | 6.26.2 |
| Запросы (FE) | React Query + Axios | — |
| Web3 | Wagmi + Viem + ReOwn AppKit | — |
| Авторизация | JWT + bcrypt + httpOnly cookie | — |
| Логирование | Pino | 9.4.0 |
| Валидация | Zod | 3.23.8 |
| Контейнеризация | Docker Compose | — |

---

## 3. Структура директорий

```
cpa-grow/
├── PROJECT.md              ← этот файл (читать первым)
├── CHANGELOG.md            ← журнал всех изменений
├── CLAUDE.md               ← инструкции для агентов
├── REFACTOR.md             ← выполненные рефакторинги
├── cpa_platform_tz_v3_addons_1.md  ← техническое задание
│
├── backend/
│   ├── docker-compose.yml  ← PostgreSQL, Redis x2, ClickHouse
│   ├── .env.example        ← шаблон переменных окружения
│   ├── package.json
│   ├── prisma/
│   │   └── schema.prisma   ← 26 моделей БД
│   └── src/
│       ├── server.js       ← точка входа Fastify
│       ├── websocket.js    ← WS (будущие уведомления)
│       ├── routes/
│       │   ├── auth.js     ← /auth/* (login, register, refresh, logout)
│       │   ├── auth.oauth.js  ← Google, Telegram, Wallet auth
│       │   ├── tracker.js  ← /track/click, /track/postback, /pixel
│       │   ├── admin/      ← /admin/* (users, offers, payouts, disputes, stats, agreements)
│       │   ├── publisher/  ← /publisher/* (offers, disputes, agreement, gdpr, settings)
│       │   ├── advertiser/ ← /advertiser/* (sandbox, disputes, settings)
│       │   └── api/v1/     ← /api/v1/offers (публичный API)
│       ├── services/
│       │   ├── balance.service.js     ← мульти-валютный баланс (атомарно)
│       │   ├── dispute.service.js     ← workflow диспутов
│       │   ├── notification.service.js ← email/SMS/webhook уведомления
│       │   └── fraud/
│       │       ├── ctit.service.js    ← анализ Click-to-Install Time
│       │       └── behavioral.service.js ← поведенческий фрод-скоринг
│       ├── middleware/
│       │   ├── auth.js         ← JWT + проверка ролей
│       │   └── agreement.js    ← проверка подписи оферты
│       ├── workers/
│       │   ├── index.js        ← оркестрация воркеров
│       │   ├── fraud.worker.js ← очередь фрод-детекции
│       │   └── system.worker.js ← реферальные бонусы, уведомления
│       ├── schemas/
│       │   ├── auth.schema.js  ← Zod: email, пароль, роль
│       │   └── payout.schema.js ← Zod: сумма, метод, реквизиты
│       └── lib/
│           ├── prisma.js       ← Prisma client (singleton)
│           ├── redis.js        ← Redis connection
│           ├── auth.service.js ← JWT подпись, сессии, хеш refresh token
│           ├── errors.js       ← AppError + централизованный обработчик
│           ├── constants.js    ← CTIT правила, пороги фрода, мин. выплаты
│           ├── audit.js        ← логирование admin-действий
│           └── logger.js       ← структурированные логи (requestId)
│
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx
        ├── App.jsx             ← роуты + role guards
        ├── index.css           ← глобальные стили
        ├── api/
        │   └── client.js       ← Axios + silent refresh interceptor
        ├── context/
        │   ├── AuthContext.jsx ← 3-уровневое восстановление сессии
        │   └── TelegramContext.jsx ← Telegram Mini App
        ├── lib/
        │   ├── cloudStorage.js ← Telegram CloudStorage API
        │   ├── telegram.js     ← Mini App утилиты
        │   └── web3.js         ← Wagmi/Viem конфигурация
        ├── components/
        │   ├── Layout.jsx      ← sidebar навигация, role-based меню
        │   ├── Toast.jsx       ← уведомления
        │   ├── Badge.jsx       ← статусные бейджи
        │   ├── StatCard.jsx    ← карточки метрик дашборда
        │   ├── GoogleButton.jsx
        │   ├── WalletButton.jsx
        │   └── WalletRegisterComplete.jsx
        └── pages/
            ├── Login.jsx
            ├── Register.jsx
            ├── admin/
            │   ├── Dashboard.jsx  ← статистика платформы
            │   ├── Users.jsx      ← список + активация/бан
            │   ├── UserDetail.jsx ← профиль + история транзакций
            │   ├── Offers.jsx     ← одобрение офферов
            │   └── Payouts.jsx    ← обработка выплат
            ├── publisher/
            │   ├── Dashboard.jsx
            │   ├── Offers.jsx     ← просмотр и подача заявок
            │   ├── Conversions.jsx ← таблица + фрод-скоры
            │   ├── Disputes.jsx
            │   ├── Balance.jsx    ← мульти-валюта + запрос выплаты
            │   ├── Stats.jsx      ← TQS, CR, графики
            │   └── Settings.jsx   ← профиль, трекинг-ссылки, GDPR
            └── advertiser/
                ├── Dashboard.jsx
                ├── Disputes.jsx   ← ответы на диспуты
                ├── Sandbox.jsx    ← тест-конверсии без биллинга
                └── Settings.jsx   ← баланс, блокировки паблишеров
```

---

## 4. База данных — модели Prisma (26 моделей)

### Пользователи и сессии
| Модель | Назначение |
|--------|-----------|
| `User` | Базовый пользователь: email/Google/Telegram/Wallet auth, роль ADMIN/PUBLISHER/ADVERTISER |
| `Session` | Refresh-токены (хешированные), IP, User-Agent, expiresAt |
| `Publisher` | Профиль паблишера: username, типы трафика, реферальная система, TQS |
| `Advertiser` | Профиль рекламодателя: компания, баланс, holdAmount |

### Офферы и трафик
| Модель | Назначение |
|--------|-----------|
| `Offer` | Оффер: вертикаль, модель оплаты, капы (daily/weekly/monthly/total) |
| `OfferGoal` | Многоуровневые цели оффера с разными выплатами |
| `Creative` | Баннеры, видео, тексты |
| `TrackingLink` | Трекинговые ссылки с subid1-5 |
| `Application` | Заявка паблишера на оффер (workflow: PENDING → APPROVED/REJECTED) |

### Трекинг и конверсии
| Модель | Назначение |
|--------|-----------|
| `Click` | Клик: clickId, fingerprint, поля фрод-детекции |
| `Conversion` | Конверсия: PENDING/APPROVED/REJECTED/HOLD/SANDBOX, CTIT-анализ |
| `BehaviorEvent` | Сырые данные поведения пользователя (JS-пиксель) |
| `PostbackLog` | S2S постбэки для дебаггинга |

### Финансы
| Модель | Назначение |
|--------|-----------|
| `PublisherBalance` | Мульти-валютный баланс (USD/EUR/USDT): available + hold |
| `PublisherTransaction` | Леджер: CONVERSION/PAYOUT/REFERRAL_BONUS/ADJUSTMENT |
| `Payout` | Выплата: PENDING→PROCESSING→COMPLETED/FAILED, методы (USDT_TRC20/ERC20, BTC, ETH, WIRE) |
| `AdvertiserTransaction` | DEPOSIT/CONVERSION_CHARGE/REFUND |

### Диспуты и качество
| Модель | Назначение |
|--------|-----------|
| `Dispute` | Диспут: OPEN→ADVERTISER_REPLIED→RESOLVED, 7-дневное окно |
| `DisputeMessage` | Переписка в диспуте с вложениями |
| `PublisherTQS` | Traffic Quality Score: fraud_rate, approval_rate, unique_rate, avg_ctit |

### Фрод и соответствие
| Модель | Назначение |
|--------|-----------|
| `FraudAlert` | Алерты на основе правил |
| `AffiliateAgreement` | Версионированные партнёрские соглашения |
| `AgreementAcceptance` | Подписи пользователей |
| `AdvertiserPublisherBlock` | Чёрный список паблишеров у рекламодателей |
| `OfferFeedSubscription` | Уведомления о новых офферах |
| `AuditLog` | Лог всех admin-действий |

---

## 5. API-эндпоинты

### Аутентификация `/auth`
```
POST /auth/register          — регистрация (email + роль)
POST /auth/login             — вход (email + пароль)
POST /auth/refresh           — обновление access token
POST /auth/logout            — выход (удаление сессии)
POST /auth/google            — Google OAuth
POST /auth/telegram          — Telegram Mini App auth
POST /auth/wallet            — Web3 wallet auth
```

### Трекер `/track`
```
GET  /track/click/:shortCode      — клик по трекинговой ссылке
POST /track/postback              — S2S постбэк от рекламодателя
POST /track/pixel                 — поведенческий JS-пиксель
```

### Админ `/admin` (только ADMIN)
```
GET  /admin/users                 — список пользователей
GET  /admin/users/:id             — детали пользователя
PATCH /admin/users/:id/status     — изменить статус (ACTIVE/SUSPENDED/BANNED)
GET  /admin/offers                — список офферов на модерации
PATCH /admin/offers/:id/status    — одобрить/отклонить оффер
GET  /admin/payouts               — очередь выплат
PATCH /admin/payouts/:id          — обработать выплату
GET  /admin/disputes              — все диспуты
POST /admin/disputes/:id/resolve  — разрешить диспут
GET  /admin/stats                 — статистика платформы
GET  /admin/agreements            — список партнёрских соглашений
POST /admin/agreements            — создать новую версию соглашения
```

### Паблишер `/publisher` (только PUBLISHER)
```
GET  /publisher/offers            — доступные офферы
POST /publisher/offers/:id/apply  — подать заявку на оффер
GET  /publisher/disputes          — мои диспуты
POST /publisher/disputes          — открыть диспут
POST /publisher/disputes/:id/message — отправить сообщение
GET  /publisher/agreement         — текущее соглашение
POST /publisher/agreement/accept  — подписать соглашение
GET  /publisher/gdpr/export       — экспорт данных (GDPR)
POST /publisher/gdpr/anonymize    — анонимизация данных
GET  /publisher/settings          — настройки профиля
PATCH /publisher/settings         — обновить профиль
GET  /publisher/settings/api-key  — получить API-ключ
POST /publisher/settings/api-key  — сгенерировать новый API-ключ
```

### Рекламодатель `/advertiser` (только ADVERTISER)
```
GET  /advertiser/sandbox          — тестовые конверсии
POST /advertiser/sandbox/convert  — создать тест-конверсию
GET  /advertiser/disputes         — диспуты по моим офферам
POST /advertiser/disputes/:id/reply — ответить на диспут
GET  /advertiser/settings         — настройки
PATCH /advertiser/settings        — обновить настройки
POST /advertiser/settings/block-publisher — заблокировать паблишера
```

### Публичный API `/api/v1` (Bearer токен)
```
GET  /api/v1/offers               — фид офферов (для интеграций)
```

---

## 6. Бизнес-процессы

### 6.1 Пайплайн фрод-детекции

```
Клик получен
    → Fingerprint + дедупликация (Redis, 24ч окно)
    → Сохранение в Click
    → Конверсия получена (постбэк или пиксель)
    → CTIT-анализ (click-to-conversion time)
        • Gambling/Crypto: мин 10с, быстро < 30с
        • Mobile apps: мин 2с, быстро < 10с
        • Инъекция кликов: Android < 2с (авто-reject)
    → Поведенческий скоринг (BehaviorEvent)
        • Нет движений мыши → +60 очков
        • Мгновенный скролл 100% → +35 очков
        • Скор ≥ 80 → авто-отклонение
        • Скор 40-79 → на ревью к админу
    → Итоговый fraudScore
    → Обновление статуса конверсии
    → Баланс паблишера (атомарная транзакция)
    → 7-дневное окно для диспута
```

### 6.2 Мульти-валютный баланс (атомарно)

```
Конверсия одобрена
    → PublisherBalance.upsert(publisherId, currency)
    → available += payout
    → Создание PublisherTransaction (type: CONVERSION)

Запрос выплаты
    → Проверка: available ≥ сумма выплаты
    → available -= сумма, hold += сумма
    → Создание Payout (PENDING)

Выплата одобрена администратором
    → hold -= сумма
    → Payout.status = PROCESSING → COMPLETED
    → Создание PublisherTransaction (type: PAYOUT)
```

### 6.3 Workflow диспута

```
Паблишер открывает диспут (7 дней с момента конверсии)
    → Dispute.status = OPEN
    → Уведомление рекламодателю

Рекламодатель отвечает (72 часа)
    → Dispute.status = ADVERTISER_REPLIED

Если нет ответа за 72ч → эскалация к администратору
    → Администратор разрешает: RESOLVED (в пользу паблишера или рекламодателя)
    → Корректировка баланса при необходимости
```

### 6.4 Восстановление сессии (Frontend)

```
Запуск приложения
    → Уровень 1: Telegram CloudStorage (токен сохранён)
    → Уровень 2: httpOnly cookie (браузер)
    → Уровень 3: Telegram initData (повторная авторизация)
    → Восстановление состояния пользователя
    → Планирование silent refresh (за 60с до истечения)
```

---

## 7. Безопасность

| Мера | Реализация |
|------|-----------|
| Хеширование паролей | bcrypt (12 rounds) |
| Токены | JWT 15м (in-memory) + refresh 30д (httpOnly cookie) |
| Хранение refresh | Хешируются в БД (не plain text) |
| XSS защита | Access token только в памяти, никогда в localStorage |
| CSRF защита | SameSite=Lax + HttpOnly cookie |
| Rate limiting | register 10/мин, login 20/мин, refresh 30/мин, клики 200/мин |
| CORS | Только указанный FRONTEND_URL |
| Постбэки | HMAC-SHA256 подпись для верификации |
| Аудит | Все admin-действия логируются в AuditLog |
| API ключи | Только через Bearer header, никогда в URL |

---

## 8. Docker Compose сервисы

| Сервис | Образ | Порт | Назначение |
|--------|-------|------|-----------|
| postgres | postgres:16-alpine | 5432 | Основная БД |
| redis | redis:7-alpine | 6379 | Очереди BullMQ + кеш |
| redis-tracker | redis:7-alpine | 6380 | Дедупликация кликов (4GB, без persistence) |
| clickhouse | clickhouse:24-alpine | 8123/9000 | Аналитика |
| api | node:20 | 3000 | Fastify API |
| workers | node:20 | — | BullMQ воркеры |

---

## 9. Переменные окружения (backend/.env)

```env
# База данных
DATABASE_URL=postgresql://user:pass@localhost:5432/cpa_platform

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=secret

# JWT
JWT_SECRET=your-secret-key

# Frontend (CORS)
FRONTEND_URL=http://localhost:5173

# OAuth
GOOGLE_CLIENT_ID=...
TELEGRAM_BOT_TOKEN=...

# Web3
WALLET_CONNECT_PROJECT_ID=...

# Среда
NODE_ENV=development
```

---

## 10. Команды разработки

```bash
# Docker (PostgreSQL + Redis + ClickHouse)
cd backend && docker compose up -d

# Backend
cd backend && npm run db:generate    # Обновить Prisma client
cd backend && npm run db:migrate     # Применить миграции
cd backend && npm run dev            # Dev-сервер (port 3000)
cd backend && npm run workers        # BullMQ воркеры

# Frontend
cd frontend && npm run dev           # Vite dev (port 5173)
cd frontend && npm run build         # Production build

# Тесты
cd backend && npx vitest             # Backend unit/integration
cd frontend && npx vitest            # Frontend unit
npx playwright test                  # E2E
```

---

## 11. Соглашения по коду

1. **ESM-модули**: весь backend на `import/export`, не `require()`
2. **Ошибки**: всегда через `AppError(message, statusCode, errorCode)` — строковые коды (`NOT_FOUND`, `FORBIDDEN`, `INVALID_CREDENTIALS`)
3. **Аудит**: любое admin-действие → `auditLog(adminId, action, targetId, details)`
4. **Роли**: проверка через `fastify.authenticate` + `requireRole(['ADMIN'])`
5. **Балансы**: только через `balance.service.js`, никаких прямых `prisma.update` по балансу
6. **Стили**: inline-стили для специфики компонента, CSS-классы из `index.css` для общего
7. **Статусы пользователей**: `PENDING` → `ACTIVE` → `SUSPENDED` / `BANNED`
8. **Токены**: access token только в памяти (никогда localStorage), refresh в httpOnly cookie

---

## 12. Роли и разграничение доступа

| Роль | Маршруты | Возможности |
|------|---------|-------------|
| `ADMIN` | `/admin/*` | Полное управление платформой, пользователями, офферами, выплатами |
| `PUBLISHER` | `/publisher/*` | Офферы, конверсии, баланс, выплаты, диспуты, настройки |
| `ADVERTISER` | `/advertiser/*` | Кампании, sandbox, диспуты, блокировки паблишеров |

---

## 13. Статусы основных сущностей

### Пользователь
`PENDING` → `ACTIVE` → `SUSPENDED` | `BANNED`

### Конверсия
`PENDING` → `APPROVED` | `REJECTED` | `HOLD` | `SANDBOX`

### Выплата
`PENDING` → `PROCESSING` → `COMPLETED` | `FAILED`

### Диспут
`OPEN` → `ADVERTISER_REPLIED` → `RESOLVED`

### Заявка на оффер
`PENDING` → `APPROVED` | `REJECTED`

### Оффер
`DRAFT` → `PENDING_REVIEW` → `ACTIVE` | `PAUSED` | `ARCHIVED`

---

## 14. Текущее состояние проекта

- Все основные функции реализованы
- Все 23 пункта рефакторинга выполнены (см. REFACTOR.md)
- Безопасность: bcrypt, httpOnly cookies, JWT, rate limiting, CORS, HMAC постбэки
- Фрод-детекция: CTIT-анализ + поведенческий скоринг + fingerprinting
- Мульти-валютный баланс с атомарными транзакциями
- Система диспутов с тайм-аутами и эскалацией
- TQS (Traffic Quality Score) для паблишеров
- GDPR: экспорт и анонимизация данных
- Web3/Telegram/Google аутентификация
- Публичный API с Bearer-токеном для внешних интеграций
- Sandbox-режим для рекламодателей

---

*Последнее обновление: 2026-03-22*
*Версия: 1.0.0*
