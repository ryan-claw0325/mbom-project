import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3001'),
    env: process.env.NODE_ENV || 'development',
  },
  
  database: {
    url: process.env.DATABASE_URL || 'file:./data/mbom.db',
  },
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
  
  validation: {
    maxLevelDepth: 10,
    maxNodesPerBom: 10000,
  },
  
  batch: {
    maxBatchSize: 1000,
    batchChunkSize: 100,
  },
};
