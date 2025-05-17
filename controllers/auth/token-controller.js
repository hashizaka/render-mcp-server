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
      process.env.JWT_SECRET || 'default_secret_for_development_only',
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