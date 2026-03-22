# CPA-Grow Platform — Claude Code Guide

## Проект
CPA-платформа для управления партнёрскими офферами, паблишерами, рекламодателями, конверсиями и выплатами.

## Стек
| Слой | Технологии |
|------|-----------|
| Backend | Node.js ESM, Fastify 4, Prisma ORM, PostgreSQL 16 |
| Cache/Queue | Redis 7, BullMQ 5 |
| Auth | JWT (access 15m + refresh 30d httpOnly cookie), bcrypt |
| Frontend | React 18, Vite 5, React Router 6, React Query, Axios |
| Web3 | Wagmi, Viem, ReOwn AppKit (WalletConnect) |
| DevOps | Docker Compose |

## Структура
```
cpa-grow/
├── backend/
│   ├── src/
│   │   ├── routes/         # HTTP handlers (admin/, publisher/, advertiser/, auth.js)
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Auth, role checks
│   │   ├── workers/        # BullMQ background jobs
│   │   └── lib/            # prisma, redis, audit, errors, constants
│   └── prisma/schema.prisma
└── frontend/
    └── src/
        ├── api/client.js   # Axios + token refresh interceptor
        ├── context/        # AuthContext
        ├── components/     # Layout, StatCard, Toast, Badge
        └── pages/          # admin/, publisher/, advertiser/
```

---

## Multi-agent workflow: Coding Team

### Агенты

| Агент | Роль | Когда использовать |
|-------|------|--------------------|
| **backend-coder** | Senior Backend Engineer | API, сервер, БД, очереди, авторизация |
| **frontend-coder** | Senior Frontend Engineer | UI, компоненты, страницы, состояние |
| **refactor-coder** | Software Architect | Чистка кода, архитектура, декомпозиция |
| **test-coder** | QA Engineer / SDET | Тесты, баги, покрытие, регрессии |

---

### Автоматический выбор агента по триггерам

Claude **автоматически** выбирает агента если в запросе есть ключевые слова:

#### → backend-coder
`backend` `бэкенд` `сервер` `API` `endpoint` `REST` `GraphQL` `бэк`
`микросервис` `БД` `ORM` `база данных` `роут` `контроллер` `сервис`
`миграция` `schema` `модель` `авторизация` `аутентификация` `JWT`
`Redis` `очередь` `воркер` `postback` `tracker` `Prisma` `Fastify`

#### → frontend-coder
`frontend` `фронт` `фронтенд` `интерфейс` `UI` `страница` `компонент`
`верстка` `React` `Vue` `Svelte` `SPA` `форма` `кнопка` `таблица`
`модалка` `дашборд` `стили` `CSS` `анимация` `адаптив` `мобильный`
`роутинг` `навигация` `состояние` `хук` `контекст` `виджет`

#### → refactor-coder
`рефакторинг` `рефактор` `почисти код` `улучши архитектуру`
`разбей на модули` `оптимизируй` `упрости` `дублирование`
`повторяющийся код` `god object` `спагетти` `технический долг`
`декомпозиция` `абстракция` `связность` `coupling` `SOLID` `паттерн`

#### → test-coder
`тест` `тесты` `unit-тест` `integration` `e2e` `coverage` `покрытие`
`ошибка` `баг` `bug` `Exception` `stack trace` `упал` `не работает`
`воспроизвести` `регрессия` `playwright` `jest` `vitest` `supertest`

---

### Схема взаимодействия

#### Полный цикл новой фичи

