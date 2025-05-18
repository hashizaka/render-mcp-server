import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// アクティブGoogle認証トークン保存
const googleTokensMap = new Map();

/**
 * Google OAuth認証コントローラー
 * リモートMCPサーバーでGoogle認証連携を行うための機能
 */
const googleAuthController = {
  /**
   * Googleトークン検証・変換
   * GoogleのOAuthトークンをMCPトークンに変換する
   */
  verifyAndConvertToken: async (req, res) => {
    const { google_token, client_id } = req.body;
    
    if (!google_token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Google token is required'
      });
    }
    
    try {
      // Googleトークン検証ロジック
      // 本番環境では適切なGoogle認証ライブラリを使用すべき
      const isValidToken = googleTokenIsValid(google_token);
      
      if (!isValidToken) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'Google token validation failed'
        });
      }
      
      // MCPアクセストークン生成
      const accessToken = jwt.sign(
        { 
          client_id: client_id || 'google-auth-client',
          type: 'access',
          auth_provider: 'google'
        },
        process.env.JWT_SECRET || 'default_secret_for_development_only',
        { expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600 }
      );
      
      // リフレッシュトークン生成
      const refreshToken = crypto.randomBytes(32).toString('hex');
      const refreshExpiresAt = Date.now() + (parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 2592000) * 1000;
      
      // トークンマッピング保存
      googleTokensMap.set(refreshToken, {
        google_token,
        client_id: client_id || 'google-auth-client',
        refreshExpiresAt
      });
      
      // レスポンス
      res.json({
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600,
        refresh_token: refreshToken
      });
      
    } catch (error) {
      console.error('Google token processing error:', error);
      return res.status(500).json({
        error: 'server_error',
        error_description: 'Failed to process Google authentication'
      });
    }
  },
  
  /**
   * Googleトークンを使用したリフレッシュトークン処理
   */
  refreshWithGoogleToken: async (req, res) => {
    const { refresh_token } = req.body;
    
    if (!refresh_token || !googleTokensMap.has(refresh_token)) {
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid refresh token'
      });
    }
    
    const tokenData = googleTokensMap.get(refresh_token);
    
    // 有効期限チェック
    if (Date.now() > tokenData.refreshExpiresAt) {
      googleTokensMap.delete(refresh_token);
      return res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Refresh token has expired'
      });
    }
    
    // 新しいアクセストークン生成
    const accessToken = jwt.sign(
      { 
        client_id: tokenData.client_id,
        type: 'access',
        auth_provider: 'google'
      },
      process.env.JWT_SECRET || 'default_secret_for_development_only',
      { expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600 }
    );
    
    // レスポンス
    res.json({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600,
      refresh_token: refresh_token
    });
  }
};

/**
 * Googleトークン検証ヘルパー関数
 * 実際の実装では、Google認証APIを使用して検証すべき
 */
function googleTokenIsValid(token) {
  // 開発用の簡易検証
  // 本番環境では、Google認証APIを使用した適切な検証が必要
  return token && token.length > 20;
}

export default googleAuthController;