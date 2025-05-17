# Web版Claude向け認証機能実装計画

**作成日時:** 2025年5月17日 23:55
**作成者:** Claude 3.7 Sonnet
**ステータス:** 計画策定完了、実装準備完了

## 1. 現状分析

現在のリモートMCPサーバー（https://render-mcp-server.onrender.com）はExpressベースでNode.jsで実装されており、基本的なSSEエンドポイント（`/mcp-sse`、`/events`）が実装されています。認証関連のエンドポイントとして`/auth/status`はありますが、Web版Claude連携に必要なOAuth 2.1認証フローは実装されていません。

## 2. 実装目標

Web版Claudeと連携可能なOAuth 2.1認証フローを実装し、ブラウザベースの認証を可能にします。主な機能として以下を実装します：

1. OAuth 2.1認証エンドポイント
2. トークン管理機能
3. CORSヘッダーの適切な設定
4. セキュアなセッション管理
5. Web版Claude向けSSE接続の最適化

## 3. 実装計画

### 3.1 新規ファイル構造

```
/mcp-server
  /controllers
    /auth
      oauth-controller.js     # OAuth認証コントローラー
      token-controller.js     # トークン管理コントローラー
      session-controller.js   # セッション管理コントローラー
  /routes
    /auth
      oauth-routes.js         # OAuth関連ルート
      token-routes.js         # トークン関連ルート
  /services
    /auth
      oauth-service.js        # OAuth認証サービス
      token-service.js        # トークン管理サービス
  /middleware
    auth-middleware.js        # 認証ミドルウェア
    cors-middleware.js        # CORS設定ミドルウェア
  /config
    oauth-config.js           # OAuth設定
```

### 3.2 認証フロー実装手順

1. **OAuth 2.1エンドポイント実装**
   - `/oauth/authorize` - 認証フロー開始エンドポイント
   - `/oauth/token` - アクセストークン発行エンドポイント
   - `/oauth/refresh` - リフレッシュトークン更新エンドポイント

2. **トークン管理機能実装**
   - JWTベースのトークン生成
   - トークン検証と有効期限管理
   - リフレッシュトークンローテーション

3. **Web版Claude接続最適化**
   - CORS設定の強化
   - Claude特有のリクエストヘッダー対応
   - SSE接続の最適化

### 3.3 環境変数追加

```
# OAuth認証設定
OAUTH_CLIENT_ID=render_mcp_client
OAUTH_CLIENT_SECRET=secure_random_string
OAUTH_REDIRECT_URI=https://claude.ai/oauth/callback
JWT_SECRET=secure_random_string
ACCESS_TOKEN_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=2592000

# CORS設定
CORS_ORIGIN=https://claude.ai,https://api.anthropic.com,https://claude.anthropic.com
```

## 4. 実装コード

### 4.1 認証ルーター (auth-routes.js)

```javascript
import express from 'express';
import oauthController from '../controllers/auth/oauth-controller.js';
import tokenController from '../controllers/auth/token-controller.js';

const router = express.Router();

// OAuth認証フローエンドポイント
router.get('/authorize', oauthController.authorize);
router.post('/token', oauthController.token);
router.post('/refresh', tokenController.refresh);
router.post('/revoke', tokenController.revoke);

// 認証ステータスエンドポイント
router.get('/status', (req, res) => {
  res.status(200).json({
    auth: 'enabled',
    status: 'operational',
    oauth: 'enabled',
    protocol_version: '2025-03-26',
    timestamp: new Date().toISOString()
  });
});

export default router;
```

### 4.2 OAuth認証コントローラー (oauth-controller.js)

