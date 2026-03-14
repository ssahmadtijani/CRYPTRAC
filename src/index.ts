import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { prisma } from './lib/prisma';
import { transactionRoutes } from './routes/transaction.routes';
import { complianceRoutes } from './routes/compliance.routes';
import { walletRoutes } from './routes/wallet.routes';
import { authRoutes } from './routes/auth.routes';
import { exchangeRoutes } from './routes/exchange.routes';
import { taxRoutes } from './routes/tax.routes';
import { taxAuthorityRoutes } from './routes/tax-authority.routes';
import { demoRoutes } from './routes/demo.routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging middleware
app.use(requestLogger);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    service: 'CRYPTRAC',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/compliance', complianceRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/exchanges', exchangeRoutes);
app.use('/api/v1/tax', taxRoutes);
app.use('/api/v1/authority', taxAuthorityRoutes);
app.use('/api/v1/demo', demoRoutes);

// Error handling
app.use(errorHandler);

// Start server after DB connection
prisma
  .$connect()
  .then(() => {
    logger.info('Database connected');
    app.listen(PORT, () => {
      logger.info(`CRYPTRAC server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch((err: Error) => {
    logger.error('Failed to connect to database', err);
    process.exit(1);
  });

export default app;