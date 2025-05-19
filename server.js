import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirnameの設定（ESモジュール対応）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import renderRoutes from './routes/render-api.js';
import mcpSSERoutes from './routes/mcp-sse.js';
import authRoutes from './routes/auth/auth-routes.js';
import { defaultCors, sseCors } from './middleware/cors-middleware.js';
import { authenticateMCPSSE } from './middleware/auth-middleware.js';

// 環境変数の読み込み
dotenv.config();

// Expressアプリケーションの初期化
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(helmet()); // セキュリティヘッダーの設定
app.use(defaultCors); // デフォルトCORS設定
app.use(express.json()); // JSON解析
app.use(morgan('combined')); // リクエストログ

// 静的ファイルの提供
app.use(express.static(path.join(__dirname, 'public')));

// 基本ルート
app.get('/', (req, res) => {
  res.json({
    message: 'Remote MCP Server is running',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// エイリアスエンドポイント - ステータス
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    note: 'Alias for /health endpoint'
  });
});

// API一覧エンドポイント
app.get('/api/endpoints', (req, res) => {
  res.status(200).json({
    endpoints: [
      { path: '/', method: 'GET', description: 'Root information' },
      { path: '/health', method: 'GET', description: 'Health check' },
      { path: '/status', method: 'GET', description: 'Status check (alias for /health)' },
      { path: '/auth/status', method: 'GET', description: 'Authentication status' },
      { path: '/auth/authorize', method: 'GET', description: 'OAuth 2.1 authorization endpoint' },
      { path: '/auth/token', method: 'POST', description: 'OAuth 2.1 token endpoint' },
      { path: '/auth/refresh', method: 'POST', description: 'OAuth 2.1 token refresh endpoint' },
      { path: '/auth/revoke', method: 'POST', description: 'OAuth 2.1 token revocation endpoint' },
      { path: '/api/endpoints', method: 'GET', description: 'API endpoints list' },
      { path: '/mcp-sse', method: 'GET', description: 'MCP SSE router' },
      { path: '/sse', method: 'GET', description: 'MCP SSE endpoint (alias for /mcp-sse)' },
      { path: '/api/render', method: 'GET', description: 'Render API related' },
      { path: '/events', method: 'GET', description: 'Events endpoint (alias for /mcp-sse/events)' },
      { path: '/error/test', method: 'GET', description: 'Error test endpoint' }
    ],
    timestamp: new Date().toISOString()
  });
});

// ルーティング
app.use('/auth', authRoutes);
app.use('/oauth', authRoutes); // Web版Claude互換性のためのエイリアス
app.use('/auth/oauth', authRoutes); // 二重パス対応
app.use('/api/render', renderRoutes);

// SSE関連ルーティング（CORSとOptional認証）
app.use('/mcp-sse', sseCors, authenticateMCPSSE, mcpSSERoutes);
app.use('/sse', sseCors, authenticateMCPSSE, mcpSSERoutes); // エイリアス

// イベントエンドポイント（SSEのエイリアス）
app.get('/events', sseCors, authenticateMCPSSE, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  const intervalId = setInterval(() => {
    res.write(`data: ${JSON.stringify({
      event: 'ping',
      timestamp: new Date().toISOString()
    })}\n\n`);
  }, 10000);
  
  req.on('close', () => {
    clearInterval(intervalId);
  });
  
  res.write(`data: ${JSON.stringify({
    event: 'connected',
    message: 'SSE connection established',
    authenticated: req.isAuthenticated,
    timestamp: new Date().toISOString()
  })}\n\n`);
});

// エラーテストエンドポイント
app.get('/error/test', (req, res, next) => {
  try {
    // エラーテスト用に意図的にエラーを発生
    if (req.query.type === 'handled') {
      res.status(400).json({
        error: 'Test Error',
        message: 'This is a handled test error',
        timestamp: new Date().toISOString()
      });
    } else {
      throw new Error('Test error triggered');
    }
  } catch (err) {
    next(err);
  }
});

// 存在しないルートのハンドリング
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested resource does not exist'
  });
});

// エラーハンドリング
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An unexpected error occurred' 
      : err.message
  });
});

// サーバー起動
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`OAuth enabled with protocol version: 2025-03-26`);
});

export default app;