# CHANGELOG — CPA-GROW Platform

> Журнал всех изменений проекта.
> **Формат**: при каждом изменении добавляй запись в начало файла под заголовком нужной версии.
> **Порядок**: новые записи сверху, старые снизу.

---

## Как добавлять записи

При выполнении задачи добавь запись в этот файл:

```markdown
### [YYYY-MM-DD] Краткое название задачи
**Автор**: Claude / <имя разработчика>
**Тип**: Feature | Fix | Refactor | Docs | Security | DB | Infra

#### Изменённые файлы
- `path/to/file.js` — что изменено

#### Описание
Что было сделано и почему.

#### Примечания
- Любые важные детали, допущения, ограничения
```

---

## [Unreleased] — В разработке

*(сюда добавляются незавершённые изменения)*

---

## [1.0.0] — 2026-03-22

### Инициализация проекта и документация

---

### [2026-03-22] Создание PROJECT.md и CHANGELOG.md
**Автор**: Claude (AI-агент)
**Тип**: Docs

#### Изменённые файлы
- `PROJECT.md` *(новый)* — полное описание проекта: стек, архитектура, API, бизнес-процессы, соглашения
- `CHANGELOG.md` *(новый)* — этот журнал изменений
- `CLAUDE.md` — добавлены ссылки на PROJECT.md и CHANGELOG.md

#### Описание
Создана документация для AI-агентов и разработчиков:
- `PROJECT.md` содержит полное описание платформы: технологический стек, структуру директорий, 26 моделей БД, все API-эндпоинты, бизнес-процессы (фрод-детекция, баланс, диспуты), безопасность, Docker-сервисы, соглашения по коду.
- `CHANGELOG.md` — структурированный журнал для отслеживания всех будущих изменений.

---

### [2026-03-22] Базовая платформа v1.0.0 — Полная реализация
**Автор**: Команда разработки
**Тип**: Feature

#### Реализованные модули

**Backend (Fastify + Prisma + PostgreSQL)**
- `backend/src/server.js` — Fastify-сервер с плагинами, CORS, rate-limit, health check
- `backend/src/routes/auth.js` — Email/password auth (bcrypt + JWT)
- `backend/src/routes/auth.oauth.js` — Google OAuth, Telegram Mini App, Web3 Wallet
- `backend/src/routes/tracker.js` — Click трекинг, S2S постбэки, поведенческий пиксель
- `backend/src/routes/admin/` — Управление пользователями, офферами, выплатами, диспутами, статистика
- `backend/src/routes/publisher/` — Офферы, диспуты, соглашения, GDPR, настройки
- `backend/src/routes/advertiser/` — Sandbox, диспуты, настройки
- `backend/src/routes/api/v1/` — Публичный API офферов (Bearer токен)
- `backend/src/services/balance.service.js` — Атомарный мульти-валютный баланс (USD/EUR/USDT)
- `backend/src/services/dispute.service.js` — Workflow диспутов с эскалацией
- `backend/src/services/notification.service.js` — Email/SMS/webhook уведомления
- `backend/src/services/fraud/ctit.service.js` — CTIT-анализ, детекция инъекции кликов
- `backend/src/services/fraud/behavioral.service.js` — Поведенческий скоринг (бот-детекция)
- `backend/src/workers/fraud.worker.js` — BullMQ воркер фрод-детекции
- `backend/src/workers/system.worker.js` — Реферальные бонусы, уведомления
- `backend/src/lib/errors.js` — AppError + централизованный обработчик ошибок
- `backend/src/lib/constants.js` — CTIT правила, пороги фрода, мин. выплаты, валюты
- `backend/src/lib/audit.js` — Аудит-лог admin-действий
- `backend/prisma/schema.prisma` — 26 моделей, все связи, индексы

**Frontend (React 18 + Vite)**
- `frontend/src/App.jsx` — Роутинг + role-based guards
- `frontend/src/api/client.js` — Axios + silent token refresh interceptor
- `frontend/src/context/AuthContext.jsx` — 3-уровневое восстановление сессии
- `frontend/src/pages/admin/` — Dashboard, Users, UserDetail, Offers, Payouts
- `frontend/src/pages/publisher/` — Dashboard, Offers, Conversions, Disputes, Balance, Stats, Settings
- `frontend/src/pages/advertiser/` — Dashboard, Disputes, Sandbox, Settings

**Инфраструктура**
- `backend/docker-compose.yml` — PostgreSQL 16, Redis x2, ClickHouse 24, API, Workers

#### Описание
Полная реализация CPA-платформы с:
- Тремя ролями (ADMIN/PUBLISHER/ADVERTISER) и role-based доступом
- Мульти-методной аутентификацией (email, Google, Telegram, Web3)
- Фрод-детекцией (CTIT + поведенческий анализ + fingerprinting)
- Атомарным мульти-валютным балансом (USD/EUR/USDT)
- Системой диспутов с 7-дневным окном и эскалацией к админу
- Publisher TQS (Traffic Quality Score)
- GDPR: экспорт и анонимизация данных
- Версионированными партнёрскими соглашениями
- Публичным API для внешних интеграций

---

## [0.x] — История рефакторинга

### [~2026-02] Рефакторинг безопасности и качества кода
**Автор**: Команда разработки
**Тип**: Refactor | Security

#### Выполненные задачи (из REFACTOR.md)
1. Замена SHA256 → bcrypt (12 rounds) для паролей
2. Хеширование refresh-токенов в БД
3. API-ключи только через Bearer header
4. httpOnly cookies для хранения токенов
5. Атомарные операции с балансом
6. Единый обработчик ошибок (AppError)
7. Zod-валидация входных данных
8. Индексы БД (Click, Conversion, Session, Dispute, User)
9. BullMQ воркер для реферальных бонусов
10. Недельные/месячные капы офферов
11. GDPR экспорт и анонимизация
12. Консолидация auth middleware
13. Удаление mock-данных
14. Дедупликация запросов в диспутах
15. Аудит-логирование admin-действий
16. Вынос констант в `lib/constants.js`
17. Health check endpoint `/health`
18. Структурированные логи с requestId (Pino)

---

*Формат основан на [Keep a Changelog](https://keepachangelog.com/)*
*Версионирование: [Semantic Versioning](https://semver.org/)*
