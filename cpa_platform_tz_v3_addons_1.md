# CPA PLATFORM — ТЗ v3: КРИТИЧЕСКИЕ УЛУЧШЕНИЯ
## Результаты исследования рынка · Март 2026

> Этот файл — **дополнение к v2**. Содержит только то, чего не было или что было недостаточно проработано.  
> Источники: исследование реальных платформ (Everflow, Impact, ClickDealer, MaxBounty), отраслевые отчёты 2025-2026.

---

## ЧТО НАШЁЛ В ХОДЕ ИССЛЕДОВАНИЯ

### Что делают топ CPA-сети (MaxBounty #1, ClickDealer, Everflow), чего нет в нашем ТЗ:

| Фича | MaxBounty/ClickDealer | Наше ТЗ v2 | Статус |
|---|---|---|---|
| Pay-per-call трекинг | ✅ | ❌ | Добавить |
| Cookieless tracking | ✅ | Частично | Расширить |
| Публичный API для паблишеров | ✅ | В roadmap | Детализировать |
| Dispute система (оспаривание) | ✅ | ❌ | Добавить |
| Publisher scoring / рейтинг | ✅ | ❌ | Добавить |
| Offer feed (RSS/API для паблишеров) | ✅ | ❌ | Добавить |
| Conversion anomaly alerts (авто) | ✅ | Частично | Расширить |
| Click injection detection | ✅ | ❌ | Добавить |
| Behavioral fraud scoring | ✅ | ❌ | Добавить |
| Affiliate agreement / ToS версионирование | ✅ | ❌ | Добавить |
| Multi-currency балансы | ✅ | ❌ | Добавить |
| Timezone-aware reporting | ✅ | Упомянуто | Детализировать |
| Traffic quality score | ✅ | ❌ | Добавить |

### Что критично для Gambling/Crypto вертикалей (по исследованию):
- Cookie stuffing составляет **до 60% всех случаев фрода** в affiliate
- **Click injection** — новая угроза 2025 года (мобильный трафик)
- **Behavioral analytics** — стандарт у топ-платформ
- Рекламодатели Gambling требуют **FTD verification workflow**
- Crypto требует **wallet address verification** при выплатах
- **Rolling reserve** обязателен для Gambling — уже есть, но нужна UI

---

## РАЗДЕЛ A: РАСШИРЕННЫЙ АНТИФРОД (ЗАМЕНА ТЗ-9)

### A.1 Полная карта типов фрода и методов детекции

| Тип фрода | Как работает | Детекция |
|---|---|---|
| **Cookie Stuffing** | Тайная подброска cookies через iframe/pixel | Проверка referer chain, аномалии времени клик→конверсия |
| **Click Flooding** | Тысячи кликов чтобы попасть в attribution window | Rate limit + анализ click/conversion ratio |
| **Click Injection** | Android malware перехватывает install events | CTIT анализ (< 2 секунды = подозрительно) |
| **Fake Postbacks** | Искусственные конверсии без реального клика | Верификация click_id + IP consistency check |
| **Brand Bidding** | Реклама на бренд-запросы рекламодателя | Мониторинг search terms (внешний инструмент) |
| **Typosquatting** | Домены-двойники для кражи трафика | Domain similarity check |
| **Adware/Toolbar** | Подбрасывает cookies через расширения | User agent анализ, extension fingerprinting |
| **Self-referral** | Паблишер сам делает конверсии | IP/device match click↔conversion |
| **Incentivized fraud** | Паблишер платит людям кликать/конвертить | Поведенческий анализ (время на сайте, глубина) |
| **Geo Fraud** | Трафик из запрещённого гео через VPN | ISP/ASN анализ + VPN detection |
| **Device Emulation** | Ботнет притворяется мобильными устройствами | Device fingerprint consistency |

### A.2 CTIT Analysis (Click-To-Install/Conversion Time)

Критически важно для мобильного трафика и Gambling:

```javascript
// services/fraud/ctit.service.js

export function analyzeCTIT(click, conversion) {
  const timeDiffSeconds = (conversion.createdAt - click.createdAt) / 1000

  // Gambling/Crypto: регистрация
  if (timeDiffSeconds < 10) {
    return { suspicious: true, reason: 'CTIT_TOO_FAST', score: 85 }
    // Невозможно зарегистрироваться менее чем за 10 секунд
  }

  if (timeDiffSeconds < 30) {
    return { suspicious: true, reason: 'CTIT_VERY_FAST', score: 50 }
  }

  // Подозрительно долго — возможно click flooding
  const cookieLifetimeSec = click.offer.cookieLifetime * 24 * 3600
  if (timeDiffSeconds > cookieLifetimeSec * 0.95) {
    return { suspicious: true, reason: 'CTIT_NEAR_EXPIRY', score: 40 }
    // Конверсия прямо перед истечением cookie — паттерн фрода
  }

  return { suspicious: false, score: 0 }
}
```

### A.3 Behavioral Scoring (поведенческий анализ)

