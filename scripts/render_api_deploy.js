/**
 * Render.com API を使用したリモートMCPサーバーデプロイスクリプト
 * 作成日: 2025年5月17日
 * 作成者: Claude 3.7 Sonnet
 * 更新日: 2025年5月17日 09:31
 */

import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// .envファイルを読み込み
dotenv.config();

// 相対パスの設定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// ログファイルの設定
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}
const LOG_FILE = path.join(LOGS_DIR, `render_deploy_${new Date().toISOString().replace(/:/g, '-')}.log`);

// ログ関数
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Render API設定
const RENDER_API_TOKEN = process.env.RENDER_API_TOKEN;
const API_BASE_URL = 'https://api.render.com/v1';
const GITHUB_REPO = 'hashizaka/render-mcp-server';
const SERVICE_NAME = 'render-mcp-server';

// API呼び出し関数
async function callRenderAPI(endpoint, method = 'GET', body = null) {
  if (!RENDER_API_TOKEN) {
    throw new Error('RENDER_API_TOKEN is not set in environment variables');
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${RENDER_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  };

  try {
    log(`API呼び出し: ${method} ${url}`);
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Render API error: ${response.status} ${response.statusText} ${
          errorData ? JSON.stringify(errorData) : ''
        }`
      );
    }
    
    if (response.status === 204) {
      return {};
    }
    
    return await response.json();
  } catch (error) {
    log(`API呼び出しエラー: ${error.message}`);
    throw error;
  }
}

// 所有者IDの取得
async function getOwners() {
  log('所有者一覧を取得中...');
  const owners = await callRenderAPI('/owners');
  if (!owners || owners.length === 0) {
    throw new Error('所有者情報が取得できませんでした');
  }
  
  // 個人所有者またはチームを探す
  const owner = owners[0]; // 通常は最初の所有者が個人アカウント
  log(`所有者が見つかりました: ${owner.id} (${owner.name || owner.email || 'Unknown'})`);
  return owner.id;
}

// 既存のサービスを検索
async function findExistingService() {
  log('既存のサービスを検索中...');
  const services = await callRenderAPI('/services');
  return services.find(service => service.name === SERVICE_NAME);
}

// 新規サービスの作成
async function createService(ownerId) {
  log('新規サービスを作成中...');
  log(`所有者ID: ${ownerId} を使用`);
  
  const serviceData = {
    type: 'web_service',
    name: SERVICE_NAME,
    ownerId: ownerId,
    region: 'oregon',
    branch: 'main',
    env: 'node',
    plan: 'starter',
    buildCommand: 'npm install',
    startCommand: 'npm start',
    repo: `https://github.com/${GITHUB_REPO}`,
    envVars: [
      { key: 'RENDER_API_TOKEN', value: RENDER_API_TOKEN },
      { key: 'NODE_ENV', value: 'production' },
      { key: 'PORT', value: '10000' },
      { key: 'LOG_LEVEL', value: 'info' },
      { key: 'CORS_ORIGIN', value: 'https://claude.ai,https://api.anthropic.com' }
    ],
    healthCheckPath: '/health',
    autoDeploy: 'yes'
  };
  
  return callRenderAPI('/services', 'POST', serviceData);
}

// サービスのデプロイをトリガー
async function triggerDeploy(serviceId) {
  log(`サービス ${serviceId} のデプロイをトリガー中...`);
  return callRenderAPI(`/services/${serviceId}/deploys`, 'POST');
}

// デプロイ状態の確認
async function checkDeployStatus(serviceId, deployId) {
  log(`デプロイID ${deployId} の状態を確認中...`);
  return callRenderAPI(`/services/${serviceId}/deploys/${deployId}`);
}

// メイン処理
async function main() {
  try {
    log('Render.com APIを使用したデプロイを開始します...');
    
    // 所有者IDを取得
    const ownerId = await getOwners();
    
    // 既存のサービスを確認
    let service = await findExistingService();
    
    // サービスがない場合は新規作成
    if (!service) {
      log('既存のサービスが見つかりません。新規作成します。');
      service = await createService(ownerId);
      log(`新規サービスが作成されました: ${service.id}`);
    } else {
      log(`既存のサービスが見つかりました: ${service.id}`);
    }
    
    // サービスIDを保存
    fs.appendFileSync(
      path.join(PROJECT_ROOT, '.env'),
      `\nRENDER_SERVICE_ID=${service.id}\n`,
      { flag: 'a' }
    );
    log(`サービスID ${service.id} を.envファイルに保存しました`);
    
    // デプロイをトリガー
    const deploy = await triggerDeploy(service.id);
    log(`デプロイが開始されました: ${deploy.id}`);
    
    // デプロイURL
    log(`デプロイ状況はこちらで確認できます: https://dashboard.render.com/web/${service.id}/deploys/${deploy.id}`);
    
    // サービスURL
    log(`サービスが利用可能になったら、以下のURLで接続できます: ${service.url}`);
    
    log('デプロイプロセスを開始しました。Renderダッシュボードで進捗を確認してください。');
    
    return {
      serviceId: service.id,
      deployId: deploy.id,
      serviceUrl: service.url
    };
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
