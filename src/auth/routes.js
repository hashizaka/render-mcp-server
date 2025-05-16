// 認証ルーターの設定
const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { generateToken, verifyToken } = require('./token-service');
const logger = require('../utils/logger').getLogger();

const router = express.Router();

// OAuth認証開始エンドポイント
router.get('/login', (req, res) => {
  // 認証リダイレクトURLを生成
  const authUrl = `https://oauth-provider.example.com/auth?client_id=${process.env.OAUTH_CLIENT_ID}&redirect_uri=${encodeURIComponent(process.env.OAUTH_REDIRECT_URI)}&response_type=code&scope=read`;
  
  res.redirect(authUrl);
});

// OAuth認証コールバックエンドポイント
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    logger.error('認証コードが受信されませんでした');
    return res.status(400).json({ error: '認証コードが必要です' });
  }
  
  try {
    // OAuth認証コードをトークンと交換
    const token = await generateToken(code);
    
    // 認証成功後のリダイレクト
    res.redirect(`/auth/success?token=${token}`);
  } catch (error) {
    logger.error(`認証エラー: ${error.message}`);
    res.status(500).json({ error: '認証処理中にエラーが発生しました' });
  }
});

// 認証成功エンドポイント
router.get('/success', (req, res) => {
  const { token } = req.query;
  
  if (!token) {
    return res.status(400).json({ error: 'トークンが必要です' });
  }
  
  // クライアントに表示するための成功ページ
  res.send(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>認証成功</title>
        <style>
          body { font-family: Arial, sans-serif; text-align: center; margin-top: 50px; }
          .success { color: green; }
          .container { max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="success">認証成功!</h1>
          <p>リモートMCPサーバーへの認証が完了しました。このウィンドウは安全に閉じることができます。</p>
        </div>
        <script>
          // トークンをローカルストレージに保存
          localStorage.setItem('mcp_auth_token', '${token}');
          
          // 3秒後にウィンドウを閉じる（オプション）
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
    </html>
  `);
});

// トークン検証エンドポイント
router.post('/verify', async (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'トークンが必要です' });
  }
  
  try {
    // トークンの検証
    const decoded = await verifyToken(token);
    res.status(200).json({ valid: true, user: decoded.user });
  } catch (error) {
    logger.error(`トークン検証エラー: ${error.message}`);
    res.status(401).json({ valid: false, error: 'トークンが無効です' });
  }
});

// ログアウトエンドポイント
router.post('/logout', passport.authenticate('jwt', { session: false }), (req, res) => {
  // 実際のログアウト処理はクライアント側で行われる（トークンの削除）
  // サーバー側では監査目的でログを残すのみ
  logger.info(`ユーザーがログアウトしました: ${req.user.id}`);
  res.status(200).json({ message: 'ログアウト成功' });
});

module.exports = router;