```javascript
// services/fraud/behavioral.service.js

// Собираем поведенческие метрики через JavaScript pixel на сайте рекламодателя
// Рекламодатель вставляет наш скрипт на свой сайт (опционально)

export async function getBehavioralScore(clickId) {
  const events = await redis.lrange(`behavior:${clickId}`, 0, -1)

  if (events.length === 0) return { score: 20, reason: 'NO_BEHAVIOR_DATA' }

  const parsed = events.map(e => JSON.parse(e))

  const metrics = {
    pageViews:      parsed.filter(e => e.type === 'pageview').length,
    scrollDepth:    Math.max(...parsed.filter(e => e.type === 'scroll').map(e => e.depth), 0),
    timeOnSite:     parsed.reduce((sum, e) => sum + (e.duration || 0), 0),
    mouseMovements: parsed.filter(e => e.type === 'mousemove').length,
    formInteractions: parsed.filter(e => e.type === 'form').length,
    clickEvents:    parsed.filter(e => e.type === 'click').length,
  }

  let score = 0
  const reasons = []

  // Нет движений мыши — бот
  if (metrics.mouseMovements < 5 && metrics.timeOnSite > 0) {
    score += 60; reasons.push('NO_MOUSE_MOVEMENT')
  }

  // Слишком мало времени на странице регистрации
  if (metrics.timeOnSite < 15) {
    score += 40; reasons.push('VERY_SHORT_SESSION')
  }

  // Нулевая глубина скролла при длинной форме
  if (metrics.scrollDepth < 10 && metrics.formInteractions > 0) {
    score += 30; reasons.push('NO_SCROLL_WITH_FORM')
  }

  return { score: Math.min(score, 100), reasons, metrics }
}

// JavaScript трекинг-пиксель (отправляем рекламодателю для вставки)
const BEHAVIOR_PIXEL = `
<script>
(function() {
  var CID = '{{CLICK_ID}}';
  var ENDPOINT = 'https://go.platform.com/behavior';
  
  function send(data) {
    navigator.sendBeacon(ENDPOINT, JSON.stringify({ cid: CID, ...data }));
  }
  
  // Pageview
  send({ type: 'pageview', url: location.href });
  
  // Scroll depth
  var maxScroll = 0;
  window.addEventListener('scroll', function() {
    var depth = Math.round((window.scrollY / document.body.scrollHeight) * 100);
    if (depth > maxScroll) { maxScroll = depth; send({ type: 'scroll', depth }); }
  }, { passive: true });
  
  // Mouse movement (throttled)
  var moveCount = 0;
  document.addEventListener('mousemove', function() { moveCount++; }, { passive: true });
  
  // Time on page
  var startTime = Date.now();
  window.addEventListener('beforeunload', function() {
    send({ type: 'exit', duration: Date.now() - startTime, moves: moveCount });
  });
  
  // Form interactions
  document.querySelectorAll('input, select, textarea').forEach(function(el) {
    el.addEventListener('focus', function() { send({ type: 'form', field: el.name }); });
  });
})();
</script>
`
```

### A.4 Publisher Traffic Quality Score

Агрегированный скор качества трафика паблишера — рассчитывается еженедельно:

```javascript
// workers/system.worker.js — расчёт TQS

async function calculateTrafficQualityScore(publisherId, period = '30d') {
  const stats = await db.$queryRaw`
    SELECT
      COUNT(DISTINCT c.id) as total_clicks,
      COUNT(DISTINCT c.id) FILTER (WHERE c.is_unique = true) as unique_clicks,
      COUNT(DISTINCT c.id) FILTER (WHERE c.is_fraud = true) as fraud_clicks,
      AVG(c.fraud_score) as avg_fraud_score,
      COUNT(DISTINCT conv.id) as total_conversions,
      COUNT(DISTINCT conv.id) FILTER (WHERE conv.status = 'APPROVED') as approved_convs,
      COUNT(DISTINCT conv.id) FILTER (WHERE conv.status = 'REJECTED') as rejected_convs,
      AVG(EXTRACT(EPOCH FROM (conv.created_at - c.created_at))) as avg_ctit_seconds
    FROM clicks c
    LEFT JOIN conversions conv ON conv.click_id = c.click_id
    WHERE c.publisher_id = ${publisherId}
    AND c.created_at > NOW() - INTERVAL '30 days'
  `

  const s = stats[0]

  // Компоненты скора (0-100, выше = лучше)
  const fraudRate = s.fraud_clicks / Math.max(s.total_clicks, 1)
  const approvalRate = s.approved_convs / Math.max(s.total_conversions, 1)
  const uniqueRate = s.unique_clicks / Math.max(s.total_clicks, 1)
  const ctitNormal = s.avg_ctit_seconds > 60 && s.avg_ctit_seconds < 86400 // 1 мин — 1 день

  const tqs = Math.round(
    (1 - fraudRate) * 30 +          // 30 баллов за отсутствие фрода
    approvalRate * 40 +              // 40 баллов за высокий approval rate
    uniqueRate * 20 +                // 20 баллов за уникальность трафика
    (ctitNormal ? 10 : 0)           // 10 баллов за нормальный CTIT
  )

  // Сохраняем в профиль паблишера
  await db.publisher.update({
    where: { id: publisherId },
    data: {
      trafficQualityScore: tqs,
      tqsUpdatedAt: new Date(),
      tqsDetails: JSON.stringify({ fraudRate, approvalRate, uniqueRate, avgCtit: s.avg_ctit_seconds })
    }
  })

  return tqs
}
```

