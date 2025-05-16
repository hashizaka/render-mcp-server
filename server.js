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