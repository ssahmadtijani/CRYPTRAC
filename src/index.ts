import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { transactionRoutes } from './routes/transaction.routes';
import { complianceRoutes } from './routes/compliance.routes';
import { walletRoutes } from './routes/wallet.routes';
import { authRoutes } from './routes/auth.routes';
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

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`CRYPTRAC server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

export default app;