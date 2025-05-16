// Passport認証設定
const passport = require('passport');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const { Strategy: OAuth2Strategy } = require('passport-oauth2');
const logger = require('../utils/logger').getLogger();

/**
 * Passportの設定を行う関数
 */
const setupPassport = () => {
  // JWT認証ストラテジーの設定
  const jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET
  };
  
  passport.use(new JwtStrategy(jwtOptions, (jwtPayload, done) => {
    try {
      // ペイロードからユーザー情報を取得
      const user = jwtPayload.user;
      
      if (!user) {
        logger.warn('JWTペイロードにユーザー情報がありません');
        return done(null, false);
      }
      
      // 有効期限のチェック
      if (Date.now() >= jwtPayload.oauth.expires_at) {
        logger.warn(`ユーザー ${user.id} のトークンの有効期限が切れています`);
        return done(null, false);
      }
      
      // 認証成功
      logger.debug(`ユーザー ${user.id} を認証しました`);
      return done(null, user);
    } catch (error) {
      logger.error(`JWT認証エラー: ${error.message}`);
      return done(error, false);
    }
  }));
  
  // OAuth2認証ストラテジーの設定（必要に応じて）
  const oauth2Options = {
    authorizationURL: 'https://oauth-provider.example.com/auth',
    tokenURL: 'https://oauth-provider.example.com/token',
    clientID: process.env.OAUTH_CLIENT_ID,
    clientSecret: process.env.OAUTH_CLIENT_SECRET,
    callbackURL: process.env.OAUTH_REDIRECT_URI
  };
  
  passport.use(new OAuth2Strategy(oauth2Options, (accessToken, refreshToken, profile, done) => {
    try {
      // OAuthプロバイダーからユーザー情報を取得する処理
      // ※実際の実装では、プロファイル情報の取得やユーザー検証を行う
      
      const user = {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: profile.role || 'user'
      };
      
      logger.info(`OAuthでユーザー ${user.id} を認証しました`);
      return done(null, user);
    } catch (error) {
      logger.error(`OAuth認証エラー: ${error.message}`);
      return done(error, false);
    }
  }));
};

module.exports = {
  setupPassport
};
