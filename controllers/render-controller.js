import renderService from '../services/render-service.js';

/**
 * サービス一覧の取得
 */
export async function getAllServices(req, res, next) {
  try {
    const services = await renderService.getAllServices();
    res.json(services);
  } catch (error) {
    next(error);
  }
}

/**
 * 特定のサービス情報の取得
 */
export async function getServiceById(req, res, next) {
  const { serviceId } = req.params;
  
  try {
    const service = await renderService.getServiceById(serviceId);
    res.json(service);
  } catch (error) {
    next(error);
  }
}

/**
 * サービスのデプロイ実行
 */
export async function deployService(req, res, next) {
  const { serviceId } = req.params;
  const { clearCache } = req.body || {};
  
  try {
    const deployResponse = await renderService.deployService(serviceId, {
      clearCache: Boolean(clearCache)
    });
    
    res.json({
      success: true,
      message: 'Deployment initiated successfully',
      deployId: deployResponse.id,
      data: deployResponse
    });
  } catch (error) {
    next(error);
  }
}

/**
 * デプロイステータスの取得
 */
export async function getDeployStatus(req, res, next) {
  const { serviceId, deployId } = req.params;
  
  try {
    const status = await renderService.getDeployStatus(serviceId, deployId);
    res.json(status);
  } catch (error) {
    next(error);
  }
}

/**
 * サービスの環境変数更新
 */
export async function updateEnvironmentVariables(req, res, next) {
  const { serviceId } = req.params;
  const { envVars } = req.body;
  
  if (!Array.isArray(envVars)) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'envVars must be an array of environment variables'
    });
  }
  
  try {
    const result = await renderService.updateEnvironmentVariables(serviceId, envVars);
    res.json({
      success: true,
      message: 'Environment variables updated successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
}

/**
 * サービスの再起動
 */
export async function restartService(req, res, next) {
  const { serviceId } = req.params;
  
  try {
    await renderService.restartService(serviceId);
    res.json({
      success: true,
      message: 'Service restart initiated successfully',
      serviceId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * サービスの一時停止
 */
export async function suspendService(req, res, next) {
  const { serviceId } = req.params;
  
  try {
    await renderService.suspendService(serviceId);
    res.json({
      success: true,
      message: 'Service suspended successfully',
      serviceId
    });
  } catch (error) {
    next(error);
  }
}

/**
 * サービスの再開
 */
export async function resumeService(req, res, next) {
  const { serviceId } = req.params;
  
  try {
    await renderService.resumeService(serviceId);
    res.json({
      success: true,
      message: 'Service resumed successfully',
      serviceId
    });
  } catch (error) {
    next(error);
  }
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