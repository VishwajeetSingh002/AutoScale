import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import configs
import pool from './config/db.js';

// Import routes
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import metricsRoutes from './routes/metrics.js';
import uploadRoutes from './routes/upload.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS for frontend client
app.use(cors({
  origin: '*', // Allows connections from anywhere (useful for load balanced clients)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local upload folders statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Register Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/metrics', metricsRoutes);
app.use('/api/upload', uploadRoutes);

// Serve static assets from React client build directory
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// Fallback for React Router single page app
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(200).send('Frontend is compiling or not yet built on this node. API is active.');
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Express Error Handler]', err);
  res.status(500).json({
    message: err.message || 'Internal server error occurred'
  });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`==================================================`);
  console.log(`[Server] E-Commerce Backend running on port ${PORT}`);
  console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[Server] Press Ctrl+C to terminate`);
  console.log(`==================================================`);
});

// Handle graceful termination
process.on('SIGINT', async () => {
  console.log('[Server] Shutdown signal received. Closing db pools...');
  if (pool) {
    await pool.end();
    console.log('[Server] Database connection pools closed.');
  }
  process.exit(0);
});