```
┌─────────────────────────────────────────────────────┐
│                   Новая фича                        │
└──────────────────────┬──────────────────────────────┘
                       │
          ┌────────────▼────────────┐
          │     backend-coder       │
          │  1. Prisma schema/миг.  │
          │  2. Service layer       │
          │  3. Route handlers      │
          │  4. Отдаёт: API spec    │
          └────────────┬────────────┘
                       │  API spec (эндпоинты, payload, ответы)
          ┌────────────▼────────────┐
          │    frontend-coder       │
          │  1. Страницы/компоненты │
          │  2. API интеграция      │
          │  3. Состояние/роутинг   │
          └────────────┬────────────┘
                       │  Готовый код (backend + frontend)
          ┌────────────▼────────────┐  ← опционально
          │    refactor-coder       │
          │  1. Ревью архитектуры   │
          │  2. Выделение общего    │
          │  3. Упрощение           │
          └────────────┬────────────┘
                       │  Чистый код
          ┌────────────▼────────────┐
          │      test-coder         │
          │  1. Unit тесты          │
          │  2. Integration тесты   │
          │  3. E2E сценарии        │
          └─────────────────────────┘
```

#### Цикл баг-фикса

```
┌──────────────────────────────────┐
│   Баг: описание / stack trace    │
└──────────────┬───────────────────┘
               │
  ┌────────────▼────────────┐
  │      test-coder         │
  │  1. Анализ ошибки       │
  │  2. Failing тест        │
  │  3. Локализация слоя    │
  └────────────┬────────────┘
               │
       Backend баг?          Frontend баг?
       ┌───────┘                    └───────┐
       ▼                                    ▼
 backend-coder                      frontend-coder
 1. Фикс логики                     1. Фикс компонента
 2. Обновляет код                   2. Обновляет код
       └───────────────┬────────────────────┘
                       ▼
                  test-coder
              Запускает тест → PASS ✓
              Добавляет в регрессию
```

---

### Формат передачи результатов между агентами

Каждый агент при завершении работы передаёт:

```markdown
## Результат: [Название задачи]

### Изменённые файлы
- `path/to/file.js` — краткое описание что изменено

### API / Интерфейс (для следующего агента)
// Что именно доступно следующему агенту
GET /api/admin/users?role=&status=&search= → { data[], meta }
PATCH /api/admin/users/:id/status → { id, email, role, status }

### Допущения и ограничения
- Что было принято как данность
- Что нельзя менять
- Известные ограничения

### TODO (ручная проверка)
- [ ] Проверить X
- [ ] Настроить Y
```

---

### Параллельный запуск агентов

Некоторые задачи можно выполнять **параллельно**:

```
backend-coder (новый API)  ║  frontend-coder (другая страница)
refactor-coder (backend)   ║  test-coder (предыдущий модуль)
```

Параллельно **нельзя**:
- Frontend и Backend над одной фичей (frontend ждёт API spec)
- Refactor и Test над одним файлом (конфликт изменений)

---

### Команды запуска

```bash
# Backend
cd backend && npm run dev          # Dev server (port 3000)
cd backend && npm run workers      # BullMQ workers
cd backend && npm run db:migrate   # Prisma migrations
cd backend && npm run db:generate  # Prisma client

# Frontend
cd frontend && npm run dev         # Vite dev server (port 5173)
cd frontend && npm run build       # Production build

# Docker (PostgreSQL + Redis)
cd backend && docker compose up -d

# Тесты (когда настроены)
cd backend && npx vitest           # Backend unit/integration
cd frontend && npx vitest          # Frontend unit
npx playwright test                # E2E
```

---

### Роли и доступ

| Роль | Доступ |
|------|--------|
| ADMIN | `/admin/*` — полное управление платформой |
| PUBLISHER | `/publisher/*` — офферы, конверсии, выплаты |
| ADVERTISER | `/advertiser/*` — кампании, диспуты, sandbox |

---

### Важные соглашения

1. **Токены**: access token только in-memory, refresh token в httpOnly cookie
2. **Аудит**: все admin-действия логируются через `auditLog()` из `lib/audit.js`
3. **Ошибки**: строковые коды (`INVALID_CREDENTIALS`, `NOT_FOUND`, `FORBIDDEN`)
4. **Роли**: проверка через `requireRole()` middleware или `fastify.authenticate`
5. **Статусы юзеров**: PENDING (ждёт активации) → ACTIVE → SUSPENDED / BANNED
6. **CSS**: inline styles для специфики, CSS-классы из index.css для общего