**TQS отображается в кабинете:**
- Паблишер видит свой скор с советами по улучшению
- Рекламодатель видит TQS паблишера при просмотре заявки
- Система может автоматически снижать выплату паблишерам с TQS < 40

### A.5 Anomaly Detection (авто-алерты)

```javascript
// workers/fraud.worker.js — мониторинг аномалий

const ANOMALY_RULES = [
  {
    name: 'CR_SPIKE',
    check: async (publisherId, offerId) => {
      const recent1h = await getStats(publisherId, offerId, '1h')
      const baseline7d = await getBaselineStats(publisherId, offerId, '7d')

      // CR в 3+ раза выше нормы за последний час
      if (recent1h.cr > baseline7d.avg_cr * 3 && recent1h.conversions > 10) {
        return {
          triggered: true,
          severity: 'HIGH',
          message: `CR spike: ${recent1h.cr.toFixed(1)}% vs baseline ${baseline7d.avg_cr.toFixed(1)}%`
        }
      }
      return { triggered: false }
    }
  },
  {
    name: 'CLICK_SPIKE',
    check: async (publisherId, offerId) => {
      const recent1h = await getStats(publisherId, offerId, '1h')
      const baseline = await getBaselineStats(publisherId, offerId, '7d')

      // Клики в 5+ раз выше нормы
      if (recent1h.clicks > baseline.avg_hourly_clicks * 5) {
        return { triggered: true, severity: 'MEDIUM', message: 'Click volume spike detected' }
      }
      return { triggered: false }
    }
  },
  {
    name: 'HIGH_REJECT_RATE',
    check: async (publisherId, offerId) => {
      const stats = await getStats(publisherId, offerId, '24h')
      if (stats.reject_rate > 0.5 && stats.conversions > 20) {
        return { triggered: true, severity: 'HIGH', message: `Reject rate ${(stats.reject_rate * 100).toFixed(0)}%` }
      }
      return { triggered: false }
    }
  },
  {
    name: 'SINGLE_IP_CONVERSIONS',
    check: async (publisherId, offerId) => {
      // Более 3 конверсий с одного IP за 24h
      const result = await db.$queryRaw`
        SELECT conv.ip, COUNT(*) as cnt
        FROM conversions conv
        JOIN clicks c ON c.click_id = conv.click_id
        WHERE c.publisher_id = ${publisherId} AND conv.offer_id = ${offerId}
        AND conv.created_at > NOW() - INTERVAL '24 hours'
        GROUP BY conv.ip HAVING COUNT(*) > 3
      `
      if (result.length > 0) {
        return { triggered: true, severity: 'CRITICAL',
          message: `${result.length} IPs with 3+ conversions: ${result[0].ip}...` }
      }
      return { triggered: false }
    }
  }
]

// Запускается каждые 15 минут через BullMQ cron
async function runAnomalyDetection() {
  const activePublishers = await getActivePublishers()

  for (const { publisherId, offerId } of activePublishers) {
    for (const rule of ANOMALY_RULES) {
      const result = await rule.check(publisherId, offerId)
      if (result.triggered) {
        await createFraudAlert({ publisherId, offerId, rule: rule.name, ...result })
        await notifyAdmin({ publisherId, offerId, alert: result })
      }
    }
  }
}
```

---

## РАЗДЕЛ B: DISPUTE СИСТЕМА (НОВЫЙ МОДУЛЬ)

Это критический модуль, которого нет в v2. Топ-сети (MaxBounty, ClickDealer) имеют его обязательно.

### B.1 Что такое Dispute

Паблишер видит что конверсия отклонена, не согласен с причиной → подаёт оспаривание. Рекламодатель отвечает. Администратор арбитрирует.

### B.2 Схема БД

```prisma
enum DisputeStatus {
  OPEN         // паблишер открыл
  ADVERTISER_REPLIED  // рекламодатель ответил
  ESCALATED    // передано администратору
  RESOLVED_FOR_PUBLISHER   // решено в пользу паблишера
  RESOLVED_FOR_ADVERTISER  // решено в пользу рекламодателя
  CLOSED       // закрыто
}

model Dispute {
  id              String        @id @default(uuid())
  conversionId    String        @unique
  publisherId     String
  advertiserId    String
  status          DisputeStatus @default(OPEN)

  publisherReason String        @db.Text  // почему считает несправедливым
  publisherEvidence Json?       // скриншоты, логи (S3 URLs)

  advertiserReply String?       @db.Text
  advertiserEvidence Json?

  adminNote       String?       @db.Text
  resolvedById    String?
  resolvedAt      DateTime?

  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  messages        DisputeMessage[]
}

model DisputeMessage {
  id          String   @id @default(uuid())
  disputeId   String
  authorId    String
  authorRole  String   // PUBLISHER, ADVERTISER, ADMIN
  message     String   @db.Text
  attachments Json?    // S3 URLs
  createdAt   DateTime @default(now())

  dispute     Dispute  @relation(fields: [disputeId], references: [id])
}
```

