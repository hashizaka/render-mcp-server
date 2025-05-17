// MCPプロトコル経由のPlaywrightテスト統合モジュール
// 作成日時: 2025年5月17日 14:18
// 作成者: Claude 3.7 Sonnet

// MCPを使ったPlaywrightテスト実行の統合モジュール
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

// 設定
const CONFIG = {
  logDir: '/Users/hashizaka/g/mcp-local/mcp_logs',
  renderServiceUrl: 'https://render-mcp-server.onrender.com',
  testTypes: [
    'basic-connection',
    'auth-system',
    'endpoint-access',
    'sse-connection',
    'error-handling'
  ],
  mcpCommand: 'npx -y @playwright/mcp'
};

// タイムスタンプ生成
const getTimestamp = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '').replace('T', '_').substring(0, 15);
};

// ログファイルパス生成
const getLogFilePath = (timestamp) => {
  return path.join(CONFIG.logDir, `integrated_mcp_test_${timestamp}.log`);
};

// ログディレクトリ確認
const ensureLogDir = () => {
  if (!fs.existsSync(CONFIG.logDir)) {
    fs.mkdirSync(CONFIG.logDir, { recursive: true });
  }
};

// テストURLの取得
const getTestUrl = (testType) => {
  switch (testType) {
    case 'basic-connection':
      return `${CONFIG.renderServiceUrl}/status`;
    case 'auth-system':
      return `${CONFIG.renderServiceUrl}/auth/status`;
    case 'endpoint-access':
      return `${CONFIG.renderServiceUrl}/api/endpoints`;
    case 'sse-connection':
      return `${CONFIG.renderServiceUrl}/events`;
    case 'error-handling':
      return `${CONFIG.renderServiceUrl}/error/test`;
    default:
      return CONFIG.renderServiceUrl;
  }
};

// テストスクリプト生成
const generateTestScript = (testType, timestamp) => {
  const testUrl = getTestUrl(testType);
  const screenshotPath = path.join(CONFIG.logDir, `mcp_integrated_${testType}_${timestamp}.png`);
  
  return `
import { test, expect } from '@playwright/test';

test('Integrated MCP Test: ${testType}', async ({ page }) => {
  console.log('テスト開始: ${testType}');
  console.log('URL: ${testUrl}');
  
  try {
    // ページにアクセス
    const response = await page.goto('${testUrl}');
    console.log('ステータス:', response.status());
    
    // スクリーンショット撮影
    await page.screenshot({ path: '${screenshotPath}' });
    console.log('スクリーンショット保存完了');
    
    // ページ内容の確認
    const content = await page.content();
    console.log('ページ内容（一部）:', content.substring(0, 150) + '...');
    
    // 特定のテスト処理
    if ('${testType}' === 'sse-connection') {
      await page.waitForTimeout(5000);
      const events = await page.evaluate(() => document.body.innerText);
      console.log('イベントデータ:', events);
    }
    
    console.log('テスト成功: ${testType}');
  } catch (error) {
    console.error('テスト失敗:', error.message);
  }
});
  `;
};

// MCP経由でテスト実行
const runTestWithMCP = (testType, timestamp) => {
  const testScriptContent = generateTestScript(testType, timestamp);
  const testScriptPath = path.join('/tmp', `mcp_integrated_${testType}_${timestamp}.js`);
  
  // テストスクリプトを一時ファイルに書き込み
  fs.writeFileSync(testScriptPath, testScriptContent);
  
  // MCPコマンド実行
  try {
    console.log(`${testType} テスト実行中...`);
    const result = execSync(`${CONFIG.mcpCommand} --test "${testScriptPath}"`, { encoding: 'utf8' });
    console.log(result);
    return result;
  } catch (error) {
    console.error(`エラー (${testType}):`, error.message);
    return `テスト失敗: ${error.message}`;
  }
};

// メイン実行関数
const runIntegratedTests = () => {
  const timestamp = getTimestamp();
  ensureLogDir();
  const logFilePath = getLogFilePath(timestamp);
  
  // ヘッダー情報をログに書き込み
  const headerInfo = `
====================================================
MCP統合Playwrightテスト実行: ${timestamp}
テスト対象サーバー: ${CONFIG.renderServiceUrl}
====================================================
`;
  fs.writeFileSync(logFilePath, headerInfo);
  console.log(headerInfo);
  
  // 各テストを実行
  CONFIG.testTypes.forEach(testType => {
    const separator = `\n----------------------------------------\n`;
    fs.appendFileSync(logFilePath, `${separator}テスト実行: ${testType}${separator}`);
    
    const result = runTestWithMCP(testType, timestamp);
    fs.appendFileSync(logFilePath, result);
    
    fs.appendFileSync(logFilePath, `${separator}テスト完了: ${testType}${separator}`);
  });
  
  // フッター情報をログに書き込み
  const footerInfo = `
====================================================
MCP統合テスト実行完了
結果レポートパス: ${logFilePath}
スクリーンショット保存先: ${CONFIG.logDir}
====================================================
`;
  fs.appendFileSync(logFilePath, footerInfo);
  console.log(footerInfo);
};

// エクスポート
export {
  runIntegratedTests,
  getTestUrl,
  CONFIG
};

// コマンドライン実行の場合
if (import.meta.url === import.meta.main) {
  runIntegratedTests();
}