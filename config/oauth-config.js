import dotenv from 'dotenv';

dotenv.config();

export const oauthConfig = {
  // クライアント設定
  clientId: process.env.OAUTH_CLIENT_ID || 'render_mcp_client',
  clientSecret: process.env.OAUTH_CLIENT_SECRET || '',
  
  // トークン設定
  accessTokenExpiry: parseInt(process.env.ACCESS_TOKEN_EXPIRY) || 3600, // 1時間
  refreshTokenExpiry: parseInt(process.env.REFRESH_TOKEN_EXPIRY) || 2592000, // 30日
  
  // リダイレクト設定
  defaultRedirectUri: process.env.OAUTH_REDIRECT_URI || 'https://claude.ai/oauth/callback',
  allowedRedirectUris: process.env.ALLOWED_REDIRECT_URIS ? 
    process.env.ALLOWED_REDIRECT_URIS.split(',') : 
    [
      'https://claude.ai/oauth/callback',
      'https://api.anthropic.com/oauth/callback',
      'https://claude.anthropic.com/oauth/callback'
    ],
  
  // プロトコル設定
  protocolVersion: '2025-03-26',
  
  // セキュリティ設定
  requirePKCE: true,
  tokenSigningKey: process.env.JWT_SECRET || 'default_secret_for_development_only',
  
  // Web版Claude連携設定
  enableWebClaudeCompat: process.env.ENABLE_WEB_CLAUDE_COMPAT === 'true'
};

export default oauthConfig;