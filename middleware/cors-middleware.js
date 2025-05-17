import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// CORSオプション
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? 
    process.env.CORS_ORIGIN.split(',') : 
    ['https://claude.ai', 'https://*.claude.ai', 'http://localhost:3000', '*'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-MCP-Client', 'X-MCP-Version'],
  exposedHeaders: ['X-MCP-Server-Version', 'X-MCP-Auth-URL'],
  credentials: true,
  maxAge: 86400 // 24時間
};

// SSE用CORS設定
const sseCorsOptions = {
  ...corsOptions,
  // SSE接続のためのヘッダー設定
  methods: ['GET'],
};

export const defaultCors = cors(corsOptions);
export const sseCors = cors(sseCorsOptions);

export default { defaultCors, sseCors };