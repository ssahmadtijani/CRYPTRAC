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

Aligned with FATF Recommendation 16 (Travel Rule) and AML/CFT Standards.

## Status

Under active development — Tax-Focused Proof of Concept in progress.