```javascript
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// 一時的な認証コード保存（本番環境ではRedisなどを使用）
const authorizationCodes = new Map();
// アクティブセッション保存
const activeTokens = new Map();

const oauthController = {
  // 認証リクエスト処理
  authorize: (req, res) => {
    const {
      response_type,
      client_id,
      redirect_uri,
      state,
      code_challenge,
      code_challenge_method
    } = req.query;

    // パラメータ検証
    if (response_type !== 'code' || client_id !== process.env.OAUTH_CLIENT_ID) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid response_type or client_id'
      });
    }

    // 認証コード生成
    const authCode = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (10 * 60 * 1000); // 10分間有効

    // コード保存
    authorizationCodes.set(authCode, {
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      expiresAt
    });

    // リダイレクト
    const redirectUrl = new URL(redirect_uri);
    redirectUrl.searchParams.append('code', authCode);
    if (state) {
      redirectUrl.searchParams.append('state', state);
    }

    res.redirect(redirectUrl.toString());
  },

  // トークン発行
  token: (req, res) => {
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      code_verifier
    } = req.body;

    // グラントタイプ検証
    if (grant_type !== 'authorization_code') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant type is supported'
      });
    }

    // 認証コード検証
    if (!authorizationCodes.has(code)) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid authorization code'
      });
    }

    const codeData = authorizationCodes.get(code);
    authorizationCodes.delete(code); // 使用済みコードの削除

    // コード有効期限検証
    if (Date.now() > codeData.expiresAt) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code has expired'
      });
    }

    // クライアントID検証
    if (client_id !== codeData.client_id) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    // リダイレクトURI検証
    if (redirect_uri !== codeData.redirect_uri) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Redirect URI mismatch'
      });
    }

    // PKCE検証（必要な場合）
    if (codeData.code_challenge) {
      const calculatedChallenge = crypto
        .createHash('sha256')
        .update(code_verifier)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      if (calculatedChallenge !== codeData.code_challenge) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Code verifier is invalid'
        });
      }
    }

    // トークン生成
    const accessToken = jwt.sign(
      { client_id, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600 }
    );

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshExpiresAt = Date.now() + (parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 2592000) * 1000;

    // トークン保存
    activeTokens.set(refreshToken, {
      client_id,
      refreshExpiresAt
    });

    // レスポンス
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600,
      refresh_token: refreshToken
    });
  }
};

export default oauthController;
```

### 4.3 トークンコントローラー (token-controller.js)

```javascript
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

// アクティブセッション保存（本番環境ではRedisなどを使用）
const activeTokens = new Map();

const tokenController = {
  // トークンリフレッシュ
  refresh: (req, res) => {
    const { grant_type, refresh_token, client_id } = req.body;

    // グラントタイプ検証
    if (grant_type !== 'refresh_token') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only refresh_token grant type is supported for this endpoint'
      });
    }

    // リフレッシュトークン検証
    if (!activeTokens.has(refresh_token)) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid refresh token'
      });
    }

    const tokenData = activeTokens.get(refresh_token);
    
    // トークン有効期限検証
    if (Date.now() > tokenData.refreshExpiresAt) {
      activeTokens.delete(refresh_token);
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token has expired'
      });
    }

    // クライアントID検証
    if (client_id !== tokenData.client_id) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    // 古いリフレッシュトークンの削除
    activeTokens.delete(refresh_token);

    // 新しいトークン生成
    const accessToken = jwt.sign(
      { client_id, type: 'access' },
      process.env.JWT_SECRET,
      { expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600 }
    );

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const refreshExpiresAt = Date.now() + (parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 2592000) * 1000;

    // 新しいトークン保存
    activeTokens.set(newRefreshToken, {
      client_id,
      refreshExpiresAt
    });

    // レスポンス
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600,
      refresh_token: newRefreshToken
    });
  },

  // トークン無効化
  revoke: (req, res) => {
    const { token, token_type_hint } = req.body;

    if (token_type_hint === 'refresh_token' && activeTokens.has(token)) {
      activeTokens.delete(token);
    }

    // OAuthの仕様では成功時は常に200を返すことになっている
    res.status(200).json({
      success: true
    });
  }
};

export default tokenController;
```

