import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const RENDER_API_TOKEN = process.env.RENDER_API_TOKEN;
const API_BASE_URL = 'https://api.render.com/v1';

/**
 * Render API呼び出しのベース関数
 */
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
    const response = await fetch(url, options);
    
    // レスポンスの処理
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(
        `Render API error: ${response.status} ${response.statusText} ${
          errorData ? JSON.stringify(errorData) : ''
        }`
      );
    }
    
    // 204 No Contentの場合は空オブジェクトを返す
    if (response.status === 204) {
      return {};
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error calling Render API:', error);
    throw error;
  }
}

/**
 * すべてのサービス一覧を取得
 */
export async function getAllServices() {
  return callRenderAPI('/services');
}

/**
 * 特定のサービス情報を取得
 */
export async function getServiceById(serviceId) {
  if (!serviceId) {
    throw new Error('Service ID is required');
  }
  return callRenderAPI(`/services/${serviceId}`);
}

/**
 * サービスのデプロイを実行
 */
export async function deployService(serviceId, options = {}) {
  if (!serviceId) {
    throw new Error('Service ID is required');
  }
  
  const deployOptions = {
    clearCache: options.clearCache || false
  };
  
  return callRenderAPI(`/services/${serviceId}/deploys`, 'POST', deployOptions);
}

/**
 * デプロイステータスの取得
 */
export async function getDeployStatus(serviceId, deployId) {
  if (!serviceId || !deployId) {
    throw new Error('Service ID and Deploy ID are required');
  }
  
  return callRenderAPI(`/services/${serviceId}/deploys/${deployId}`);
}

/**
 * サービスの環境変数を更新
 */
export async function updateEnvironmentVariables(serviceId, envVars) {
  if (!serviceId) {
    throw new Error('Service ID is required');
  }
  
  if (!Array.isArray(envVars)) {
    throw new Error('Environment variables must be an array');
  }
  
  return callRenderAPI(`/services/${serviceId}/env-vars`, 'PUT', { envVars });
}

/**
 * サービスの再起動
 */
export async function restartService(serviceId) {
  if (!serviceId) {
    throw new Error('Service ID is required');
  }
  
  return callRenderAPI(`/services/${serviceId}/restart`, 'POST');
}

/**
 * サービスの一時停止
 */
export async function suspendService(serviceId) {
  if (!serviceId) {
    throw new Error('Service ID is required');
  }
  
  return callRenderAPI(`/services/${serviceId}/suspend`, 'POST');
}

/**
 * サービスの再開
 */
export async function resumeService(serviceId) {
  if (!serviceId) {
    throw new Error('Service ID is required');
  }
  
  return callRenderAPI(`/services/${serviceId}/resume`, 'POST');
}

export default {
  getAllServices,
  getServiceById,
  deployService,
  getDeployStatus,
  updateEnvironmentVariables,
  restartService,
  suspendService,
  resumeService
};