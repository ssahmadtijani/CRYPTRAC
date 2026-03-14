# CRYPTRAC — National Crypto Transaction Monitoring & Tax Compliance System (NCTMTCS)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)

CRYPTRAC is a **Crypto Transaction Reporting and Compliance System** aligned with **FATF Recommendation 16 (Travel Rule)**, AML/CFT standards, and tax reporting requirements. It provides a REST API backend and a React dashboard frontend for monitoring crypto transactions, generating compliance reports (SAR, CTR, Travel Rule), and calculating tax obligations using FIFO cost basis methodology.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Setup Instructions](#setup-instructions)
- [Running the Frontend](#running-the-frontend)
- [Running Both Together](#running-both-together)
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
- **Visualise** all of the above in a dark-themed React dashboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│         React + TypeScript Frontend (port 5173)         │
│  Dashboard · Transactions · Wallets · Compliance        │
│  Vite proxy → /api → http://localhost:3000              │
├─────────────────────────────────────────────────────────┤
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

### Backend

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

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Language |
| **Vite** | 5.x | Build tool / dev server |
| **React Router** | 6.x | Client-side routing |
| **Axios** | 1.x | HTTP client |

---

## Directory Structure

```
CRYPTRAC/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/                       # Backend source
│   ├── index.ts               # Express app entry point
│   ├── types/index.ts         # Core enums & interfaces
│   ├── validators/schemas.ts  # Zod validation schemas
│   ├── middleware/            # Auth, RBAC, validation, logging
│   ├── services/              # Business logic (auth, tx, compliance, wallet, tax)
│   ├── routes/                # Express route handlers
│   └── utils/logger.ts        # Winston logger
├── client/                    # Frontend source
│   ├── index.html
│   ├── vite.config.ts         # Vite config with /api proxy
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.css            # Dark professional theme
│       ├── api/client.ts      # Axios client with JWT headers
│       ├── context/AuthContext.tsx
│       ├── components/        # Layout, Sidebar, StatsCard, Badges, Toast
│       ├── pages/             # Login, Register, Dashboard, Transactions,
│       │                      # TransactionDetail, Wallets, Compliance
│       └── types/index.ts     # Frontend type mirrors of backend types
├── .env.example
├── jest.config.js
├── package.json
└── tsconfig.json
```

---

## Setup Instructions

### Prerequisites

- Node.js 20+
- npm 10+
- PostgreSQL 17+

### 1. Clone the Repository

```bash
git clone https://github.com/ssahmadtijani/CRYPTRAC.git
cd CRYPTRAC
```

### 2. Install Backend Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/cryptrac?schema=public"
JWT_SECRET="your-secret-key-min-32-chars"
JWT_EXPIRY="24h"
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
```

### 4. Set Up the Database

```bash
# Create the database
createdb cryptrac

# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client (if not already done)
npx prisma generate

# (Optional) Seed demo data
npm run seed
```

### 5. Run the Backend

```bash
# Development (with hot reload)
npm run dev
```

The API will be available at `http://localhost:3000`.

### 6. Run Tests

```bash
npm test
```

---

## Running the Frontend

### Install Frontend Dependencies

```bash
npm run client:install
# or: cd client && npm install
```

### Start the Frontend Dev Server

```bash
npm run client:dev
# or: cd client && npm run dev
```

Open **http://localhost:5173** in your browser. The Vite dev server proxies all `/api` requests to the backend on port 3000.

### Frontend Pages

| URL | Page | Description |
|-----|------|-------------|
| `/login` | Login | Sign in with email/password |
| `/register` | Register | Create a new account |
| `/` | Dashboard | Stats overview + recent transactions |
| `/transactions` | Transactions | Full table with risk colour-coding |
| `/transactions/:id` | Transaction Detail | Details + run risk assessment |
| `/wallets` | Wallets | Register + lookup wallets |
| `/compliance` | Compliance | Reports table + trigger SAR/travel rule |

---

## Running Both Together

```bash
npm run dev:all
```

This uses `concurrently` to start both the backend (port 3000) and the frontend (port 5173) in a single terminal.

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | None |
| `POST` | `/auth/login` | Login and receive JWT | None |

### Transactions

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/transactions` | Create transaction | 🔒 Any |
| `GET` | `/transactions` | List transactions (filtered) | 🔒 Any |
| `GET` | `/transactions/:id` | Get transaction by ID | 🔒 Any |
| `POST` | `/transactions/:id/assess` | Trigger risk assessment | 🔒 Compliance Officer+ |

### Compliance

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/compliance/check/:transactionId` | Run all compliance checks | 🔒 Compliance Officer+ |
| `GET` | `/compliance/reports` | List compliance reports | 🔒 Any |
| `GET` | `/compliance/reports/:id` | Get report by ID | 🔒 Any |
| `POST` | `/compliance/sar/:transactionId` | Generate SAR | 🔒 Compliance Officer+ |
| `POST` | `/compliance/travel-rule/:transactionId` | Travel Rule check | 🔒 Compliance Officer+ |

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

- Enforced for transfers **≥ $1,000 USD**
- Generates `TRAVEL_RULE` compliance reports automatically
- Flags non-compliant transfers

### Suspicious Activity Reports (SAR)

- Auto-triggered for transactions **≥ $10,000 USD**
- Compliance officer review workflow (`PENDING → APPROVED/REJECTED`)

### Risk Scoring

| Factor | Score Impact |
|---|---|
| Amount ≥ $100,000 | +40 |
| Amount ≥ $10,000 | +25 |
| Amount ≥ $1,000 | +10 |
| Sanctioned address | +50 |

Risk levels: `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`

---

## Tax Calculation Features

| Type | Trigger | Tax Treatment |
|---|---|---|
| `CAPITAL_GAIN_SHORT` | TRADE / SWAP (< 365 days) | Short-term capital gains |
| `CAPITAL_GAIN_LONG` | TRADE / SWAP (≥ 365 days) | Long-term capital gains |
| `MINING_INCOME` | MINING transactions | Ordinary income |
| `STAKING_REWARD` | STAKING transactions | Ordinary income |
| `AIRDROP_INCOME` | AIRDROP transactions | Ordinary income |

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes
4. Push and open a Pull Request

---

## License

This project is licensed under the **MIT License**.

---

*CRYPTRAC is built for compliance professionals, tax authorities, and VASPs operating under AML/CFT frameworks including FATF, FinCEN, FINTRAC, and related national regulations.*