### 4.4 認証ミドルウェア (auth-middleware.js)

```javascript
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// 認証確認ミドルウェア
export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      error: 'unauthorized',
      error_description: 'Access token required'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token is invalid or expired'
    });
  }
}

// MCP SSE認証用ミドルウェア
export function authenticateMCPSSE(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // トークンなしの場合はWebブラウザからの直接アクセスと判断
  if (!token) {
    req.isAuthenticated = false;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.isAuthenticated = true;
    next();
  } catch (err) {
    req.isAuthenticated = false;
    next();
  }
}

export default { authenticateToken, authenticateMCPSSE };
```

### 4.5 CORS設定ミドルウェア (cors-middleware.js)

```javascript
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

// CORSオプション
const corsOptions = {
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-MCP-Client', 'X-MCP-Version'],
  exposedHeaders: ['X-MCP-Server-Version'],
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
```

### 4.6 メインサーバーファイル変更 (server.js)

```javascript
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
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
```

## 5. 環境変数追加 (.env)

```
# Render.com API設定
RENDER_API_TOKEN=your_api_token_here
RENDER_SERVICE_ID=your_service_id_here

# サーバー設定
PORT=3000
NODE_ENV=development

# ログ設定
LOG_LEVEL=info

# セキュリティ設定
CORS_ORIGIN=https://claude.ai,https://api.anthropic.com,https://claude.anthropic.com

# MCP設定
MCP_ENDPOINT_PATH=/sse

# OAuth認証設定
OAUTH_CLIENT_ID=render_mcp_client
OAUTH_CLIENT_SECRET=your_secure_random_string_here
OAUTH_REDIRECT_URI=https://claude.ai/oauth/callback
JWT_SECRET=your_secure_random_string_here
ACCESS_TOKEN_EXPIRY=3600
REFRESH_TOKEN_EXPIRY=2592000

# データストレージ（将来拡張用）
STORAGE_TYPE=memory
```

## 6. パッケージ追加 (package.json)

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",
    "crypto": "^1.0.1"
  }
}
```

## 7. デプロイと検証計画

1. **ステージング環境での実装・テスト**
   - ステージング環境へコード実装
   - 単体テスト実施
   - 統合テスト実施

2. **本番環境へのデプロイ**
   - Render.comへのデプロイ
   - 環境変数設定
   - 初期検証

3. **Web版Claude連携テスト**
   - 認証フロー検証
   - SSE接続検証
   - エラーケース確認

4. **監視とロギング設定**
   - 認証関連イベントのロギング設定
   - トークン関連統計情報の監視
   - エラー検知と通知設定

## 8. タイムライン

1. **実装フェーズ（2時間）**
   - コード作成と基本テスト

2. **テストフェーズ（1時間）**
   - 詳細なテストケース実行
   - エッジケース確認

3. **デプロイフェーズ（30分）**
   - コードデプロイ
   - 環境変数設定

4. **検証フェーズ（1時間）**
   - Web版Claude連携テスト
   - フィードバック収集と調整

## 9. リスクと軽減策

1. **認証フロー互換性リスク**
   - 軽減策: Claude開発ドキュメントの詳細確認と早期フィードバック

2. **セキュリティリスク**
   - 軽減策: JWTの適切な設定、有効期限管理、トークンローテーション

3. **スケーラビリティリスク**
   - 軽減策: インメモリストレージからRedisなどへの移行計画策定

4. **バックワード互換性リスク**
   - 軽減策: 既存エンドポイントの維持と段階的な移行計画

## 10. まとめ

この実装計画により、Web版Claudeと連携可能なOAuth 2.1認証フローを持つMCPサーバーを実現します。セキュリティ、パフォーマンス、互換性を考慮した設計により、安定的なWeb版Claude連携が可能になります。認証機能の実装後も継続的な改善とユーザーフィードバックに基づく調整を行い、最適な連携環境を構築していきます。