### B.3 Флоу dispute

```
1. Паблишер видит отклонённую конверсию
   → Кнопка "Оспорить" (доступна 7 дней после отклонения)
   → Форма: причина + загрузка доказательств (скриншоты, переписка)

2. Рекламодатель получает email/уведомление
   → Срок ответа: 72 часа
   → Может: принять (конверсия → APPROVED) / отклонить с объяснением

3. Если рекламодатель не ответил за 72h:
   → Автоматически эскалируется к администратору
   → Или конверсия авто-одобряется (настраивается)

4. Администратор арбитрирует:
   → Видит полный диалог + данные клика + постбек лог
   → Принимает решение
   → Обе стороны получают уведомление

5. Статистика disputes:
   - Процент выигранных/проигранных по каждому рекламодателю
   - Рекламодатели с высоким % отклонений в spotlight
```

### B.4 API

```
POST   /api/publisher/conversions/:id/dispute        — открыть
GET    /api/publisher/disputes                       — мои disputes
GET    /api/publisher/disputes/:id
POST   /api/publisher/disputes/:id/messages          — добавить сообщение

GET    /api/advertiser/disputes                      — disputes по моим офферам
POST   /api/advertiser/disputes/:id/reply            — ответить
POST   /api/advertiser/disputes/:id/accept           — принять (одобрить конверсию)
POST   /api/advertiser/disputes/:id/reject           — отклонить с объяснением

GET    /api/admin/disputes                           — все disputes
POST   /api/admin/disputes/:id/resolve               — решение администратора
```

---

## РАЗДЕЛ C: РАСШИРЕННАЯ МОДЕЛЬ ДАННЫХ

### C.1 Дополнения к Prisma схеме

```prisma
// ─── TRAFFIC QUALITY SCORE ───

model PublisherTQS {
  id            String   @id @default(uuid())
  publisherId   String
  score         Int      // 0-100
  fraudRate     Decimal  @db.Decimal(5, 4)
  approvalRate  Decimal  @db.Decimal(5, 4)
  uniqueRate    Decimal  @db.Decimal(5, 4)
  avgCtitSec    Int?
  details       Json
  period        String   // "2026-03" — за какой месяц
  calculatedAt  DateTime @default(now())

  publisher     Publisher @relation(fields: [publisherId], references: [id])

  @@index([publisherId, calculatedAt])
}

// ─── OFFER FEED SUBSCRIPTION ───
// Паблишер подписывается на типы офферов — получает email при появлении нового

model OfferFeedSubscription {
  id            String    @id @default(uuid())
  publisherId   String
  vertical      Vertical?
  minPayout     Decimal?  @db.Decimal(18, 2)
  paymentModels String[]
  geos          String[]
  notifyEmail   Boolean   @default(true)
  notifyTelegram Boolean  @default(false)
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())

  publisher     Publisher @relation(fields: [publisherId], references: [id])
}

// ─── ADVERTISER BLACKLIST (паблишеры) ───
// Рекламодатель может заблокировать конкретного паблишера

model AdvertiserPublisherBlock {
  id            String   @id @default(uuid())
  advertiserId  String
  publisherId   String
  reason        String?
  createdAt     DateTime @default(now())

  @@unique([advertiserId, publisherId])
}

// ─── AFFILIATE AGREEMENT VERSIONING ───
// Паблишер принимает ToS при регистрации и при обновлениях

model AffiliateAgreement {
  id          String   @id @default(uuid())
  version     String   // "2.1"
  title       String
  content     String   @db.Text
  effectiveAt DateTime
  isCurrent   Boolean  @default(false)
  createdAt   DateTime @default(now())

  acceptances AgreementAcceptance[]
}

model AgreementAcceptance {
  id          String   @id @default(uuid())
  userId      String
  agreementId String
  ipAddress   String?
  acceptedAt  DateTime @default(now())

  user        User               @relation(fields: [userId], references: [id])
  agreement   AffiliateAgreement @relation(fields: [agreementId], references: [id])

  @@unique([userId, agreementId])
}

// ─── MULTI-CURRENCY BALANCE ───
// Расширение Publisher для мультивалютных балансов

model PublisherBalance {
  id          String   @id @default(uuid())
  publisherId String
  currency    String   // USD, EUR, USDT
  available   Decimal  @default(0) @db.Decimal(18, 2)
  hold        Decimal  @default(0) @db.Decimal(18, 2)
  updatedAt   DateTime @updatedAt

  publisher   Publisher @relation(fields: [publisherId], references: [id])

  @@unique([publisherId, currency])
}

// ─── BEHAVIORAL EVENTS ───
// События поведения пользователей (из JS pixel)

model BehaviorEvent {
  id        String   @id @default(uuid())
  clickId   String
  type      String   // pageview, scroll, click, form, exit, mousemove
  data      Json     // специфичные данные события
  createdAt DateTime @default(now())

  @@index([clickId])
  // Партиционирование по дате — TTL 90 дней
}
```

---

