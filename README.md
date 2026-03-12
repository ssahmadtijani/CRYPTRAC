# CRYPTRAC — Crypto Transaction Reporting and Compliance System

**National Crypto Transaction Monitoring & Tax Compliance System (NCTMTCS)**

A Tax-Focused Proof of Concept aligned with **FATF Recommendation 16 (Travel Rule)** and **AML/CFT Standards**. Built for compliance officers, analysts, and regulators to monitor, classify, and report on cryptocurrency transactions.

---

## Features

- 🔐 **JWT Authentication** with role-based access control (ADMIN, COMPLIANCE_OFFICER, ANALYST, AUDITOR, USER)
- 📊 **Transaction Ingestion & Risk Assessment** — automatic rule-based risk scoring (LOW/MEDIUM/HIGH/CRITICAL)
- 📝 **Compliance Reporting** — SAR (Suspicious Activity Report), CTR (Currency Transaction Report), FATF Travel Rule checks
- 💰 **Tax Calculation Engine** — FIFO cost basis, short/long-term capital gains, mining/staking/airdrop income classification
- 👛 **Wallet Management** — wallet registration, risk scoring, sanctions screening
- 🗄️ **Prisma ORM Schema** — PostgreSQL-ready database models

---

## Architecture Overview

```
src/
├── index.ts                  # Express server entry point
├── types/index.ts            # Core enums and interfaces
├── validators/schemas.ts     # Zod validation schemas
├── middleware/
│   ├── auth.ts               # JWT authentication & RBAC
│   ├── validate.ts           # Zod request validation factory
│   ├── errorHandler.ts       # Global error handler
│   └── requestLogger.ts      # HTTP request logger
├── services/
│   ├── auth.service.ts       # User registration & login
│   ├── transaction.service.ts # Transaction CRUD + risk assessment
│   ├── compliance.service.ts  # SAR/CTR/Travel Rule reports
│   ├── wallet.service.ts      # Wallet management & sanctions
│   ├── tax.service.ts         # Tax event classification & summary
│   └── __tests__/            # Jest unit tests
├── routes/
│   ├── auth.routes.ts
│   ├── transaction.routes.ts
│   ├── compliance.routes.ts
│   └── wallet.routes.ts
└── utils/logger.ts           # Winston logger
prisma/schema.prisma          # PostgreSQL schema
```

---

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register a new user |
| POST | `/api/v1/auth/login` | Login and receive JWT |

### Transactions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/transactions` | ✅ | Submit a new transaction |
| GET | `/api/v1/transactions` | ✅ | List transactions (filterable) |
| GET | `/api/v1/transactions/:id` | ✅ | Get transaction by ID |
| GET | `/api/v1/transactions/:id/risk-assessment` | COMPLIANCE_OFFICER+ | Get risk assessment |

### Compliance
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/compliance/sar/:transactionId` | COMPLIANCE_OFFICER+ | Generate SAR |
| POST | `/api/v1/compliance/ctr/:transactionId` | COMPLIANCE_OFFICER+ | Generate CTR |
| POST | `/api/v1/compliance/travel-rule/:transactionId` | ✅ | Check FATF Travel Rule |
| GET | `/api/v1/compliance/reports` | ✅ | List compliance reports |
| PATCH | `/api/v1/compliance/reports/:id/review` | COMPLIANCE_OFFICER+ | Review/approve report |

### Wallets
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/v1/wallets` | ✅ | Register a wallet |
| GET | `/api/v1/wallets` | ✅ | List wallets |
| GET | `/api/v1/wallets/:address` | ✅ | Get wallet by address |
| PATCH | `/api/v1/wallets/:address/risk-score` | COMPLIANCE_OFFICER+ | Update risk score |
| GET | `/api/v1/wallets/:address/sanctions` | ✅ | Sanctions screening |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- PostgreSQL (for production; in-memory store used for PoC)

### Installation

```bash
git clone https://github.com/ssahmadtijani/CRYPTRAC.git
cd CRYPTRAC
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `NODE_ENV` | Environment | `development` |
| `JWT_SECRET` | JWT signing secret | *(required)* |
| `JWT_EXPIRES_IN` | Token expiry | `24h` |
| `DATABASE_URL` | PostgreSQL connection URL | *(required for DB)* |
| `LOG_LEVEL` | Winston log level | `info` |

### Run Development Server

```bash
npm run dev
```

### Run Tests

```bash
npm test
```

### Build

```bash
npm run build
```

### Database Migration (PostgreSQL)

```bash
npm run migrate
```

---

## Tax Classification Rules

| Transaction Type | Tax Event |
|-----------------|-----------|
| TRADE / SWAP / WITHDRAWAL | Capital Gain (Short/Long term, FIFO cost basis) |
| MINING | Mining Income (ordinary income at FMV) |
| STAKING | Staking Reward (ordinary income at FMV) |
| AIRDROP | Airdrop Income (ordinary income at FMV) |

**Holding Period Classification:**
- Short-term: ≤ 1 year
- Long-term: > 1 year

---

## Risk Assessment Rules

| Condition | Risk Level |
|-----------|------------|
| Address on sanctions list | CRITICAL |
| Amount ≥ $10,000 USD | HIGH |
| TRANSFER and amount ≥ $5,000 USD | HIGH |
| Amount ≥ $3,000 USD | MEDIUM |
| Otherwise | LOW |

**Travel Rule Threshold:** $1,000 USD (FATF Recommendation 16)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + TypeScript |
| Framework | Express.js |
| Validation | Zod |
| Authentication | JSON Web Tokens (jsonwebtoken) |
| Password Hashing | bcryptjs |
| Logging | Winston |
| ORM | Prisma (PostgreSQL) |
| Testing | Jest + ts-jest |
| Blockchain Utils | ethers.js |

---

## License

MIT © ssahmadtijani
