import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import renderRoutes from './routes/render-api.js';
import mcpSSERoutes from './routes/mcp-sse.js';

// 環境変数の読み込み
dotenv.config();

// Expressアプリケーションの初期化
const app = express();
const PORT = process.env.PORT || 3000;

// ミドルウェアの設定
app.use(helmet()); // セキュリティヘッダーの設定
app.use(cors()); // CORS対応
app.use(express.json()); // JSON解析
app.use(morgan('combined')); // リクエストログ

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

// エイリアスエンドポイント - テスト用
// /status エンドポイント（/healthのエイリアス）
app.get('/status', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    note: 'Alias for /health endpoint'
  });
});

// /auth/status エンドポイント
app.get('/auth/status', (req, res) => {
  res.status(200).json({
    auth: 'enabled',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// /api/endpoints エンドポイント
app.get('/api/endpoints', (req, res) => {
  res.status(200).json({
    endpoints: [
      { path: '/', method: 'GET', description: 'Root information' },
      { path: '/health', method: 'GET', description: 'Health check' },
      { path: '/status', method: 'GET', description: 'Status check (alias for /health)' },
      { path: '/auth/status', method: 'GET', description: 'Authentication status' },
      { path: '/api/endpoints', method: 'GET', description: 'API endpoints list' },
      { path: '/mcp-sse', method: 'GET', description: 'MCP SSE router' },
      { path: '/api/render', method: 'GET', description: 'Render API related' },
      { path: '/events', method: 'GET', description: 'Events endpoint (alias for /mcp-sse/events)' },
      { path: '/error/test', method: 'GET', description: 'Error test endpoint' }
    ],
    timestamp: new Date().toISOString()
  });
});

// /events エンドポイント（MCP SSE用エイリアス）
app.get('/events', (req, res) => {
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
    timestamp: new Date().toISOString()
  })}\n\n`);
});

// /error/test エンドポイント
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

// MCP SSEルーターの使用
app.use('/mcp-sse', mcpSSERoutes);

// API ルート
app.use('/api/render', renderRoutes);

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
});

export default app;