## РАЗДЕЛ D: OFFER FEED — ПУБЛИЧНЫЙ API ДЛЯ ПАБЛИШЕРОВ

Критическая фича для tech-паблишеров (price comparison, агрегаторы офферов).

### D.1 API Key аутентификация

```
Все запросы к публичному API:
Authorization: Bearer {api_key}

или в параметрах:
?api_key={api_key}
```

### D.2 Эндпоинты Offer Feed

```
GET /api/v1/offers
  Параметры:
    vertical    = crypto,gambling,nutra
    payout_min  = 50
    payout_max  = 500
    geo         = RU,UA,KZ
    payment_model = CPA,CPL
    sort        = payout_desc | epc_desc | cr_desc | newest
    page        = 1
    limit       = 50 (max 200)

Ответ:
{
  "data": [
    {
      "id": "offer-uuid",
      "name": "Crypto Broker X — FTD",
      "vertical": "CRYPTO",
      "payment_model": "CPA",
      "payout": 150.00,
      "currency": "USD",
      "allowed_geos": ["RU", "UA", "KZ"],
      "traffic_types": ["SEO", "PPC"],
      "preview_url": "https://...",
      "avg_cr": 3.2,
      "avg_epc": 4.80,
      "daily_cap": 50,
      "cookie_lifetime": 30,
      "goals": [
        { "name": "registration", "payout": 5 },
        { "name": "ftd", "payout": 150 }
      ],
      "status": "available",  // available | pending_approval | approved
      "applied": false
    }
  ],
  "meta": { "total": 142, "page": 1, "per_page": 50 }
}

GET /api/v1/offers/:id              — детальная информация
GET /api/v1/offers/:id/creatives   — список креативов
POST /api/v1/applications          — подать заявку на оффер
GET /api/v1/stats                  — своя статистика (агрегированная)
GET /api/v1/conversions            — список своих конверсий
GET /api/v1/balance                — баланс и история транзакций
POST /api/v1/links                 — создать трекинговую ссылку
```

### D.3 RSS Feed офферов

```xml
GET /api/v1/offers/rss?api_key={key}&vertical=crypto

<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>CPA Platform — New Offers</title>
    <item>
      <title>[CRYPTO] Broker X — FTD $150 CPA — RU,UA,KZ</title>
      <link>https://app.platform.com/publisher/offers/offer-uuid</link>
      <description>CPA $150 | Geo: RU, UA, KZ | Traffic: SEO, PPC | CR: 3.2%</description>
      <pubDate>Fri, 21 Mar 2026 14:32:11 +0000</pubDate>
      <category>CRYPTO</category>
    </item>
  </channel>
</rss>
```

---

## РАЗДЕЛ E: COOKIELESS TRACKING (РАСШИРЕНИЕ)

В v2 есть S2S postback, но нет полноценного cookieless трекинга. Это стало стандартом в 2025.

### E.1 Методы cookieless трекинга

```
1. Server-to-Server (уже есть) — основной метод
2. Fingerprint-based — дополнительный
3. First-party cookies — если трекер на домене рекламодателя
4. Coupon codes — уже есть
5. Email-based (click из email → tracing по email hash)
```

### E.2 Fingerprint трекинг

```javascript
// tracker/fingerprint.service.js

export async function getFingerprintId(req) {
  const components = [
    req.ip,
    req.headers['user-agent'],
    req.headers['accept-language'],
    req.headers['accept-encoding'],
    req.headers['sec-ch-ua'],               // browser hints
    req.headers['sec-ch-ua-platform'],
    req.headers['sec-ch-ua-mobile'],
  ]

  const fpHash = sha256(components.filter(Boolean).join('|'))
  return fpHash
}

// При клике — сохраняем fingerprint
// При конверсии без click_id — пробуем матч по fingerprint
async function matchByFingerprint(req, offerId, publisherId) {
  const fpHash = await getFingerprintId(req)

  // Ищем клик с тем же fingerprint за последние cookie_lifetime дней
  const matchedClick = await db.click.findFirst({
    where: {
      fingerprint: fpHash,
      offerId,
      publisherId,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
      conversion: null,  // без конверсии
    },
    orderBy: { createdAt: 'desc' }
  })

  return matchedClick
}
```

### E.3 Email Hash трекинг (для Finance/Leads)

```
Флоу:
1. Паблишер отправляет трафик с параметром ?email_hash={sha256(email)}
2. Платформа записывает email_hash в Click
3. Рекламодатель при конверсии передаёт email_hash:
   GET /postback?secret=xxx&email_hash={sha256(email)}&goal=lead
4. Платформа матчит по email_hash

Зачем: email-рассылки, где cookie не работают (Gmail не сохраняет 3rd party cookies)
```

---

## РАЗДЕЛ F: РАСШИРЕННЫЕ ФИНАНСЫ

### F.1 Multi-currency балансы

