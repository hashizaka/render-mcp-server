import express from 'express';
import oauthController from '../../controllers/auth/oauth-controller.js';
import tokenController from '../../controllers/auth/token-controller.js';

const router = express.Router();

// ルート認証エンドポイント - Web版Claude互換性対応
router.get('/', (req, res) => {
  res.redirect('/auth/authorize' + (req.query ? '?' + new URLSearchParams(req.query).toString() : ''));
});

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