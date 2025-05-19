/**
 * Web版Claude用MCP認証クライアントスクリプト
 * このスクリプトをブラウザコンソールで実行することで認証問題を修正
 */

// ローカルストレージのキー定義
const MCP_AUTH_TOKEN_KEY = 'mcp_auth_token';
const MCP_AUTH_TIMESTAMP_KEY = 'mcp_auth_timestamp';

// MCP認証情報クラス
class MCPAuthenticator {
  constructor() {
    this.setupMessageListener();
    this.setupSSEListener();
  }
  
  // メッセージリスナーを設定
  setupMessageListener() {
    window.addEventListener('message', (event) => {
      // MCPからの認証成功メッセージを処理
      if (event.data && event.data.type === 'mcp_auth_success') {
        console.log('MCP認証成功メッセージを受信しました');
        this.saveToken(event.data.token);
      }
    });
    
    console.log('MCP認証メッセージリスナーを設定しました');
  }
  
  // SSEイベントリスナーを設定
  setupSSEListener() {
    // Claudeカスタム統合のイベントリスナーを拡張
    // 既存のSSE接続があれば、その上に接続
    const originalEventSourceProto = window.EventSource.prototype;
    
    // onmessageを拡張
    const originalOnMessage = originalEventSourceProto.onmessage;
    originalEventSourceProto.onmessage = function(event) {
      try {
        const data = JSON.parse(event.data);
        
        // MCP認証要求イベントを検出
        if (data.type === 'auth_required') {
          console.log('MCP認証要求を検出しました');
          
          // 保存済みトークンがあれば自動適用
          const token = localStorage.getItem(MCP_AUTH_TOKEN_KEY);
          if (token) {
            console.log('保存済みトークンを適用します');
            
            // 次回リクエスト時にトークンを含める処理を追加
            // カスタム統合のヘッダーにトークンを注入
            if (window.customIntegrations) {
              window.customIntegrations.addAuthHeader = function(headers) {
                headers['Authorization'] = `Bearer ${token}`;
                return headers;
              };
            }
          }
        }
        
        // 認証成功イベントを検出
        if (data.type === 'connection' && data.authenticated === true) {
          console.log('MCP認証済み接続を検出しました');
        }
        
      } catch (e) {
        // JSONパースエラーは無視
      }
      
      // 元のハンドラを呼び出し
      if (originalOnMessage) {
        originalOnMessage.call(this, event);
      }
    };
    
    console.log('MCP SSEリスナーを設定しました');
  }
  
  // トークンを保存
  saveToken(token) {
    if (!token) return;
    
    try {
      localStorage.setItem(MCP_AUTH_TOKEN_KEY, token);
      localStorage.setItem(MCP_AUTH_TIMESTAMP_KEY, new Date().toISOString());
      console.log('MCP認証トークンを保存しました');
      
      // 現在のページをリロード
      setTimeout(() => {
        console.log('ページを再読み込みします...');
        window.location.reload();
      }, 2000);
      
    } catch (e) {
      console.error('トークン保存エラー:', e);
    }
  }
  
  // トークンを取得
  getToken() {
    return localStorage.getItem(MCP_AUTH_TOKEN_KEY);
  }
  
  // 認証状態を確認
  isAuthenticated() {
    const token = this.getToken();
    const timestamp = localStorage.getItem(MCP_AUTH_TIMESTAMP_KEY);
    
    if (!token || !timestamp) return false;
    
    // タイムスタンプが1時間以内かチェック
    const authTime = new Date(timestamp);
    const now = new Date();
    const hoursDiff = (now - authTime) / (1000 * 60 * 60);
    
    return hoursDiff < 1; // 1時間以内なら有効
  }
  
  // 認証情報をクリア
  clearAuth() {
    localStorage.removeItem(MCP_AUTH_TOKEN_KEY);
    localStorage.removeItem(MCP_AUTH_TIMESTAMP_KEY);
    console.log('MCP認証情報をクリアしました');
  }
}

// MCPオーセンティケーターをグローバルに設定
window.mcpAuth = new MCPAuthenticator();

// 情報表示
console.log('MCP認証クライアントが有効化されました');
console.log('認証状態:', window.mcpAuth.isAuthenticated() ? '認証済み' : '未認証');

if (window.mcpAuth.isAuthenticated()) {
  console.log('保存済みトークンでMCP接続を試みます');
} else {
  console.log('MCP認証が必要です。カスタムインテグレーション設定で認証を行ってください');
}

// 機能説明
console.log('利用可能な機能:');
console.log('- window.mcpAuth.isAuthenticated(): 認証状態を確認');
console.log('- window.mcpAuth.clearAuth(): 認証情報をクリア');
