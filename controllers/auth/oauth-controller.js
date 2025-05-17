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
    if (response_type !== 'code') {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid response_type, must be "code"'
      });
    }

    // Claudeからのリクエストは許可リストと照合
    const isClaudeRequest = redirect_uri && 
      (redirect_uri.includes('claude.ai') || 
       redirect_uri.includes('localhost') ||
       (process.env.ALLOWED_REDIRECT_URIS && 
        process.env.ALLOWED_REDIRECT_URIS.split(',').some(uri => redirect_uri.includes(uri))));

    // Web版Claudeなどの許可リクエストの場合は自動許可
    if (isClaudeRequest || client_id === process.env.OAUTH_CLIENT_ID) {
      // 認証コード生成
      const authCode = crypto.randomBytes(32).toString('hex');
      const expiresAt = Date.now() + (10 * 60 * 1000); // 10分間有効

      // コード保存
      authorizationCodes.set(authCode, {
        client_id: client_id || 'claude-web-client',
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

      console.log(`認証コード生成: ${authCode} (クライアント: ${client_id || 'claude-web-client'})`);
      res.redirect(redirectUrl.toString());
    } else {
      // その他のクライアントは確認画面表示（HTMLテンプレートがない場合は簡易表示）
      res.send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MCP認証</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; }
            .btn { display: inline-block; padding: 10px 15px; background: #0066cc; color: white; border: none; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>MCPサーバーへの接続許可</h1>
            <p>以下のアプリケーションがMCPサーバーへの接続を要求しています。</p>
            <p>クライアントID: ${client_id || '不明'}</p>
            <p>リダイレクトURI: ${redirect_uri || '不明'}</p>
            
            <form action="/auth/authorize" method="get">
              <input type="hidden" name="response_type" value="code">
              <input type="hidden" name="client_id" value="${client_id || 'manual-client'}">
              <input type="hidden" name="redirect_uri" value="${redirect_uri || ''}">
              ${state ? `<input type="hidden" name="state" value="${state}">` : ''}
              ${code_challenge ? `<input type="hidden" name="code_challenge" value="${code_challenge}">` : ''}
              ${code_challenge_method ? `<input type="hidden" name="code_challenge_method" value="${code_challenge_method}">` : ''}
              <input type="hidden" name="auto_approve" value="true">
              
              <button type="submit" class="btn">アクセスを許可</button>
            </form>
          </div>
        </body>
        </html>
      `);
    }
  },

  // トークン発行
  token: (req, res) => {
    // GETとPOSTの両方のパラメータを受け入れる（Web版Claude対応）
    const params = Object.assign({}, req.query, req.body);
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      code_verifier
    } = params;

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

    // クライアントID検証 - Claudeベースのクライアントは許容
    const isClaudeClient = 
      client_id === codeData.client_id || 
      client_id === process.env.OAUTH_CLIENT_ID || 
      codeData.client_id === 'claude-web-client' ||
      (client_id && client_id.includes('claude'));
    
    if (!isClaudeClient) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Client authentication failed'
      });
    }

    // リダイレクトURI検証 - 柔軟なマッチングを実施
    const redirectMatches = 
      redirect_uri === codeData.redirect_uri || 
      redirect_uri.startsWith(codeData.redirect_uri) || 
      codeData.redirect_uri.startsWith(redirect_uri) ||
      (new URL(redirect_uri).origin === new URL(codeData.redirect_uri).origin);
      
    if (!redirectMatches) {
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
      process.env.JWT_SECRET || 'default_secret_for_development_only',
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