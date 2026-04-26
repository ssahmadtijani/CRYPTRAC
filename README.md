# CRYPTRAC — National Crypto Transaction Monitoring & Tax Compliance System (NCTMTCS)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![NFIU](https://img.shields.io/badge/Regulatory-NFIU%20Aligned-brightgreen.svg)](https://nfiu.gov.ng/)
[![Platform](https://img.shields.io/badge/Platform-Ubuntu-E95420.svg)](https://ubuntu.com/)

CRYPTRAC is a **Crypto Transaction Reporting and Compliance System** aligned with the **Nigeria Financial Intelligence Unit (NFIU)**, **FATF Recommendation 16 (Travel Rule)**, **CBN virtual-asset guidelines**, **FIRS tax requirements**, and international AML/CFT standards. It provides a REST API backend and a React dashboard frontend for monitoring crypto transactions, generating compliance reports (STR/SAR, CTR, Travel Rule), calculating tax obligations in both USD and NGN using FIFO cost-basis methodology, and managing investigation cases end-to-end.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Directory Structure](#directory-structure)
- [Ubuntu Build Instructions](#ubuntu-build-instructions)
  - [System Prerequisites](#system-prerequisites)
  - [Install Node.js 20](#install-nodejs-20)
  - [Install & Configure PostgreSQL](#install--configure-postgresql)
  - [Clone the Repository](#clone-the-repository)
  - [Install Backend Dependencies](#install-backend-dependencies)
  - [Configure Environment](#configure-environment)
  - [Set Up the Database](#set-up-the-database)
  - [Build the Backend](#build-the-backend)
  - [Run the Backend](#run-the-backend)
  - [Install & Run the Frontend](#install--run-the-frontend)
  - [Run Both Together](#run-both-together)
  - [Run Tests](#run-tests)
- [API Endpoints](#api-endpoints)
- [Compliance Features](#compliance-features)
- [Tax Features (NGN-Aware)](#tax-features-ngn-aware)
- [Case Management](#case-management)
- [Analytics & Pattern Detection](#analytics--pattern-detection)
- [Alerts & Notifications](#alerts--notifications)
- [WebSocket Real-Time Feed](#websocket-real-time-feed)
- [Export & Reporting](#export--reporting)
- [Role-Based Access Control](#role-based-access-control)
- [Audit Trail](#audit-trail)
- [Contributing](#contributing)
- [License](#license)

---

## Project Overview

CRYPTRAC (NFIU branch) is designed to help Virtual Asset Service Providers (VASPs), Nigerian exchanges, the NFIU, FIRS, CBN, and compliance teams to:

- **Monitor** crypto transactions in real-time with automated risk scoring and pattern detection
- **Generate** NFIU-compliant regulatory reports: Suspicious Transaction Reports (STR), Suspicious Activity Reports (SAR), Currency Transaction Reports (CTR), and FATF Travel Rule filings
- **Calculate** tax obligations in both USD and NGN using FIFO cost-basis (capital gains, mining income, staking rewards, airdrops) per FIRS guidelines
- **Screen** wallet addresses against sanctions lists (OFAC, UN, CBN-designated)
- **Manage** investigation cases from creation through escalation to resolution
- **Ingest** on-chain transaction data and exchange XML/CSV reports automatically
- **Enforce** granular role-based access control for compliance officers, analysts, auditors, and regulators
- **Visualise** all of the above in a dark-themed React dashboard with real-time WebSocket updates

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│          React + TypeScript Frontend  (port 5173)            │
│   Dashboard · Transactions · Wallets · Compliance · Cases    │
│   Analytics · Alerts · Notifications · Export                │
│   Vite dev proxy  /api → http://localhost:3000               │
├──────────────────────────────────────────────────────────────┤
│                    Express HTTP API  (port 3000)             │
│   /auth  /transactions  /compliance  /wallets  /cases        │
│   /str-sar  /travel-rule  /risk  /sanctions  /analytics      │
│   /tax  /authority  /filings  /alerts  /notifications        │
│   /audit  /export  /ingestion  /exchange-reports  /ws        │
│   /admin/users  /admin/roles  /admin/audit                   │
├──────────────────────────────────────────────────────────────┤
│                      Middleware Layer                        │
│   JWT Auth · RBAC · Zod Validation · Rate Limiting          │
│   Request Logger · Error Handler                             │
├──────────────────────────────────────────────────────────────┤
│                      Service Layer                           │
│   Auth · Transaction · Compliance · Wallet · Tax             │
│   TaxEngine · TaxAssessment · Exchange · ChainIngestion      │
│   STR/SAR · TravelRule · RiskEngine · Sanctions              │
│   Case · CaseNote · Alert · Notification · Analytics         │
│   PatternDetection · NetworkAnalysis · Export · Audit        │
│   RegulatoryFiling · RolePermission · UserAdmin              │
│   WebSocket · XMLImport · Demo                               │
├──────────────────────────────────────────────────────────────┤
│                    Data Layer (Prisma ORM)                   │
│   PostgreSQL — User · Transaction · Wallet                   │
│   ComplianceReport · TaxEvent · TaxableEvent                 │
│   TaxAssessment · CostBasisLot · ExchangeConnection          │
│   ExchangeTransaction · Case · CaseNote · CaseTimeline       │
│   Notification · AlertRule · NotificationPreference          │
│   BlockSyncState · WatchedAddress · SanctionEntry            │
│   ExchangeReportSubmission                                   │
└──────────────────────────────────────────────────────────────┘
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
| **Zod** | 3.x | Runtime schema validation |
| **jsonwebtoken** | 9.x | JWT authentication |
| **bcryptjs** | 2.x | Password hashing |
| **ethers.js** | 6.x | Blockchain utilities & RPC |
| **ws** | 8.x | WebSocket server |
| **PDFKit** | 0.17.x | PDF report generation |
| **fast-xml-parser** | 4.x | Exchange XML report ingestion |
| **Winston** | 3.x | Structured logging |
| **express-rate-limit** | 8.x | API rate limiting |
| **Helmet** | 8.x | HTTP security headers |
| **Jest + ts-jest** | 29.x | Unit testing |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x | Language |
| **Vite** | 5.x | Build tool / dev server |
| **React Router** | 6.x | Client-side routing |
| **Axios** | 1.x | HTTP client |
| **Recharts** | 2.x | Charts and data visualisation |

---

## Directory Structure

```
CRYPTRAC/
├── prisma/
│   ├── schema.prisma              # Full database schema
│   └── seed.ts                    # Demo data seeder
├── src/                           # Backend source
│   ├── index.ts                   # Express app + HTTP server entry point
│   ├── lib/
│   │   └── prisma.ts              # Prisma client singleton
│   ├── types/
│   │   └── index.ts               # All enums, interfaces, DTOs
│   ├── validators/
│   │   └── schemas.ts             # Zod validation schemas
│   ├── middleware/
│   │   ├── auth.ts                # JWT authenticate + RBAC authorize
│   │   ├── errorHandler.ts        # Global error handler
│   │   ├── rateLimiter.ts         # Rate limiting middleware
│   │   └── requestLogger.ts       # HTTP request logger
│   ├── services/
│   │   ├── auth.service.ts
│   │   ├── transaction.service.ts
│   │   ├── compliance.service.ts
│   │   ├── wallet.service.ts
│   │   ├── tax.service.ts
│   │   ├── tax-engine.service.ts
│   │   ├── tax-assessment.service.ts
│   │   ├── exchange.service.ts
│   │   ├── chain-ingestion.service.ts
│   │   ├── str-sar.service.ts
│   │   ├── travel-rule.service.ts
│   │   ├── risk-engine.service.ts
│   │   ├── sanctions.service.ts
│   │   ├── pattern-detection.service.ts
│   │   ├── network-analysis.service.ts
│   │   ├── analytics.service.ts
│   │   ├── case.service.ts
│   │   ├── alert.service.ts
│   │   ├── notification.service.ts
│   │   ├── audit.service.ts
│   │   ├── audit-enhanced.service.ts
│   │   ├── export.service.ts
│   │   ├── regulatory-filing.service.ts
│   │   ├── role-permission.service.ts
│   │   ├── user-admin.service.ts
│   │   ├── websocket.service.ts
│   │   ├── xml-import.service.ts
│   │   └── demo.service.ts
│   ├── routes/                    # One file per domain
│   └── utils/
│       ├── logger.ts              # Winston logger
│       └── eventBus.ts            # Internal event bus
├── client/                        # Frontend source (Vite + React)
│   ├── index.html
│   ├── vite.config.ts             # /api proxy → localhost:3000
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.css                # Dark professional theme
│       ├── api/client.ts          # Axios client (JWT headers)
│       ├── context/AuthContext.tsx
│       ├── components/            # Layout, Sidebar, StatsCard, Badges, Toast
│       ├── pages/                 # All page components
│       └── types/index.ts         # Frontend mirrors of backend types
├── .env.example
├── jest.config.js
├── package.json
└── tsconfig.json
```

---

## Ubuntu Build Instructions

> **Tested on Ubuntu 22.04 LTS (Jammy) and 24.04 LTS (Noble).**
> All commands are run as a regular user; `sudo` is used only where needed.

### System Prerequisites

Update your package index and install build essentials:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git build-essential
```

### Install Node.js 20

Use the official NodeSource binary distribution:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Verify the installation:

```bash
node --version   # v20.x.x
npm --version    # 10.x.x
```

### Install & Configure PostgreSQL

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

Create the application database and user:

```bash
sudo -u postgres psql <<'SQL'
CREATE USER cryptrac WITH PASSWORD 'changeme';
CREATE DATABASE cryptrac OWNER cryptrac;
GRANT ALL PRIVILEGES ON DATABASE cryptrac TO cryptrac;
\q
SQL
```

Verify the connection:

```bash
psql -U cryptrac -d cryptrac -h localhost -c '\conninfo'
# You will be prompted for the password you set above.
```

### Clone the Repository

```bash
git clone -b NFIU https://github.com/ssahmadtijani/CRYPTRAC.git
cd CRYPTRAC
```

### Install Backend Dependencies

```bash
npm install
```

### Configure Environment

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# Runtime
NODE_ENV=development
PORT=3000

# PostgreSQL — use the credentials created above
DATABASE_URL="postgresql://cryptrac:changeme@localhost:5432/cryptrac?schema=public"

# JWT — generate a strong secret (minimum 32 characters)
JWT_SECRET="replace-with-a-strong-random-secret-min-32-chars"
JWT_EXPIRES_IN=24h

# Blockchain RPC (optional for on-chain ingestion)
ETH_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
BSC_RPC_URL=https://bsc-dataseed.binance.org

# Compliance thresholds (USD)
SAR_THRESHOLD=10000
CTR_THRESHOLD=10000
TRAVEL_RULE_THRESHOLD=1000

# Logging
LOG_LEVEL=info
```

> **Tip:** generate a secure JWT secret on Ubuntu with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

### Set Up the Database

Run Prisma migrations to create all tables:

```bash
npx prisma migrate dev --name init
```

Generate the Prisma client (done automatically by the migrate command above, but run manually if needed):

```bash
npx prisma generate
```

Optionally load demo data (creates sample users, transactions, wallets, and reports):

```bash
npm run seed
```

You can inspect the database at any time with Prisma Studio:

```bash
npx prisma studio
# Opens http://localhost:5555 in your browser
```

### Build the Backend

Compile TypeScript to `dist/` for a production build:

```bash
npm run build
```

### Run the Backend

**Development** (hot-reload via `ts-node-dev`):

```bash
npm run dev
```

**Production** (requires a prior `npm run build`):

```bash
npm start
```

The API is available at **http://localhost:3000**.
Health check: `curl http://localhost:3000/health`

### Install & Run the Frontend

In a second terminal:

```bash
# Install frontend dependencies
npm run client:install

# Start the Vite dev server (hot-reload)
npm run client:dev
```

Open **http://localhost:5173** in your browser.
All `/api` requests are automatically proxied to the backend on port 3000.

### Run Both Together

```bash
npm run dev:all
```

This uses `concurrently` to start the backend (port 3000) and the frontend (port 5173) from a single terminal window.

### Run Tests

```bash
npm test
```

Run with coverage:

```bash
npm test -- --coverage
```

---

## API Endpoints

All endpoints are prefixed with `/api/v1`.  
🔒 = JWT required.  Roles: `ADMIN` > `COMPLIANCE_OFFICER` > `ANALYST` > `AUDITOR` > `USER`.

### Authentication

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/auth/register` | Register a new user | None |
| `POST` | `/auth/login` | Login, receive JWT | None |

### Transactions

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/transactions` | Create transaction | 🔒 Any |
| `GET` | `/transactions` | List/filter transactions | 🔒 Any |
| `GET` | `/transactions/:id` | Get transaction by ID | 🔒 Any |
| `POST` | `/transactions/:id/assess` | Trigger risk assessment | 🔒 Compliance Officer+ |

### Wallets

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/wallets` | Register a wallet | 🔒 Any |
| `GET` | `/wallets/:address` | Get wallet info | 🔒 Any |
| `PUT` | `/wallets/:address/risk` | Recalculate risk score | 🔒 Compliance Officer+ |
| `GET` | `/wallets/:address/sanctions` | Sanctions list check | 🔒 Any |

### Compliance

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/compliance/check/:transactionId` | Run all compliance checks | 🔒 Compliance Officer+ |
| `GET` | `/compliance/reports` | List compliance reports | 🔒 Any |
| `GET` | `/compliance/reports/:id` | Get report by ID | 🔒 Any |
| `POST` | `/compliance/sar/:transactionId` | Generate SAR | 🔒 Compliance Officer+ |
| `POST` | `/compliance/travel-rule/:transactionId` | Travel Rule check | 🔒 Compliance Officer+ |

### STR / SAR (NFIU)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/str-sar` | Create STR or SAR report | 🔒 Compliance Officer+ |
| `GET` | `/str-sar` | List STR/SAR reports | 🔒 Compliance Officer+ |
| `GET` | `/str-sar/stats` | STR/SAR statistics | 🔒 Compliance Officer+ |
| `GET` | `/str-sar/:id` | Get report by ID | 🔒 Compliance Officer+ |
| `PATCH` | `/str-sar/:id/status` | Update report status | 🔒 Compliance Officer+ |
| `POST` | `/str-sar/:id/submit` | Submit report to NFIU | 🔒 Admin |
| `POST` | `/str-sar/:id/amend` | Amend filed report | 🔒 Admin |

### Travel Rule

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/travel-rule/vasps` | Register a VASP | 🔒 Compliance Officer+ |
| `GET` | `/travel-rule/vasps` | List VASPs | 🔒 Any |
| `POST` | `/travel-rule/check/:transactionId` | Run Travel Rule check | 🔒 Compliance Officer+ |
| `GET` | `/travel-rule/reports` | List Travel Rule reports | 🔒 Any |

### Risk Engine

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/risk/score` | Score a transaction | 🔒 Compliance Officer+ |
| `GET` | `/risk/config` | Get risk scoring config | 🔒 Admin |
| `PUT` | `/risk/config` | Update risk scoring config | 🔒 Admin |

### Sanctions

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/sanctions/check` | Check address against sanctions | 🔒 Any |
| `GET` | `/sanctions/list` | List sanction entries | 🔒 Compliance Officer+ |
| `POST` | `/sanctions/add` | Add sanction entry | 🔒 Admin |

### Tax (FIRS / NGN)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/tax/events` | List tax events | 🔒 Any |
| `POST` | `/tax/calculate` | Calculate tax for a period | 🔒 Any |
| `GET` | `/tax/summary` | Tax summary by year | 🔒 Any |
| `GET` | `/tax/assessment` | Get full assessment | 🔒 Any |

### Tax Authority Portal (FIRS read-only)

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/authority/assessments` | List assessments | 🔒 Auditor+ |
| `GET` | `/authority/assessments/:id` | Get single assessment | 🔒 Auditor+ |
| `GET` | `/authority/taxpayers` | List taxpayers | 🔒 Auditor+ |

### Exchanges & On-Chain Ingestion

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/exchanges/connect` | Connect exchange account | 🔒 Any |
| `GET` | `/exchanges` | List connected exchanges | 🔒 Any |
| `POST` | `/exchanges/:id/sync` | Trigger exchange sync | 🔒 Any |
| `POST` | `/ingestion/start` | Start on-chain block ingestion | 🔒 Admin |
| `GET` | `/ingestion/status` | Get sync state per network | 🔒 Admin |
| `POST` | `/exchange-reports/import` | Import XML exchange report | 🔒 Compliance Officer+ |
| `GET` | `/exchange-reports` | List exchange submissions | 🔒 Compliance Officer+ |

### Cases

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/cases` | Create case | 🔒 Compliance Officer+ |
| `GET` | `/cases` | List cases (filtered) | 🔒 Analyst+ |
| `GET` | `/cases/stats` | Case statistics | 🔒 Analyst+ |
| `GET` | `/cases/:id` | Get case by ID | 🔒 Analyst+ |
| `PATCH` | `/cases/:id` | Update case | 🔒 Compliance Officer+ |
| `POST` | `/cases/:id/assign` | Assign case to analyst | 🔒 Compliance Officer+ |
| `POST` | `/cases/:id/escalate` | Escalate case | 🔒 Compliance Officer+ |
| `POST` | `/cases/:id/resolve` | Resolve case | 🔒 Compliance Officer+ |
| `POST` | `/cases/:id/notes` | Add case note | 🔒 Analyst+ |
| `GET` | `/cases/:id/notes` | Get case notes | 🔒 Analyst+ |
| `GET` | `/cases/:id/timeline` | Get case timeline | 🔒 Analyst+ |

### Alerts

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/alerts/rules` | List alert rules | 🔒 Admin |
| `POST` | `/alerts/rules` | Create alert rule | 🔒 Admin |
| `PUT` | `/alerts/rules/:id` | Update alert rule | 🔒 Admin |
| `DELETE` | `/alerts/rules/:id` | Delete alert rule | 🔒 Admin |

### Notifications

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/notifications` | Get my notifications | 🔒 Any |
| `PATCH` | `/notifications/:id/read` | Mark as read | 🔒 Any |
| `PATCH` | `/notifications/read-all` | Mark all as read | 🔒 Any |
| `GET` | `/notifications/preferences` | Get preferences | 🔒 Any |
| `PUT` | `/notifications/preferences` | Update preferences | 🔒 Any |

### Analytics

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/analytics/dashboard` | Dashboard summary metrics | 🔒 Analyst+ |
| `GET` | `/analytics/transactions` | Transaction analytics | 🔒 Analyst+ |
| `GET` | `/analytics/risk` | Risk distribution analytics | 🔒 Analyst+ |
| `GET` | `/analytics/patterns` | Detected patterns | 🔒 Analyst+ |
| `GET` | `/analytics/network/:address` | Wallet network graph | 🔒 Analyst+ |

### Regulatory Filings

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/filings` | Create filing deadline | 🔒 Compliance Officer+ |
| `GET` | `/filings` | List filings | 🔒 Any |
| `GET` | `/filings/calendar` | Filing calendar view | 🔒 Any |
| `GET` | `/filings/dashboard` | Filing dashboard metrics | 🔒 Any |
| `PATCH` | `/filings/:id/status` | Update filing status | 🔒 Compliance Officer+ |

### Audit

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/audit/logs` | List audit logs | 🔒 Auditor+ |
| `GET` | `/audit/logs/:id` | Get audit log entry | 🔒 Auditor+ |
| `GET` | `/admin/audit/logs` | Enhanced audit logs | 🔒 Admin |
| `GET` | `/admin/audit/stats` | Audit statistics | 🔒 Admin |

### Export

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/export/transactions` | Export transactions (CSV/JSON/PDF) | 🔒 Auditor+ |
| `GET` | `/export/compliance` | Export compliance reports | 🔒 Auditor+ |
| `GET` | `/export/tax` | Export tax assessments | 🔒 Auditor+ |
| `GET` | `/export/cases` | Export cases | 🔒 Auditor+ |

### Admin — User & Role Management

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/admin/users` | List all users | 🔒 Admin |
| `GET` | `/admin/users/:id` | Get user | 🔒 Admin |
| `PATCH` | `/admin/users/:id` | Update user | 🔒 Admin |
| `DELETE` | `/admin/users/:id` | Deactivate user | 🔒 Admin |
| `GET` | `/admin/roles/permissions` | List role permissions | 🔒 Admin |
| `PUT` | `/admin/roles/permissions` | Update role permissions | 🔒 Admin |

### WebSocket

| Endpoint | Description |
|---|---|
| `ws://localhost:3000` | Real-time transaction and alert feed |

---

## Compliance Features

### NFIU — Suspicious Transaction Reports (STR) & SARs

- File STR or SAR reports directly to the NFIU (`regulatoryAuthority: "NFIU"`)
- Lifecycle: `DRAFT → PENDING → APPROVED → FILED → AMENDED`
- Structured suspicion categories: money laundering, terrorism financing, proliferation financing, structuring
- Linked to transactions, cases, and wallet addresses
- Audit trail on every status change

### FATF Travel Rule (Recommendation 16)

- Enforced for transfers **≥ $1,000 USD** (configurable via `TRAVEL_RULE_THRESHOLD`)
- VASP registry with CBN regulatory authority support
- Non-compliant transfers are automatically flagged

### Currency Transaction Reports (CTR)

- Auto-triggered for transactions **≥ $10,000 USD**

### Risk Scoring

| Factor | Score Impact |
|---|---|
| Amount ≥ $100,000 | +40 |
| Amount ≥ $10,000 | +25 |
| Amount ≥ $1,000 | +10 |
| Sanctioned address | +50 |

Risk levels: `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`

### Sanctions Screening

- OFAC, UN, and CBN-designated address screening
- Real-time check on every incoming transaction

---

## Tax Features (NGN-Aware)

Tax liabilities are calculated and reported in **both USD and Nigerian Naira (NGN)** per FIRS guidelines.

| Event Type | Trigger | Treatment |
|---|---|---|
| `CAPITAL_GAIN_SHORT` | TRADE / SWAP < 365 days | Short-term capital gains |
| `CAPITAL_GAIN_LONG` | TRADE / SWAP ≥ 365 days | Long-term capital gains |
| `MINING_INCOME` | MINING transactions | Ordinary income |
| `STAKING_REWARD` | STAKING transactions | Ordinary income |
| `AIRDROP_INCOME` | AIRDROP transactions | Ordinary income |

- FIFO cost-basis with `CostBasisLot` tracking per asset per exchange
- Quarterly (`Q1`–`Q4`) and annual `TaxAssessment` records
- Assessment statuses: `DRAFT → CALCULATED → REVIEWED → FILED → PAID`
- FIRS tax-authority read-only portal for regulators

---

## Case Management

- Create cases from transactions, wallet hits, or manual referral
- Categories: `SUSPICIOUS_TRANSACTION`, `SANCTIONS_HIT`, `HIGH_RISK_WALLET`, `TRAVEL_RULE_VIOLATION`, `STRUCTURING`, `UNUSUAL_PATTERN`, `MANUAL_REFERRAL`
- Full lifecycle: `OPEN → INVESTIGATING → ESCALATED → PENDING_REVIEW → RESOLVED → CLOSED`
- Priority levels: `LOW` · `MEDIUM` · `HIGH` · `CRITICAL`
- Case notes, attachments, and auto-generated timeline events
- Assignment and escalation workflows

---

## Analytics & Pattern Detection

- **Dashboard metrics**: transaction counts, risk distribution, compliance status breakdown
- **Pattern detection**: structuring, rapid movement, layering, round-tripping
- **Network analysis**: wallet relationship graph for a given address
- **Time-series analytics**: transaction volume and risk trends over time

---

## Alerts & Notifications

- Configurable `AlertRule` records trigger notifications when conditions are met:
  - `TRANSACTION_AMOUNT_EXCEEDS`, `RISK_LEVEL_IS`, `COMPLIANCE_STATUS_IS`, `SANCTIONS_HIT`, `CASE_ESCALATED`, `CASE_UNASSIGNED_DURATION`
- In-app `Notification` model with read/unread state and per-user preferences
- High-priority alerts are pushed immediately over WebSocket

---

## WebSocket Real-Time Feed

Connect to `ws://localhost:3000` with a valid JWT:

```js
const ws = new WebSocket('ws://localhost:3000');
ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: '<jwt>' }));
ws.onmessage = (e) => console.log(JSON.parse(e.data));
```

Events broadcast: new transactions, risk assessments, compliance updates, case events, STR/SAR filings, high-priority alerts.

---

## Export & Reporting

All exports support `format=csv`, `format=json`, and `format=pdf` query parameters.

```bash
# Export transactions as CSV
curl -H "Authorization: Bearer <jwt>" \
  "http://localhost:3000/api/v1/export/transactions?format=csv" \
  -o transactions.csv

# Export tax assessment as PDF
curl -H "Authorization: Bearer <jwt>" \
  "http://localhost:3000/api/v1/export/tax?format=pdf" \
  -o tax-assessment.pdf
```

---

## Role-Based Access Control

| Role | Description |
|---|---|
| `ADMIN` | Full system access, user management, role configuration |
| `COMPLIANCE_OFFICER` | Create/approve STR/SAR, manage cases, run compliance checks |
| `ANALYST` | View transactions and cases, run analytics |
| `AUDITOR` | Read-only access to all data and audit logs |
| `USER` | Submit transactions, view own data |

Granular permissions are stored in the `AlertRule` and role-permission tables and are configurable at runtime by an `ADMIN`.

---

## Audit Trail

Every create, update, delete, and status-change operation emits an audit log entry recording:
- The acting user and their role
- The action type (`AuditAction` enum)
- The target resource type and ID
- Previous and new values (where applicable)
- IP address and timestamp

Enhanced audit logs are accessible to `ADMIN` users via `/api/v1/admin/audit`.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: describe your change'`
4. Push to your fork and open a Pull Request targeting the `NFIU` branch

---

## License

This project is licensed under the **MIT License**.

---

*CRYPTRAC (NFIU branch) is built for compliance professionals, the Nigeria Financial Intelligence Unit (NFIU), FIRS, CBN, and VASPs operating under Nigerian AML/CFT frameworks and international FATF standards.*
