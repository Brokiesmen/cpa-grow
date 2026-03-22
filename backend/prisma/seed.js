import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcrypt'

const prisma = new PrismaClient()

// Nano-banana themed test images from picsum (deterministic seeds)
const IMAGES = {
  gambling: 'https://picsum.photos/seed/gambling-nano/400/220',
  crypto:   'https://picsum.photos/seed/crypto-nano/400/220',
  nutra:    'https://picsum.photos/seed/nutra-banana/400/220',
  finance:  'https://picsum.photos/seed/finance-nano/400/220',
  dating:   'https://picsum.photos/seed/dating-nano/400/220',
  other:    'https://picsum.photos/seed/other-banana/400/220',
}

async function main() {
  console.log('🍌 Seeding nano-banana test data...')

  // ─── ADMIN ───────────────────────────────────────────
  const adminHash = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@cpagrow.test' },
    update: {},
    create: {
      email: 'admin@cpagrow.test',
      passwordHash: adminHash,
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  console.log('✅ Admin:', admin.email)

  // ─── ADVERTISERS ─────────────────────────────────────
  const advHash = await bcrypt.hash('adv123', 10)

  const advUser1 = await prisma.user.upsert({
    where: { email: 'nanobana-adv@cpagrow.test' },
    update: {},
    create: {
      email: 'nanobana-adv@cpagrow.test',
      passwordHash: advHash,
      role: 'ADVERTISER',
      status: 'ACTIVE',
    },
  })
  const adv1 = await prisma.advertiser.upsert({
    where: { userId: advUser1.id },
    update: {},
    create: {
      userId: advUser1.id,
      companyName: 'NanoBanana Inc.',
      website: 'https://nanobana.test',
      balance: 25000,
    },
  })

  const advUser2 = await prisma.user.upsert({
    where: { email: 'banana-crypto@cpagrow.test' },
    update: {},
    create: {
      email: 'banana-crypto@cpagrow.test',
      passwordHash: advHash,
      role: 'ADVERTISER',
      status: 'ACTIVE',
    },
  })
  const adv2 = await prisma.advertiser.upsert({
    where: { userId: advUser2.id },
    update: {},
    create: {
      userId: advUser2.id,
      companyName: 'BananaCrypto Ltd.',
      website: 'https://banana-crypto.test',
      balance: 10000,
    },
  })

  console.log('✅ Advertisers:', adv1.id, adv2.id)

  // ─── PUBLISHERS ──────────────────────────────────────
  const pubHash = await bcrypt.hash('pub123', 10)

  const pubUser1 = await prisma.user.upsert({
    where: { email: 'pub1@cpagrow.test' },
    update: {},
    create: {
      email: 'pub1@cpagrow.test',
      passwordHash: pubHash,
      role: 'PUBLISHER',
      status: 'ACTIVE',
    },
  })
  const pub1 = await prisma.publisher.upsert({
    where: { userId: pubUser1.id },
    update: {},
    create: {
      userId: pubUser1.id,
      username: 'nano_banana_traffic',
      telegram: '@nanobana_pub',
      trafficTypes: ['SEO', 'SOCIAL'],
      trafficQualityScore: 78,
    },
  })

  const pubUser2 = await prisma.user.upsert({
    where: { email: 'pub2@cpagrow.test' },
    update: {},
    create: {
      email: 'pub2@cpagrow.test',
      passwordHash: pubHash,
      role: 'PUBLISHER',
      status: 'ACTIVE',
    },
  })
  const pub2 = await prisma.publisher.upsert({
    where: { userId: pubUser2.id },
    update: {},
    create: {
      userId: pubUser2.id,
      username: 'bananapush_pro',
      telegram: '@bananapush',
      trafficTypes: ['PUSH', 'NATIVE'],
      trafficQualityScore: 62,
    },
  })

  const pubUser3 = await prisma.user.upsert({
    where: { email: 'pub3@cpagrow.test' },
    update: {},
    create: {
      email: 'pub3@cpagrow.test',
      passwordHash: pubHash,
      role: 'PUBLISHER',
      status: 'ACTIVE',
    },
  })
  const pub3 = await prisma.publisher.upsert({
    where: { userId: pubUser3.id },
    update: {},
    create: {
      userId: pubUser3.id,
      username: 'yellow_media',
      trafficTypes: ['PPC', 'DISPLAY'],
      trafficQualityScore: 91,
    },
  })

  console.log('✅ Publishers:', pub1.username, pub2.username, pub3.username)

  // ─── PUBLISHER BALANCES ───────────────────────────────
  await prisma.publisherBalance.upsert({
    where: { publisherId_currency: { publisherId: pub1.id, currency: 'USD' } },
    update: {},
    create: { publisherId: pub1.id, currency: 'USD', available: 1234.50, hold: 320.00 },
  })
  await prisma.publisherBalance.upsert({
    where: { publisherId_currency: { publisherId: pub2.id, currency: 'USD' } },
    update: {},
    create: { publisherId: pub2.id, currency: 'USD', available: 580.00, hold: 90.00 },
  })
  await prisma.publisherBalance.upsert({
    where: { publisherId_currency: { publisherId: pub3.id, currency: 'USD' } },
    update: {},
    create: { publisherId: pub3.id, currency: 'USD', available: 4100.00, hold: 0 },
  })

  // ─── OFFERS ──────────────────────────────────────────
  const offersData = [
    {
      advertiserId: adv1.id,
      name: '🍌 NanoBanana Casino — Tier1',
      description: 'Высококонвертирующий гемблинг оффер для Tier-1 гео. Уникальный бренд с банановой тематикой. Проверенная воронка.',
      vertical: 'GAMBLING',
      paymentModel: 'CPA',
      payout: 85.00,
      allowedGeos: ['US', 'CA', 'AU', 'NZ', 'DE'],
      allowedTraffic: ['SEO', 'PUSH', 'NATIVE'],
      previewUrl: IMAGES.gambling,
      landingUrl: 'https://nanobana-casino.test/lp1',
      dailyCap: 200,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv1.id,
      name: '🍌 BananaCasino — CIS Bundle',
      description: 'Гемблинг под СНГ рынок. Высокая апрув рейт. Мин. депозит $10. Exclusive.',
      vertical: 'GAMBLING',
      paymentModel: 'CPA',
      payout: 35.00,
      allowedGeos: ['RU', 'UA', 'KZ', 'BY', 'UZ'],
      allowedTraffic: ['PUSH', 'NATIVE', 'DISPLAY', 'PPC'],
      previewUrl: IMAGES.gambling,
      landingUrl: 'https://banana-cis.test/lp',
      dailyCap: 500,
      weeklyCap: 2000,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv2.id,
      name: '🪙 NanoCoin Exchange — CPL',
      description: 'Регистрация на крипто-бирже. Простая цель — верифицированный email. Крупный бренд.',
      vertical: 'CRYPTO',
      paymentModel: 'CPL',
      payout: 18.50,
      allowedGeos: ['US', 'GB', 'DE', 'FR', 'PL'],
      allowedTraffic: ['SEO', 'PPC', 'SOCIAL', 'EMAIL'],
      previewUrl: IMAGES.crypto,
      landingUrl: 'https://nanocoin.test/register',
      dailyCap: 300,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv2.id,
      name: '🪙 BananaToken ICO — RevShare',
      description: 'RevShare оффер по крипто-инвестициям. 25% от прибыли платформы. Lifetime.',
      vertical: 'CRYPTO',
      paymentModel: 'REVSHARE',
      payout: 25.00,
      allowedGeos: ['DE', 'NL', 'AT', 'CH', 'SE'],
      allowedTraffic: ['SEO', 'NATIVE', 'EMAIL'],
      previewUrl: IMAGES.crypto,
      landingUrl: 'https://banatoken.test/invest',
      status: 'ACTIVE',
    },
    {
      advertiserId: adv1.id,
      name: '💊 NutraBanana Slim — NUTRA',
      description: 'Похудение с экстрактом нано-банана. Работает на женщин 25-45. COD. Высокий апрув.',
      vertical: 'NUTRA',
      paymentModel: 'CPA',
      payout: 22.00,
      allowedGeos: ['RU', 'UA', 'PL', 'RO', 'BG'],
      allowedTraffic: ['NATIVE', 'PUSH', 'DISPLAY', 'SOCIAL'],
      previewUrl: IMAGES.nutra,
      landingUrl: 'https://nutra-banana.test/slim',
      dailyCap: 150,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv1.id,
      name: '💊 BananaPower — Male Enhancement',
      description: 'Нутра для мужчин. Высокие payouts. Tier2/Tier3 гео. Показатель CR 8-12%.',
      vertical: 'NUTRA',
      paymentModel: 'CPA',
      payout: 28.00,
      allowedGeos: ['BR', 'MX', 'AR', 'CL', 'CO'],
      allowedTraffic: ['NATIVE', 'PUSH', 'ADULT'],
      previewUrl: IMAGES.nutra,
      landingUrl: 'https://bpower.test/men',
      dailyCap: 100,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv2.id,
      name: '💰 NanoLoan Express — Finance',
      description: 'Займы онлайн. CPL за заявку. Апрув 45%. Широкий набор гео.',
      vertical: 'FINANCE',
      paymentModel: 'CPL',
      payout: 12.00,
      allowedGeos: ['RU', 'UA', 'KZ', 'PL', 'CZ'],
      allowedTraffic: ['SEO', 'PPC', 'PUSH', 'NATIVE'],
      previewUrl: IMAGES.finance,
      landingUrl: 'https://nanoloan.test/apply',
      dailyCap: 1000,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv1.id,
      name: '💕 BananaDating Premium — Dating',
      description: 'Дейтинг с высокими payouts. SOI/DOI. Tier1 гео. 18+.',
      vertical: 'DATING',
      paymentModel: 'CPL',
      payout: 5.50,
      allowedGeos: ['US', 'CA', 'AU', 'GB'],
      allowedTraffic: ['PUSH', 'NATIVE', 'DISPLAY', 'SOCIAL', 'ADULT'],
      previewUrl: IMAGES.dating,
      landingUrl: 'https://banana-dating.test/join',
      dailyCap: 2000,
      status: 'ACTIVE',
    },
    {
      advertiserId: adv2.id,
      name: '🎯 NanoCPA Test Offer — DRAFT',
      description: 'Тестовый оффер в статусе DRAFT. Видят только рекламодатель и админ.',
      vertical: 'OTHER',
      paymentModel: 'CPA',
      payout: 10.00,
      allowedGeos: ['US'],
      allowedTraffic: ['SEO'],
      previewUrl: IMAGES.other,
      landingUrl: 'https://test.cpagrow.test',
      status: 'DRAFT',
    },
    {
      advertiserId: adv1.id,
      name: '🔍 BananaInstall — CPI Mobile',
      description: 'CPI установка мобильного приложения. Android/iOS. Tier1.',
      vertical: 'OTHER',
      paymentModel: 'CPI',
      payout: 3.20,
      allowedGeos: ['US', 'CA', 'AU', 'GB', 'DE'],
      allowedTraffic: ['PUSH', 'DISPLAY', 'SOCIAL'],
      previewUrl: IMAGES.other,
      landingUrl: 'https://binstall.test/app',
      dailyCap: 500,
      status: 'PENDING_REVIEW',
    },
  ]

  const createdOffers = []
  for (const offerData of offersData) {
    const existing = await prisma.offer.findFirst({ where: { name: offerData.name, advertiserId: offerData.advertiserId } })
    if (!existing) {
      const offer = await prisma.offer.create({ data: offerData })
      createdOffers.push(offer)
    } else {
      createdOffers.push(existing)
    }
  }
  console.log(`✅ Offers: ${createdOffers.length} created`)

  // Add creatives (banners) to first 3 offers
  const creativeData = [
    { name: 'Banner 728x90', type: 'banner', url: 'https://picsum.photos/seed/banner1-nano/728/90', size: '728x90' },
    { name: 'Banner 300x250', type: 'banner', url: 'https://picsum.photos/seed/banner2-nano/300/250', size: '300x250' },
    { name: 'Promo Text', type: 'text', content: '🍌 Играй и выигрывай с NanoBanana Casino! Бонус 100% на первый депозит!', size: null },
  ]
  for (let i = 0; i < Math.min(3, createdOffers.length); i++) {
    for (const c of creativeData) {
      await prisma.creative.upsert({
        where: { id: `seed-creative-${i}-${c.name}`.slice(0, 36) },
        update: {},
        create: { ...c, offerId: createdOffers[i].id },
      }).catch(() => {})
    }
  }

  // ─── APPLICATIONS ─────────────────────────────────────
  const activeOffers = createdOffers.filter(o => o.status === 'ACTIVE')
  const appCombos = [
    { publisherId: pub1.id, offerIdx: 0, status: 'APPROVED' },
    { publisherId: pub1.id, offerIdx: 1, status: 'APPROVED' },
    { publisherId: pub1.id, offerIdx: 4, status: 'PENDING' },
    { publisherId: pub2.id, offerIdx: 0, status: 'APPROVED' },
    { publisherId: pub2.id, offerIdx: 2, status: 'APPROVED' },
    { publisherId: pub3.id, offerIdx: 0, status: 'APPROVED' },
    { publisherId: pub3.id, offerIdx: 1, status: 'APPROVED' },
    { publisherId: pub3.id, offerIdx: 3, status: 'APPROVED' },
    { publisherId: pub3.id, offerIdx: 6, status: 'REJECTED' },
  ]
  for (const { publisherId, offerIdx, status } of appCombos) {
    if (!activeOffers[offerIdx]) continue
    await prisma.application.upsert({
      where: { publisherId_offerId: { publisherId, offerId: activeOffers[offerIdx].id } },
      update: {},
      create: { publisherId, offerId: activeOffers[offerIdx].id, status },
    })
  }
  console.log('✅ Applications seeded')

  // ─── CLICKS ───────────────────────────────────────────
  const countries = ['US', 'DE', 'CA', 'RU', 'UA', 'PL', 'AU']
  const devices = ['mobile', 'desktop', 'tablet']
  const oses = ['iOS', 'Android', 'Windows', 'macOS']
  const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge']

  const clicks = []
  for (let i = 0; i < 80; i++) {
    const pub = [pub1, pub2, pub3][i % 3]
    const offer = activeOffers[i % activeOffers.length]
    const daysAgo = Math.floor(i / 5)
    const createdAt = new Date(Date.now() - daysAgo * 86400000 - Math.random() * 3600000)
    const click = await prisma.click.create({
      data: {
        publisherId: pub.id,
        offerId: offer.id,
        subid1: `nano_${i}`,
        ipAddress: `185.${10 + (i % 200)}.${i % 255}.${(i * 7) % 255}`,
        country: countries[i % countries.length],
        city: ['New York', 'Berlin', 'Toronto', 'Moscow', 'Kyiv', 'Warsaw'][i % 6],
        deviceType: devices[i % devices.length],
        os: oses[i % oses.length],
        browser: browsers[i % browsers.length],
        isUnique: i % 7 !== 0,
        isFraud: i % 15 === 0,
        fraudScore: i % 15 === 0 ? 75 + (i % 25) : i % 20,
        createdAt,
      },
    })
    clicks.push(click)
  }
  console.log(`✅ Clicks: ${clicks.length}`)

  // ─── CONVERSIONS ──────────────────────────────────────
  const convStatuses = ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING', 'PENDING', 'REJECTED', 'HOLD']
  const convClicks = clicks.filter((_, i) => i % 4 === 0)

  for (let i = 0; i < convClicks.length; i++) {
    const click = convClicks[i]
    const offer = activeOffers.find(o => o.id === click.offerId)
    if (!offer) continue
    const status = convStatuses[i % convStatuses.length]
    const adv = offer.advertiserId === adv1.id ? adv1 : adv2
    await prisma.conversion.upsert({
      where: { clickId: click.clickId },
      update: {},
      create: {
        clickId: click.clickId,
        publisherId: click.publisherId,
        offerId: click.offerId,
        advertiserId: adv.id,
        payout: offer.payout,
        revenue: Number(offer.payout) * 1.3,
        status,
        country: click.country,
        approvedAt: status === 'APPROVED' ? new Date(click.createdAt.getTime() + 3600000) : null,
        createdAt: new Date(click.createdAt.getTime() + 1800000 + Math.random() * 3600000),
      },
    })
  }
  console.log('✅ Conversions seeded')

  // ─── PAYOUTS ──────────────────────────────────────────
  const payoutsData = [
    { publisherId: pub1.id, amount: 500, method: 'USDT_TRC20', requisites: { address: 'TBananaNano1xxxxxxxxxxxxxxxxxxx' }, status: 'COMPLETED', adminNote: 'Paid via TRC20' },
    { publisherId: pub1.id, amount: 200, method: 'BTC', requisites: { address: '1BananaNanoXXXXXXXXXXXXXXXXXXXX' }, status: 'PENDING' },
    { publisherId: pub3.id, amount: 1000, method: 'USDT_ERC20', requisites: { address: '0xBananaNano123456789abcdef' }, status: 'PROCESSING' },
    { publisherId: pub2.id, amount: 150, method: 'WEBMONEY', requisites: { wallet: 'Z123456789000' }, status: 'FAILED', adminNote: 'Wrong wallet format' },
  ]
  for (const p of payoutsData) {
    await prisma.payout.create({ data: p }).catch(() => {})
  }
  console.log('✅ Payouts seeded')

  // ─── FRAUD ALERTS ─────────────────────────────────────
  await prisma.fraudAlert.createMany({
    data: [
      { publisherId: pub2.id, offerId: activeOffers[0]?.id, rule: 'HIGH_FRAUD_SCORE', severity: 'HIGH', message: 'Publisher pub2 has 18% fraud rate on NanoBanana Casino. Threshold: 10%.' },
      { publisherId: pub2.id, rule: 'DUPLICATE_IP', severity: 'MEDIUM', message: 'Multiple conversions from same IP subnet detected.' },
      { publisherId: pub1.id, offerId: activeOffers[1]?.id, rule: 'LOW_CTIT', severity: 'LOW', message: 'Average CTIT is 4 seconds, suspicious fast conversions.', isResolved: true, resolvedAt: new Date() },
    ],
    skipDuplicates: true,
  })
  console.log('✅ Fraud alerts seeded')

  // ─── PUBLISHER TRANSACTIONS ───────────────────────────
  await prisma.publisherTransaction.createMany({
    data: [
      { publisherId: pub1.id, type: 'CONVERSION', amount: 85, currency: 'USD', description: 'Conversion #1 approved' },
      { publisherId: pub1.id, type: 'CONVERSION', amount: 85, currency: 'USD', description: 'Conversion #2 approved' },
      { publisherId: pub1.id, type: 'PAYOUT', amount: -500, currency: 'USD', description: 'Payout USDT TRC20' },
      { publisherId: pub1.id, type: 'REFERRAL_BONUS', amount: 12.5, currency: 'USD', description: 'Referral bonus from bananapush_pro' },
      { publisherId: pub2.id, type: 'CONVERSION', amount: 35, currency: 'USD', description: 'Conversion approved' },
      { publisherId: pub3.id, type: 'CONVERSION', amount: 85, currency: 'USD', description: 'Conversion approved' },
      { publisherId: pub3.id, type: 'CONVERSION', amount: 18.5, currency: 'USD', description: 'CPL conversion' },
      { publisherId: pub3.id, type: 'ADJUSTMENT', amount: -50, currency: 'USD', description: 'Admin adjustment: fraud rollback' },
    ],
  }).catch(() => {})
  console.log('✅ Transactions seeded')

  // ─── NOTIFICATIONS ────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      { userId: pubUser1.id, type: 'CONVERSION_APPROVED', title: 'Конверсия одобрена', message: 'Ваша конверсия по офферу NanoBanana Casino на $85 одобрена.' },
      { userId: pubUser1.id, type: 'PAYOUT_COMPLETED', title: 'Выплата завершена', message: 'Выплата $500 USDT TRC20 успешно отправлена.' },
      { userId: pubUser2.id, type: 'FRAUD_ALERT', title: 'Предупреждение о фроде', message: 'Обнаружена подозрительная активность. Проверьте источники трафика.' },
      { userId: pubUser3.id, type: 'APPLICATION_APPROVED', title: 'Заявка одобрена', message: 'Ваша заявка на оффер BananaToken ICO одобрена.' },
      { userId: advUser1.id, type: 'OFFER_REVIEW', title: 'Оффер на проверке', message: 'Ваш оффер BananaInstall отправлен на модерацию.' },
    ],
  }).catch(() => {})
  console.log('✅ Notifications seeded')

  console.log('\n🍌 SEED COMPLETE! Test accounts:')
  console.log('─────────────────────────────────────')
  console.log('ADMIN:       admin@cpagrow.test       / admin123')
  console.log('ADVERTISER:  nanobana-adv@cpagrow.test / adv123')
  console.log('ADVERTISER:  banana-crypto@cpagrow.test / adv123')
  console.log('PUBLISHER:   pub1@cpagrow.test         / pub123')
  console.log('PUBLISHER:   pub2@cpagrow.test         / pub123')
  console.log('PUBLISHER:   pub3@cpagrow.test         / pub123')
  console.log('─────────────────────────────────────')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
