// トークン操作サービス
const jwt = require('jsonwebtoken');
const axios = require('axios');
const logger = require('../utils/logger').getLogger();

/**
 * 認証コードを使用してアクセストークンを取得し、JWTを生成する
 * @param {string} authCode - OAuth認証コード
 * @returns {Promise<string>} JWTトークン
 */
const generateToken = async (authCode) => {
  try {
    // OAuth認証コードをアクセストークンと交換
    const response = await axios.post('https://oauth-provider.example.com/token', {
      code: authCode,
      client_id: process.env.OAUTH_CLIENT_ID,
      client_secret: process.env.OAUTH_CLIENT_SECRET,
      redirect_uri: process.env.OAUTH_REDIRECT_URI,
      grant_type: 'authorization_code'
    });
    
    const { access_token, user_info } = response.data;
    
    if (!access_token) {
      throw new Error('アクセストークンが取得できませんでした');
    }
    
    // ユーザー情報を取得
    const userResponse = await axios.get('https://oauth-provider.example.com/userinfo', {
      headers: {
        'Authorization': `Bearer ${access_token}`
      }
    });
    
    const userData = userResponse.data;
    
    // JWTトークンの生成
    const token = jwt.sign(
      {
        user: {
          id: userData.id,
          email: userData.email,
          name: userData.name,
          role: userData.role || 'user'
        },
        oauth: {
          access_token,
          expires_at: Date.now() + (60 * 60 * 1000) // 1時間の有効期限
        }
      },
      process.env.JWT_SECRET,
      { expiresIn: '12h' } // JWTの有効期限は12時間
    );
    
    logger.info(`ユーザー ${userData.email} のトークンを生成しました`);
    return token;
  } catch (error) {
    logger.error(`トークン生成エラー: ${error.message}`);
    throw new Error('トークン生成中にエラーが発生しました');
  }
};

/**
 * JWTトークンを検証する
 * @param {string} token - 検証するJWTトークン
 * @returns {Promise<Object>} デコードされたトークンデータ
 */
const verifyToken = async (token) => {
  try {
    // トークンの検証
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // トークンの有効期限チェック
    if (Date.now() >= decoded.oauth.expires_at) {
      // OAuthトークンの更新処理（実装省略）
      throw new Error('アクセストークンの有効期限が切れています');
    }
    
    return decoded;
  } catch (error) {
    logger.error(`トークン検証エラー: ${error.message}`);
    throw new Error('トークンが無効です');
  }
};

module.exports = {
  generateToken,
  verifyToken
};
