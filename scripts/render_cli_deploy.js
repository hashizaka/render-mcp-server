/**
 * Render CLI を使用したリモートMCPサーバーデプロイスクリプト
 * 作成日: 2025年5月17日
 * 作成者: Claude 3.7 Sonnet
 * 更新: 2025年5月17日 - ESModuleに対応
 */

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { dirname } from 'path';

// ESM対応のための__dirnameの再現
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 環境変数の読み込み
dotenv.config();

// ログディレクトリの設定
const LOGS_DIR = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOGS_DIR, `render_cli_deploy_${new Date().toISOString().replace(/:/g, '-')}.log`);

// ログ関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Render設定
const RENDER_API_TOKEN = process.env.RENDER_API_TOKEN;
const SERVICE_NAME = 'render-mcp-server';
const GITHUB_REPO = 'hashizaka/render-mcp-server';
const ENV_VARS = [
  'RENDER_API_TOKEN=' + RENDER_API_TOKEN,
  'NODE_ENV=production',
  'PORT=10000',
  'LOG_LEVEL=info',
  'CORS_ORIGIN=https://claude.ai,https://api.anthropic.com'
];

// Render CLIコマンドを実行する関数
function executeRenderCommand(command) {
  return new Promise((resolve, reject) => {
    log(`実行コマンド: render ${command}`);
    
    exec(`npx render ${command}`, (error, stdout, stderr) => {
      if (error) {
        log(`コマンドエラー: ${error.message}`);
        log(`stderr: ${stderr}`);
        reject(error);
        return;
      }
      
      log(`stdout: ${stdout}`);
      if (stderr) log(`stderr: ${stderr}`);
      resolve(stdout);
    });
  });
}

// メイン処理
async function main() {
  try {
    log('Render CLIを使用したデプロイを開始します...');
    
    // APIトークンを設定
    log('Render CLI認証設定...');
    await executeRenderCommand(`login --api-token ${RENDER_API_TOKEN}`);
    
    // 既存のサービスをリスト
    log('既存のサービスを確認中...');
    const serviceList = await executeRenderCommand('list');
    const serviceExists = serviceList.includes(SERVICE_NAME);
    
    if (!serviceExists) {
      // 新規サービスの作成（Webサービス）
      log('新規サービスを作成中...');
      await executeRenderCommand(`create --type web --name ${SERVICE_NAME} --repo ${GITHUB_REPO} --branch main`);
      
      // 環境変数の設定
      log('環境変数を設定中...');
      for (const envVar of ENV_VARS) {
        await executeRenderCommand(`env set --service ${SERVICE_NAME} ${envVar}`);
      }
      
      // サービス設定の更新
      log('サービス設定を更新中...');
      await executeRenderCommand(`config set --service ${SERVICE_NAME} --build-command "npm install" --start-command "npm start" --health-check-path "/health" --plan starter`);
    }
    
    // デプロイをトリガー
    log('デプロイをトリガー中...');
    await executeRenderCommand(`deploy --service ${SERVICE_NAME}`);
    
    log('デプロイプロセスを開始しました。Renderダッシュボードで進捗を確認してください。');
    log('https://dashboard.render.com/');
    
    return { success: true, serviceName: SERVICE_NAME };
  } catch (error) {
    log(`エラーが発生しました: ${error.message}`);
    process.exit(1);
  }
}

// スクリプト実行
main()
  .then((result) => {
    log('デプロイリクエストが正常に送信されました');
    log(JSON.stringify(result, null, 2));
  })
  .catch((error) => {
    log(`致命的なエラー: ${error.message}`);
    process.exit(1);
  });