```javascript
// Паблишер может держать балансы в разных валютах:

publisher_balances:
  USD: 2,450.00  (available) + 890.00 (hold)
  USDT: 500.00   (available)
  EUR: 120.00    (available)

// Выплата запрашивается из конкретной валюты
POST /api/publisher/payouts
{
  "currency": "USDT",
  "amount": 450,
  "method": "USDT_TRC20",
  "address": "TXxxx..."
}

// Конверсии начисляются в валюте оффера
// Автоконвертация: если оффер в EUR, баланс ведётся в EUR
// Конвертация при запросе выплаты — по курсу CoinGecko API
```

### F.2 Автоматические выплаты (Crypto API)

```javascript
// services/payout.service.js

// Интеграция с Tron API для USDT TRC20 автовыплат

export async function processAutoPayoutTRC20(payout) {
  const { amount, requisites } = payout
  const address = requisites.address

  // Валидация адреса
  if (!isValidTronAddress(address)) {
    throw new Error('Invalid TRC20 address')
  }

  // Баланс горячего кошелька
  const walletBalance = await getTRC20Balance(HOT_WALLET_ADDRESS, USDT_CONTRACT)
  if (walletBalance < amount + GAS_RESERVE) {
    // Уведомить администратора — нужно пополнить hot wallet
    await notifyAdmin('HOT_WALLET_LOW', { balance: walletBalance, needed: amount })
    throw new Error('Insufficient hot wallet balance')
  }

  // Отправка транзакции
  const tx = await sendTRC20(
    HOT_WALLET_PRIVATE_KEY,
    address,
    amount,
    USDT_CONTRACT
  )

  // Ожидаем подтверждения (1 блок = ~3 сек)
  const confirmed = await waitForConfirmation(tx.txId, 1)

  return { txHash: tx.txId, confirmed }
}

// Hot/Cold wallet стратегия:
// Hot wallet: держим максимум $10,000 USDT (для авто-выплат)
// Cold wallet: всё остальное (доступ только через мультиподпись)
// Когда hot wallet < $2,000 → алерт администратору
```

### F.3 Referral программа (детализация)

```javascript
// Паблишер приглашает другого паблишера
// Получает % от его заработка пожизненно

// Схема расчёта при одобрении конверсии рефериса:
async function processReferralBonus(conversion) {
  const publisher = await db.publisher.findUnique({
    where: { id: conversion.publisherId },
    include: { referredBy: true }
  })

  if (!publisher.referredBy) return

  const referralPercent = publisher.referredBy.referralPercent  // 5% по умолчанию
  const bonus = conversion.payoutAmount * referralPercent / 100

  await db.publisher.update({
    where: { id: publisher.referredById },
    data: { balance: { increment: bonus } }
  })

  await db.publisherTransaction.create({
    data: {
      publisherId: publisher.referredById,
      type: 'REFERRAL_BONUS',
      amount: bonus,
      description: `Referral bonus from ${publisher.userId}: ${conversion.id}`,
      refId: conversion.id,
    }
  })

  // Уведомление
  await notifyPublisher(publisher.referredById, 'REFERRAL_BONUS', { amount: bonus })
}

// В кабинете вебмастера — раздел "Рефералы":
GET /api/publisher/referrals
{
  "referral_code": "mycode123",
  "referral_link": "https://app.platform.com/register?ref=mycode123",
  "total_referrals": 8,
  "active_referrals": 5,  // генерировали конверсии за 30д
  "total_earned": 1247.50,
  "current_month": 234.00,
  "referrals": [
    { "id": "...", "joined": "2026-01-15", "conversions_30d": 45, "earned_30d": 47.25 }
  ]
}
```

---

## РАЗДЕЛ G: UX/UI УЛУЧШЕНИЯ

### G.1 Onboarding wizard для новых участников

**Для нового рекламодателя (после одобрения):**

```
Шаг 1/5: Добро пожаловать!
  → Краткое видео (2 мин) как работает платформа

Шаг 2/5: Пополни баланс
  → Минимум $500 для старта
  → Инструкция по крипто-депозиту

Шаг 3/5: Создай первый оффер
  → Предзаполненный шаблон по вертикали
  → "Создать оффер [Crypto / Gambling / Nutra]"

Шаг 4/5: Настрой интеграцию
  → Скопируй конверсионный URL
  → Вставь postback в свою систему
  → Тест: [Отправить тестовый постбек]

Шаг 5/5: Готово!
  → Оффер отправлен на модерацию
  → Ожидай одобрения (обычно < 24h)
  → Пока изучи документацию...
```

**Для нового вебмастера:**

```
Шаг 1/4: Твой профиль готов
  → Заполни Telegram (для уведомлений)

Шаг 2/4: Найди оффер
  → Отфильтруй по вертикали и гео
  → Подай заявку на 1-3 оффера

Шаг 3/4: Создай ссылку
  → Пока ждёшь одобрения — изучи как работают subid
  → [Интерактивный конструктор ссылки]

Шаг 4/4: Настрой Postback
  → Введи URL своего трекера
  → [Тест — получи тестовую конверсию]
```

### G.2 Publisher Profile (публичный)

Страница профиля вебмастера видна рекламодателям при рассмотрении заявки:

