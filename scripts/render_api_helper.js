/**
 * Render API連携用ヘルパースクリプト
 * 
 * GitHub Actionsから利用するためのRender.com API関連機能を提供
 * 
 * 作成日: 2025年5月17日
 * 作成者: Claude 3.7 Sonnet
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// 環境変数の読み込み
dotenv.config();

const RENDER_API_URL = 'https://api.render.com/v1';
const RENDER_API_TOKEN = process.env.RENDER_API_TOKEN || '';
const SERVICE_NAME = 'render-mcp-server';

/**
 * Render APIへのリクエスト送信関数
 */
async function sendRenderRequest(endpoint, method = 'GET', body = null) {
  const url = `${RENDER_API_URL}${endpoint}`;
  const headers = {
    'Authorization': `Bearer ${RENDER_API_TOKEN}`,
    'Content-Type': 'application/json'
  };

  const options = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  };

  try {
    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Render API request failed with status ${response.status}: ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error calling Render API: ${error.message}`);
    throw error;
  }
}

/**
 * サービス一覧の取得
 */
export async function getServices() {
  return sendRenderRequest('/services');
}

/**
 * サービスIDの取得（サービス名から）
 */
export async function getServiceIdByName(name = SERVICE_NAME) {
  const services = await getServices();
  const service = services.find(s => s.name === name);
  
  if (!service) {
    throw new Error(`Service with name ${name} not found`);
  }
  
  return service.id;
}

/**
 * サービス詳細の取得
 */
export async function getServiceDetails(serviceId) {
  return sendRenderRequest(`/services/${serviceId}`);
}

/**
 * デプロイの実行
 */
export async function triggerDeploy(serviceId) {
  return sendRenderRequest(`/services/${serviceId}/deploys`, 'POST');
}

/**
 * デプロイステータスの取得
 */
export async function getDeployStatus(serviceId, deployId) {
  return sendRenderRequest(`/services/${serviceId}/deploys/${deployId}`);
}

/**
 * サービスのステータス監視（デプロイ完了まで待機）
 */
export async function waitForDeployment(serviceId, deployId, maxAttempts = 30, intervalSeconds = 10) {
  console.log(`Monitoring deployment status for deploy ${deployId}...`);
  
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    
    const deployStatus = await getDeployStatus(serviceId, deployId);
    console.log(`Deploy status: ${deployStatus.status} (Attempt ${attempts}/${maxAttempts})`);
    
    if (deployStatus.status === 'succeeded') {
      console.log(`Deployment completed successfully!`);
      return deployStatus;
    }
    
    if (deployStatus.status === 'failed' || deployStatus.status === 'cancelled') {
      throw new Error(`Deployment failed with status: ${deployStatus.status}`);
    }
    
    // 次のチェックまで待機
    await new Promise(resolve => setTimeout(resolve, intervalSeconds * 1000));
  }
  
  throw new Error(`Deployment monitoring timed out after ${maxAttempts} attempts`);
}

/**
 * メイン実行関数（コマンドライン実行用）
 */
export async function main() {
  try {
    console.log('Starting Render API deployment process...');
    
    // サービスIDの取得
    console.log(`Finding service ID for ${SERVICE_NAME}...`);
    const serviceId = await getServiceIdByName();
    console.log(`Service ID: ${serviceId}`);
    
    // デプロイの実行
    console.log('Triggering deployment...');
    const deployResponse = await triggerDeploy(serviceId);
    console.log(`Deployment triggered. Deploy ID: ${deployResponse.id}`);
    
    // デプロイステータスの監視
    await waitForDeployment(serviceId, deployResponse.id);
    
    // サービス詳細の取得
    const serviceDetails = await getServiceDetails(serviceId);
    console.log(`Deployment successful! Service URL: ${serviceDetails.url}`);
    
    return {
      success: true,
      serviceId,
      deployId: deployResponse.id,
      serviceUrl: serviceDetails.url
    };
  } catch (error) {
    console.error(`Deployment failed: ${error.message}`);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmain関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}