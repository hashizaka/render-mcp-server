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
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_for_development_only');
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

  // 認証URL生成
  const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
  const host = req.get('host');
  const clientId = process.env.OAUTH_CLIENT_ID || 'default-client';
  const redirectUri = `${protocol}://${host}/auth/callback`;
  
  // 認証URLを設定（絶対URL形式）
  const authUrl = `${protocol}://${host}/auth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  req.authUrl = authUrl;
  
  // ヘッダーに認証URLを追加（すでに絶対URL形式なのでそのまま設定）
  res.setHeader('X-MCP-Auth-URL', authUrl);

  // トークンなしの場合はWebブラウザからの直接アクセスと判断
  if (!token) {
    req.isAuthenticated = false;
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'default_secret_for_development_only');
    req.user = decoded;
    req.isAuthenticated = true;
    next();
  } catch (err) {
    req.isAuthenticated = false;
    next();
  }
}

export default { authenticateToken, authenticateMCPSSE };