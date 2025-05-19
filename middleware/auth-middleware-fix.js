// SSE認証ミドルウェア修正案
// ファイル: /mcp-server/middleware/auth-middleware.js

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

// MCP SSE認証用ミドルウェア（修正版）
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
  
  // ヘッダーに認証URLを追加
  res.setHeader('X-MCP-Auth-URL', authUrl);
  
  // Cookieからのトークン取得も試みる（修正点）
  let cookieToken = null;
  if (req.headers.cookie) {
    const cookies = req.headers.cookie.split(';').map(c => c.trim());
    const authCookie = cookies.find(c => c.startsWith('mcp_auth_token='));
    if (authCookie) {
      cookieToken = authCookie.split('=')[1];
    }
  }
  
  // トークン優先順位: ヘッダー > Cookie
  const effectiveToken = token || cookieToken;

  // トークンなしの場合はWebブラウザからの直接アクセスと判断
  if (!effectiveToken) {
    req.isAuthenticated = false;
    return next();
  }

  try {
    const decoded = jwt.verify(
      effectiveToken, 
      process.env.JWT_SECRET || 'default_secret_for_development_only'
    );
    
    // デコード成功 - 認証状態を設定
    req.user = decoded;
    req.isAuthenticated = true;
    
    // 認証成功を記録（修正点：ログ追加）
    console.log(`SSE認証成功: クライアントID=${decoded.client_id || 'unknown'}`);
    
    // 認証クッキーを設定（修正点：Cookie設定）
    if (!token && cookieToken) {
      res.setHeader(
        'Set-Cookie', 
        `mcp_auth_token=${cookieToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`
      );
    }
    
    next();
  } catch (err) {
    // 検証エラー - 詳細ログを追加（修正点）
    console.error('トークン検証エラー:', err.message);
    
    req.isAuthenticated = false;
    req.authError = err.message;
    
    // 認証エラーでもセッションは継続
    next();
  }
}

export default { authenticateToken, authenticateMCPSSE };