// MCPとブラウザ自動テスト連携スクリプト
// 作成日時: 2025年5月17日 14:40
// 作成者: Claude 3.7 Sonnet

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

// ディレクトリ取得のための設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// テスト設定
const config = {
  targetUrl: 'https://render-mcp-server.onrender.com',
  testEndpoints: [
    { name: '基本接続テスト', path: '/status' },
    { name: '認証機能テスト', path: '/auth/status' },
    { name: 'エンドポイント到達性テスト', path: '/api/endpoints' },
    { name: 'SSE接続テスト', path: '/events' },
    { name: 'エラーハンドリングテスト', path: '/error/test' }
  ],
  logDir: '/Users/hashizaka/g/mcp-local/mcp_logs',
  timestamp: new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)
};

// ログディレクトリの確認
if (!fs.existsSync(config.logDir)) {
  fs.mkdirSync(config.logDir, { recursive: true });
}

// ログファイルの設定
const logFile = path.join(config.logDir, `direct_mcp_browser_test_${config.timestamp}.log`);

// ログ出力関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  
  // コンソールとファイルに出力
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
}

// ヘッダー出力
log('====================================================');
log(`MCP直接ブラウザテスト実行: ${config.timestamp}`);
log(`テスト対象サーバー: ${config.targetUrl}`);
log('====================================================');

// 各エンドポイントの操作を実行
async function runBrowserTests() {
  // 現在時刻を直接取得
  const now = new Date();
  log(`現在時刻: ${now.toISOString()}`);
  log('');
  log('テスト実行開始');
  
  // 各テストポイントを順番に実行
  for (let i = 0; i < config.testEndpoints.length; i++) {
    const endpoint = config.testEndpoints[i];
    log('');
    log(`${i + 1}. ${endpoint.name} (${config.targetUrl}${endpoint.path})`);
    log('----------------------------------------');
    
    const testUrl = `${config.targetUrl}${endpoint.path}`;
    
    // ステータスコード取得
    const statusPromise = new Promise((resolve, reject) => {
      exec(`curl -s -o /dev/null -w "%{http_code}" "${testUrl}"`, (error, stdout, stderr) => {
        if (error) {
          log(`エンドポイント [${endpoint.name}] テスト失敗: ${error.message}`);
          reject(error);
          return;
        }
        
        const statusCode = stdout.trim();
        resolve(statusCode);
      });
    });
    
    try {
      const statusCode = await statusPromise;
      
      if (statusCode === '200') {
        log(`エンドポイント [${endpoint.name}] 到達成功: ステータスコード ${statusCode}`);
        
        // コンテンツ取得
        const contentPromise = new Promise((resolve, reject) => {
          exec(`curl -s "${testUrl}"`, (error, stdout, stderr) => {
            if (error) {
              log(`コンテンツ取得エラー: ${error.message}`);
              reject(error);
              return;
            }
            
            resolve(stdout);
          });
        });
        
        try {
          const content = await contentPromise;
          // レスポンスの最初の200文字のみ表示
          const contentPreview = content.substring(0, 200);
          log(`レスポンス内容(一部): ${contentPreview}...`);
          log('テスト成功');
        } catch (contentError) {
          log(`コンテンツ取得中にエラー: ${contentError.message}`);
        }
      } else {
        log(`エンドポイント [${endpoint.name}] 到達失敗: ステータスコード ${statusCode}`);
      }
    } catch (statusError) {
      log(`ステータス取得中にエラー: ${statusError.message}`);
    }
    
    // 各テスト間に少し待機時間を入れる
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 最終ログ
  log('');
  log('====================================================');
  log('テスト実行完了');
  log(`結果ログファイル: ${logFile}`);
  log('====================================================');
}

// テスト実行
runBrowserTests();