# CRYPTRAC — National Crypto Transaction Monitoring & Tax Compliance System (NCTMTCS)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)

CRYPTRAC is a **Crypto Transaction Reporting and Compliance System** aligned with **FATF Recommendation 16 (Travel Rule)**, AML/CFT standards, and tax reporting requirements. It provides a robust API for monitoring crypto transactions, generating compliance reports (SAR, CTR, Travel Rule), and calculating tax obligations using FIFO cost basis methodology.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Setup Instructions](#setup-instructions)
- [API Endpoints](#api-endpoints)
- [Compliance Features](#compliance-features)
- [Tax Calculation Features](#tax-calculation-features)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

CRYPTRAC is designed to help Virtual Asset Service Providers (VASPs), exchanges, and compliance teams:

- **Monitor** crypto transactions in real-time with automated risk scoring
- **Generate** regulatory reports: Suspicious Activity Reports (SAR), Currency Transaction Reports (CTR), and FATF Travel Rule data
- **Calculate** tax obligations using FIFO cost basis (capital gains, mining income, staking rewards, airdrops)
- **Screen** wallet addresses against sanctions lists (OFAC, UN)
- **Enforce** role-based access control for compliance officers, analysts, and auditors

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Express HTTP API                      │
│  /auth  /transactions  /compliance  /wallets             │
├─────────────────────────────────────────────────────────┤
│                   Middleware Layer                        │
│  JWT Auth · Role RBAC · Zod Validation · Request Logger  │
├─────────────────────────────────────────────────────────┤
│                    Service Layer                          │
│  AuthService · TransactionService · ComplianceService    │
│  WalletService · TaxService                              │
├─────────────────────────────────────────────────────────┤
│                   Data Layer (Prisma)                    │
│  PostgreSQL · User · Transaction · Wallet                │
│  ComplianceReport · TaxEvent · TravelRuleData            │
└─────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **TypeScript** | 5.x | Language |
| **Express** | 4.x | HTTP framework |
| **Prisma** | 5.x | ORM / Database client |
| **PostgreSQL** | 15+ | Primary database |
| **Zod** | 3.x | Runtime validation |
| **jsonwebtoken** | 9.x | JWT authentication |
| **bcryptjs** | 2.x | Password hashing |
| **ethers.js** | 6.x | Blockchain utilities |
| **Winston** | 3.x | Structured logging |
| **Jest + ts-jest** | 29.x | Testing |
| **Helmet** | 8.x | Security headers |

---

## Directory Structure

```
CRYPTRAC/
├── prisma/
│   └── schema.prisma          # Database schema (User, Transaction, Wallet, ...)
├── src/
│   ├── index.ts               # Express app entry point
│   ├── types/
│   │   └── index.ts           # Core enums & interfaces
│   ├── validators/
│   │   └── schemas.ts         # Zod validation schemas
│   ├── middleware/
│   │   ├── auth.ts            # JWT authentication & RBAC
│   │   ├── validate.ts        # Generic Zod validation middleware
│   │   ├── errorHandler.ts    # Global error handler
│   │   └── requestLogger.ts   # HTTP request logger
│   ├── services/
│   │   ├── auth.service.ts        # Registration, login, JWT
│   │   ├── transaction.service.ts # Transaction CRUD + risk scoring
│   │   ├── compliance.service.ts  # SAR, CTR, Travel Rule
│   │   ├── wallet.service.ts      # Wallet registry + sanctions
│   │   ├── tax.service.ts         # FIFO cost basis + tax events
│   │   └── __tests__/
│   │       ├── tax.service.test.ts
│   │       └── compliance.service.test.ts
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── transaction.routes.ts
│   │   ├── compliance.routes.ts
│   │   └── wallet.routes.ts
│   └── utils/
│       └── logger.ts          # Winston logger configuration
├── .env.example
├── jest.config.js
├── package.json
└── tsconfig.json
```

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm 10+

### 1. Clone the Repository

```bash
git clone https://github.com/ssahmadtijani/CRYPTRAC.git
cd CRYPTRAC
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cryptrac"
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRY="24h"
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### 4. Database Setup

```bash
# Run migrations
npm run migrate

# (Optional) Seed the database
npm run seed
```

### 5. Run the Application

```bash
# Development (with hot reload)
npm run dev

# Production build
npm run build
npm start
```

### 6. Run Tests

```bash
npm test
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | None |
| `POST` | `/auth/login` | Login and receive JWT | None |

**Register request body:**
```json
{
  "email": "compliance@example.com",
  "password": "SecurePass123",
  "firstName": "Jane",
  "lastName": "Doe",
  "role": "COMPLIANCE_OFFICER"
}
```

**Login response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5...",
    "user": { "id": "...", "email": "...", "role": "COMPLIANCE_OFFICER" }
  }
}
```

---

### Transactions

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/transactions` | Create transaction | 🔒 Any |
| `GET` | `/transactions` | List transactions (filtered) | 🔒 Any |
| `GET` | `/transactions/:id` | Get transaction by ID | 🔒 Any |
| `POST` | `/transactions/:id/assess` | Trigger risk assessment | 🔒 Compliance Officer+ |

**Create transaction request body:**
```json
{
  "txHash": "0xabc123...",
  "type": "TRANSFER",
  "senderAddress": "0xSender...",
  "receiverAddress": "0xReceiver...",
  "asset": "ETH",
  "amount": 5.0,
  "amountUSD": 15000,
  "fee": 0.001,
  "feeUSD": 3,
  "network": "ethereum",
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Query filters for `GET /transactions`:**
- `type`, `riskLevel`, `complianceStatus`, `asset`, `network`
- `startDate`, `endDate`, `minAmountUSD`, `maxAmountUSD`
- `senderAddress`, `receiverAddress`
- `page`, `pageSize`, `sortBy`, `sortOrder`

---

### Compliance

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/compliance/check/:transactionId` | Run all compliance checks | 🔒 Compliance Officer+ |
| `GET` | `/compliance/reports` | List compliance reports | 🔒 Any |
| `GET` | `/compliance/reports/:id` | Get report by ID | 🔒 Any |
| `POST` | `/compliance/sar/:transactionId` | Generate SAR | 🔒 Compliance Officer+ |
| `POST` | `/compliance/travel-rule/:transactionId` | Travel Rule check | 🔒 Compliance Officer+ |

---

### Wallets

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/wallets` | Register a wallet | 🔒 Any |
| `GET` | `/wallets/:address` | Get wallet info | 🔒 Any |
| `PUT` | `/wallets/:address/risk` | Recalculate risk score | 🔒 Compliance Officer+ |
| `GET` | `/wallets/:address/sanctions` | Check sanctions list | 🔒 Any |

---

## Compliance Features

### FATF Travel Rule (Recommendation 16)

CRYPTRAC enforces the FATF Travel Rule for transfers **≥ $1,000 USD**:

- Captures originator and beneficiary information (name, address, VASP details)
- Generates a `TRAVEL_RULE` compliance report automatically
- Flags non-compliant transfers where VASP information is unverified
- Stores originator/beneficiary VASP identifiers for regulatory submission

### Suspicious Activity Reports (SAR)

- Automatically triggered for transactions **≥ $10,000 USD**
- Includes risk score, transaction details, and investigative narrative
- Supports compliance officer review workflow (`PENDING → APPROVED/REJECTED`)

### Currency Transaction Reports (CTR)

- Automatically triggered for cash-equivalent transactions **≥ $10,000 USD**
- Captures full transaction metadata for regulatory filing

### Risk Scoring

Transactions and wallets receive automated risk scores (0–100) based on:

| Factor | Score Impact |
|---|---|
| Amount ≥ $100,000 | +40 |
| Amount ≥ $10,000 | +25 |
| Amount ≥ $1,000 | +10 |
| Sanctioned address (sender or receiver) | +50 |
| Round-number structuring indicators | +5 |

Risk levels: `LOW` (0–24) · `MEDIUM` (25–49) · `HIGH` (50–74) · `CRITICAL` (75–100)

---

## Tax Calculation Features

### Supported Tax Event Types

| Type | Trigger | Tax Treatment |
|---|---|---|
| `CAPITAL_GAIN_SHORT` | TRADE / SWAP (< 365 days) | Short-term capital gains rate |
| `CAPITAL_GAIN_LONG` | TRADE / SWAP (≥ 365 days) | Long-term capital gains rate |
| `MINING_INCOME` | MINING transactions | Ordinary income |
| `STAKING_REWARD` | STAKING transactions | Ordinary income |
| `AIRDROP_INCOME` | AIRDROP transactions | Ordinary income |

### FIFO Cost Basis

CRYPTRAC uses **First-In, First-Out (FIFO)** methodology:

1. Tracks all acquisition lots per asset with cost-per-unit and acquisition date
2. On disposal, consumes oldest lots first
3. Calculates realized gain/loss = proceeds − cost basis
4. Determines holding period to classify short-term vs long-term gains

### Tax Summary Generation

```
GET /api/v1/tax/summary?userId=...&taxYear=2024   (coming soon)
```

Returns:
- Total short-term and long-term capital gains/losses
- Total income (mining + staking + airdrops)
- Total taxable income
- Estimated tax owed

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

Please ensure:
- All tests pass: `npm test`
- TypeScript compiles: `npm run build`
- Code is formatted: `npm run format`

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

*CRYPTRAC is built for compliance professionals, tax authorities, and VASPs operating under AML/CFT frameworks including FATF, FinCEN, FINTRAC, and related national regulations.*
 — Crypto Transaction Reporting and Compliance System

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