```
╔══════════════════════════════════════════════════════╗
║  Publisher: pub_a8x2k                               ║
║  ─────────────────────────────────────────────────── ║
║  Зарегистрирован: Январь 2025                        ║
║  Traffic Quality Score: 87/100 ⭐                    ║
║  ─────────────────────────────────────────────────── ║
║  ТРАФИК                                              ║
║  Типы: SEO, PPC, Social                             ║
║  Основные гео: RU (45%), UA (30%), KZ (15%)         ║
║  ─────────────────────────────────────────────────── ║
║  СТАТИСТИКА (последние 30 дней)                      ║
║  Конверсий: 1,247     CR: 3.1%                      ║
║  Approval rate: 94%   EPC: $5.20                    ║
║  ─────────────────────────────────────────────────── ║
║  Активные офферы: 12                                 ║
║  Вертикали: Crypto (70%), Gambling (30%)             ║
╚══════════════════════════════════════════════════════╝
```

### G.3 Live Notifications (WebSocket)

```javascript
// Реальном времени — без перезагрузки страницы

// backend/websocket.js (Fastify WebSocket plugin)
fastify.get('/ws', { websocket: true }, (connection, req) => {
  const userId = authenticateWS(req)

  // Подписываем на Redis Pub/Sub
  const sub = redis.duplicate()
  sub.subscribe(`notifications:${userId}`)

  sub.on('message', (channel, message) => {
    connection.socket.send(message)
  })

  connection.socket.on('close', () => sub.unsubscribe())
})

// publisher получает в реальном времени:
// - новая конверсия (PENDING → звук + badge)
// - конверсия одобрена (баланс обновляется)
// - выплата обработана

// advertiser получает:
// - новая заявка вебмастера
// - cap 80% достигнут (предупреждение)
// - cap исчерпан (оффер паузируется авто)

// Фронтенд:
const ws = new WebSocket('wss://api.platform.com/ws?token=' + accessToken)
ws.onmessage = (event) => {
  const notification = JSON.parse(event.data)
  dispatch(addNotification(notification))

  // Toast уведомление
  toast[notification.type](notification.message)
}
```

---

## РАЗДЕЛ H: COMPLIANCE И LEGAL

### H.1 Affiliate Agreement versioning

При регистрации и при обновлении ToS:

```javascript
// Middleware: проверяем принял ли пользователь текущий ToS
async function requireAgreementAcceptance(req, reply) {
  const currentAgreement = await db.affiliateAgreement.findFirst({
    where: { isCurrent: true }
  })

  if (!currentAgreement) return  // нет активного соглашения

  const accepted = await db.agreementAcceptance.findFirst({
    where: {
      userId: req.user.id,
      agreementId: currentAgreement.id
    }
  })

  if (!accepted) {
    return reply.code(403).send({
      error: 'AGREEMENT_REQUIRED',
      message: 'Please accept the updated Terms of Service',
      agreement: { id: currentAgreement.id, version: currentAgreement.version }
    })
  }
}
```

### H.2 GDPR Data Deletion

```javascript
// POST /api/publisher/account/delete-request
// Запрос на удаление аккаунта (GDPR Right to Erasure)

async function handleDataDeletionRequest(userId) {
  // 1. Проверить что нет незавершённых выплат
  const pendingPayouts = await db.payout.count({
    where: { publisher: { userId }, status: { in: ['PENDING', 'PROCESSING'] } }
  })
  if (pendingPayouts > 0) throw new Error('Cannot delete: pending payouts exist')

  // 2. Анонимизировать данные (не удалять для финансовой отчётности)
  await db.user.update({
    where: { id: userId },
    data: {
      email: `deleted_${randomUUID()}@deleted.com`,
      passwordHash: 'DELETED',
      status: 'BANNED',
    }
  })

  await db.profile.update({
    where: { userId },
    data: {
      firstName: null,
      lastName: null,
      telegram: null,
      phone: null,
    }
  })

  // 3. Удалить сессии
  await db.session.deleteMany({ where: { userId } })

  // 4. IP адреса в кликах анонимизируем
  await db.$executeRaw`
    UPDATE clicks SET ip_address = '0.0.0.0', ip_hash = 'deleted'
    WHERE publisher_id = (SELECT id FROM publishers WHERE user_id = ${userId})
  `

  // Конверсии и финансовые записи НЕ удаляем — требование налогового учёта
}
```

### H.3 Чеклист Compliance по вертикалям

**Gambling:**
- [ ] Не принимаем трафик из стран с запретом gambling (US, CN, IN...)
- [ ] Предупреждение 18+ на всех материалах
- [ ] Блок если IP из restricted geos
- [ ] Лог всех транзакций для AML reporting

**Crypto:**
- [ ] Wallet verification при крупных выплатах (> $10,000)
- [ ] Не принимаем трафик с OFAC-санкционных территорий
- [ ] KYC для паблишеров с выплатами > $3,000/месяц (FATF рекомендация)

**Nutra:**
- [ ] Проверка легальности продукта в гео (FDA compliance)
- [ ] Запрет misleading claims в рекламных материалах
- [ ] Мониторинг chargeback rate

---

## РАЗДЕЛ I: ПРОИЗВОДИТЕЛЬНОСТЬ И МАСШТАБ

### I.1 Шардирование clicks таблицы

