// OAuth認証コントローラー修正案
// ファイル: /mcp-server/controllers/auth/oauth-controller.js

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// 一時的な認証コード保存（本番環境ではRedisなどを使用）
const authorizationCodes = new Map();
// アクティブセッション保存
const activeTokens = new Map();

const oauthController = {
  // 認証コールバック処理
  callback: (req, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        return res.status(400).json({
          error: 'invalid_request',
          error_description: 'Authorization code is required'
        });
      }
      
      // 認証コードの存在確認
      if (!authorizationCodes.has(code)) {
        return res.status(400).json({
          error: 'invalid_grant',
          error_description: 'Invalid or expired authorization code'
        });
      }
      
      const codeData = authorizationCodes.get(code);
      authorizationCodes.delete(code); // 使用済みコードの削除
      
      // アクセストークン生成（修正点：コールバック時にトークン発行）
      const accessToken = jwt.sign(
        { client_id: codeData.client_id || 'default-client', type: 'access' },
        process.env.JWT_SECRET || 'default_secret_for_development_only',
        { expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600 }
      );
      
      // リフレッシュトークン生成
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const refreshExpiresAt = Date.now() + (parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 2592000) * 1000;
      
      // トークン保存
      activeTokens.set(refreshToken, {
        client_id: codeData.client_id || 'default-client',
        refreshExpiresAt
      });
      
      console.log(`認証完了: クライアントID ${codeData.client_id || 'default-client'} にトークン発行`);
      
      // 成功ページ表示（修正点：親ウィンドウ通信機能追加）
      res.send(`
        <!DOCTYPE html>
        <html lang="ja">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>認証成功</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; text-align: center; }
            .container { max-width: 600px; margin: 0 auto; }
            .success { color: #00aa00; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="success">認証成功</h1>
            <p>MCPサーバーへの接続が承認されました。</p>
            <p>このページは自動的に閉じられます。</p>
            <script>
              // 認証成功メッセージを親ウィンドウに送信
              try {
                if (window.opener) {
                  window.opener.postMessage({
                    type: 'mcp_auth_success',
                    token: '${accessToken}',
                    timestamp: new Date().toISOString()
                  }, '*');
                  console.log('認証メッセージを親ウィンドウに送信しました');
                }
              } catch (e) {
                console.error('親ウィンドウとの通信エラー:', e);
              }
              
              // トークンをローカルストレージに保存
              try {
                if (window.localStorage) {
                  window.localStorage.setItem('mcp_auth_token', '${accessToken}');
                  window.localStorage.setItem('mcp_auth_timestamp', new Date().toISOString());
                  console.log('認証情報をローカルストレージに保存しました');
                }
              } catch (e) {
                console.error('ローカルストレージ保存エラー:', e);
              }
              
              // 3秒後に閉じる試行
              setTimeout(() => {
                window.close();
              }, 3000);
            </script>
          </div>
        </body>
        </html>
      `);
    } catch (error) {
      console.error('認証コールバックエラー:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'Internal server error during callback processing',
        details: process.env.NODE_ENV === 'production' ? undefined : error.message
      });
    }
  },

  // 以下省略（既存コードと同様）...
  
  // トークン発行
  token: (req, res) => {
    // 既存のコードと同様...
  }
};

export default oauthController;