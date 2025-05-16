import express from 'express';
import renderController from '../controllers/render-controller.js';

const router = express.Router();

// API認証ミドルウェア
const apiAuth = (req, res, next) => {
  // 実際の実装ではより堅牢な認証を実装すべき
  // 現在はMCPから直接アクセスする前提での簡易版
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  next();
};

// すべてのルートに認証を適用
router.use(apiAuth);

// サービス管理エンドポイント
router.get('/services', renderController.getAllServices);
router.get('/services/:serviceId', renderController.getServiceById);
router.post('/services/:serviceId/deploy', renderController.deployService);
router.get('/services/:serviceId/deploys/:deployId', renderController.getDeployStatus);
router.put('/services/:serviceId/env-vars', renderController.updateEnvironmentVariables);
router.post('/services/:serviceId/restart', renderController.restartService);
router.post('/services/:serviceId/suspend', renderController.suspendService);
router.post('/services/:serviceId/resume', renderController.resumeService);

// MCP専用エンドポイント
router.post('/mcp/deploy', async (req, res, next) => {
  try {
    const { serviceId, clearCache = false } = req.body;
    
    if (!serviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'serviceId is required'
      });
    }
    
    const deployResponse = await renderController.deployService({
      params: { serviceId },
      body: { clearCache }
    }, res, (err) => {
      if (err) return next(err);
    });
    
    // deployServiceが直接レスポンスを送信するため、
    // ここで追加のレスポンスは不要
  } catch (error) {
    next(error);
  }
});

// MCP専用統合エンドポイント
router.post('/mcp/actions', async (req, res, next) => {
  try {
    const { action, serviceId, parameters } = req.body;
    
    if (!action || !serviceId) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'action and serviceId are required'
      });
    }
    
    let result;
    
    switch (action) {
      case 'deploy':
        // deployServiceを呼び出し
        result = await renderController.deployService({
          params: { serviceId },
          body: parameters || {}
        }, res, (err) => {
          if (err) throw err;
        });
        break;
        
      case 'restart':
        await renderController.restartService({
          params: { serviceId }
        }, res, (err) => {
          if (err) throw err;
        });
        break;
        
      case 'suspend':
        await renderController.suspendService({
          params: { serviceId }
        }, res, (err) => {
          if (err) throw err;
        });
        break;
        
      case 'resume':
        await renderController.resumeService({
          params: { serviceId }
        }, res, (err) => {
          if (err) throw err;
        });
        break;
        
      case 'update-env':
        if (!parameters || !parameters.envVars) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'envVars parameter is required for update-env action'
          });
        }
        
        await renderController.updateEnvironmentVariables({
          params: { serviceId },
          body: { envVars: parameters.envVars }
        }, res, (err) => {
          if (err) throw err;
        });
        break;
        
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unsupported action: ${action}`
        });
    }
    
    // 各コントローラーメソッドが直接レスポンスを送信するため、
    // ここで追加のレスポンスは不要
  } catch (error) {
    next(error);
  }
});

export default router;