При объёме > 100M кликов/месяц PostgreSQL partitioning обязателен:

```sql
-- Партиционирование по дате (monthly)
CREATE TABLE clicks (
  id uuid,
  created_at timestamptz NOT NULL,
  ...
) PARTITION BY RANGE (created_at);

CREATE TABLE clicks_2026_03 PARTITION OF clicks
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE clicks_2026_04 PARTITION OF clicks
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

-- Автоматически создавать partition через pg_partman или cron
```

### I.2 ClickHouse для аналитики

При объёме > 50M кликов/месяц PostgreSQL для отчётов становится медленным. Решение — ClickHouse:

```
PostgreSQL → (BullMQ sync) → ClickHouse

ClickHouse используется ТОЛЬКО для:
- Исторические отчёты (> 90 дней)
- Агрегации по большим периодам
- Dashboard графики

PostgreSQL остаётся для:
- Операционных данных
- Последние 90 дней
- Транзакционная логика
```

```javascript
// services/analytics.service.js

export async function getHistoricalStats(publisherId, dateFrom, dateTo) {
  if (daysDiff(dateFrom, dateTo) <= 90) {
    // Быстрый PostgreSQL запрос
    return await db.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as clicks, ...
      FROM clicks WHERE publisher_id = ${publisherId}
      AND created_at BETWEEN ${dateFrom} AND ${dateTo}
      GROUP BY DATE(created_at)
    `
  }

  // Длинный период — ClickHouse
  return await clickhouse.query(`
    SELECT toDate(created_at) as date, count() as clicks, ...
    FROM clicks WHERE publisher_id = '${publisherId}'
    AND created_at BETWEEN '${dateFrom}' AND '${dateTo}'
    GROUP BY date ORDER BY date
  `)
}
```

### I.3 Redis Cluster конфигурация (для масштаба)

```yaml
# docker-compose.yml — Redis Cluster (6 нод: 3 master + 3 replica)
redis-master-1:
  image: redis:7-alpine
  command: redis-server --cluster-enabled yes --cluster-config-file nodes.conf

# Для tracking — отдельный Redis инстанс
redis-tracker:
  image: redis:7-alpine
  command: redis-server --maxmemory 4gb --maxmemory-policy allkeys-lru
  # Только для: link cache, dedup, cap counters, rate limits
  # Данные не критичны — при рестарте восстанавливаются из PostgreSQL
```

---

## РАЗДЕЛ J: ТЕСТОВЫЙ АККАУНТ И DEMO MODE

### J.1 Sandbox окружение для рекламодателей

```javascript
// Рекламодатель может тестировать интеграцию в sandbox

// Тестовый postback (sandbox):
GET https://go-sandbox.platform.com/postback?
  click_id={click_id}&
  secret={sandbox_secret}&
  goal=ftd

// Sandbox конверсии:
// - Не влияют на реальный баланс
// - Помечены тегом "SANDBOX"
// - Можно генерировать сколько угодно

// API для sandbox:
POST /api/advertiser/sandbox/generate-click
  → { click_id: "test-xxx", tracking_link: "https://..." }

POST /api/advertiser/sandbox/send-postback
  { click_id: "test-xxx", goal: "ftd", revenue: 200 }
  → { conversion created in sandbox }

GET /api/advertiser/sandbox/conversions
  → список тестовых конверсий
```

### J.2 Demo Mode для демонстрации платформы

```javascript
// GET /demo
// Создаёт временный демо-аккаунт (TTL: 24 часа)
// Заполнен тестовыми данными:
// - 5 офферов (разные вертикали)
// - 1,000 кликов за последние 7 дней
// - 85 конверсий (разные статусы)
// - $2,450 "баланс"
// - Графики с красивыми данными

// Полезно для:
// - Демонстрации рекламодателям
// - Onboarding новых вебмастеров (видят как будет выглядеть)
// - QA тестирование
```

---

## ИТОГОВЫЙ СПИСОК УЛУЧШЕНИЙ v3

### 🔴 Критические (добавить в Этап 1 MVP)
1. Sandbox режим для тестирования интеграции рекламодателями
2. CTIT анализ — базовый антифрод для мобильного трафика
3. Affiliate Agreement acceptance — юридически обязательно
4. Publisher Traffic Quality Score — без него нельзя оценивать качество трафика
5. Dispute система — паблишеры уйдут без неё

### 🟡 Важные (добавить в Этап 2)
6. Behavioral scoring (JS pixel)
7. Anomaly Detection с авто-алертами
8. Multi-currency балансы
9. Offer Feed / Public API
10. WebSocket notifications
11. Onboarding wizard
12. GDPR data deletion endpoint

### 🟢 Желательные (Этап 3)
13. ClickHouse для исторической аналитики
14. ClickHouse PostgreSQL partitioning
15. Redis Cluster
16. Email hash tracking
17. Fingerprint cookieless tracking
18. Авто-выплаты через Tron API
19. Hot/Cold wallet стратегия
20. Demo Mode

---

*v3 Addons — Март 2026 | Основан на анализе MaxBounty, ClickDealer, Everflow, Impact*
