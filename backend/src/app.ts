import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import fileUpload from 'express-fileupload';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/index.js';
import { bomRoutes } from './routes/bomRoutes.js';
import { ebomRoutes } from './routes/ebomRoutes.js';
import { validationRoutes } from './routes/validationRoutes.js';
import { processRoutes } from './routes/processRoutes.js';
import { AppError } from './utils/errors.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: config.upload.maxFileSize },
  abortOnLimit: true,
}));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '..', config.upload.uploadDir)));

// Serve frontend static files in production
if (config.server.env === 'production') {
  const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
  app.use(express.static(frontendDistPath));
}

// API Routes
app.use('/api/boms', bomRoutes);
app.use('/api/ebom', ebomRoutes);
app.use('/api/validation', validationRoutes);
app.use('/api/process-specs', processRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((req: Request, res: Response) => {
  // In production, serve index.html for SPA routing (except API routes)
  if (config.server.env === 'production' && !req.path.startsWith('/api')) {
    const frontendDistPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  }

  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
      details: err.details,
    });
  }

  // Handle multer errors
  if (err.message.includes('File too large')) {
    return res.status(400).json({
      success: false,
      code: 'FILE_TOO_LARGE',
      message: '文件大小超过限制（最大 10MB）',
    });
  }

  // Unknown error
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
  });
});

// Start server
app.listen(config.server.port, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 MBOM Backend Server                                    ║
║                                                            ║
║   Server running at: http://localhost:${config.server.port}                    ║
║   Environment: ${config.server.env.padEnd(40)}║
║                                                            ║
║   API Endpoints:                                           ║
║   - GET  /api/health          Health check                ║
║   - GET  /api/boms            BOM management              ║
║   - POST /api/ebom/upload     EBOM import                 ║
║   - POST /api/validation/*     Data validation             ║
║   - GET  /api/process-specs/*  Process specs               ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
  `);
});

export default app;
