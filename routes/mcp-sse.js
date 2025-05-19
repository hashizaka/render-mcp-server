import express from 'express';
import renderService from '../services/render-service.js';

const router = express.Router();

// クライアント接続管理
const clients = new Map();

// イベント送信関数
function sendEventToClients(event) {
  const eventString = `data: ${JSON.stringify(event)}\n\n`;
  
  for (const [clientId, response] of clients.entries()) {
    try {
      response.write(eventString);
    } catch (error) {
      console.error(`Error sending event to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  }
}

// MCP SSEエンドポイント（修正版）
router.get('/', (req, res) => {
  // SSEヘッダー設定
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // クライアントID設定
  const clientId = Date.now();
  clients.set(clientId, res);
  
  // 接続確立メッセージ
  res.write(`id: ${clientId}\n`);

  // 認証状態に応じたメッセージ（修正点：詳細情報追加）
  if (req.isAuthenticated) {
    // 認証成功メッセージ（拡張）
    res.write(`data: ${JSON.stringify({
      type: 'connection',
      message: 'MCP SSE接続確立',
      clientId,
      authenticated: true,
      authMethod: 'token',
      user: {
        clientId: req.user.client_id,
        type: req.user.type,
        provider: req.user.auth_provider || 'oauth'
      },
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // 認証成功後、1秒後に追加確認メッセージを送信（修正点：追加）
    setTimeout(() => {
      if (clients.has(clientId)) {
        res.write(`data: ${JSON.stringify({
          type: 'auth_success_confirmed',
          message: '認証が確認されました',
          clientId,
          timestamp: new Date().toISOString()
        })}\n\n`);
      }
    }, 1000);
  } else {
    // 認証要求メッセージ（拡張：エラー情報追加）
    res.write(`data: ${JSON.stringify({
      type: 'auth_required',
      message: '認証が必要です',
      clientId,
      authenticated: false,
      authUrl: req.authUrl,
      error: req.authError, // エラー情報があれば含める
      timestamp: new Date().toISOString()
    })}\n\n`);
    
    // 認証状態確認用の定期メッセージ（新規追加）
    const authCheckInterval = setInterval(() => {
      if (clients.has(clientId)) {
        // 認証状態チェック用メッセージ
        res.write(`data: ${JSON.stringify({
          type: 'auth_check',
          message: '認証状態を確認してください',
          clientId,
          authUrl: req.authUrl,
          timestamp: new Date().toISOString()
        })}\n\n`);
      } else {
        clearInterval(authCheckInterval);
      }
    }, 10000); // 10秒ごとに認証状態確認
    
    // クリーンアップ処理追加
    req.on('close', () => {
      clearInterval(authCheckInterval);
    });
  }
  
  // 30秒ごとのキープアライブ
  const keepAliveInterval = setInterval(() => {
    if (clients.has(clientId)) {
      res.write(`id: ${Date.now()}\n`);
      res.write(`data: ${JSON.stringify({
        type: 'keepalive',
        timestamp: new Date().toISOString()
      })}\n\n`);
    }
  }, 30000);
  
  // 接続終了処理
  req.on('close', () => {
    clients.delete(clientId);
    clearInterval(keepAliveInterval);
    console.log(`Client ${clientId} disconnected from SSE`);
  });
});

// MCPリクエスト処理エンドポイント
router.post('/request', async (req, res) => {
  try {
    const { action, serviceId, parameters = {}, requestId } = req.body;
    
    if (!action) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'action is required'
      });
    }
    
    // リクエスト受信通知をSSEクライアントに送信
    sendEventToClients({
      type: 'request_received',
      requestId: requestId || Date.now().toString(),
      action,
      serviceId,
      timestamp: new Date().toISOString()
    });
    
    let result;
    
    // actionに応じた処理
    switch (action) {
      case 'list_services':
        result = await renderService.getAllServices();
        break;
        
      case 'get_service':
        if (!serviceId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'serviceId is required for get_service action'
          });
        }
        result = await renderService.getServiceById(serviceId);
        break;
        
      case 'deploy':
        if (!serviceId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'serviceId is required for deploy action'
          });
        }
        result = await renderService.deployService(serviceId, parameters);
        break;
        
      case 'restart':
        if (!serviceId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'serviceId is required for restart action'
          });
        }
        result = await renderService.restartService(serviceId);
        break;
        
      case 'suspend':
        if (!serviceId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'serviceId is required for suspend action'
          });
        }
        result = await renderService.suspendService(serviceId);
        break;
        
      case 'resume':
        if (!serviceId) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'serviceId is required for resume action'
          });
        }
        result = await renderService.resumeService(serviceId);
        break;
        
      case 'update_env':
        if (!serviceId || !parameters.envVars) {
          return res.status(400).json({
            error: 'Bad Request',
            message: 'serviceId and envVars are required for update_env action'
          });
        }
        result = await renderService.updateEnvironmentVariables(serviceId, parameters.envVars);
        break;
        
      default:
        return res.status(400).json({
          error: 'Bad Request',
          message: `Unsupported action: ${action}`
        });
    }
    
    // 成功イベントをSSEクライアントに送信
    sendEventToClients({
      type: 'request_completed',
      requestId: requestId || Date.now().toString(),
      action,
      serviceId,
      result,
      timestamp: new Date().toISOString()
    });
    
    // APIレスポンスを返す
    res.json({
      success: true,
      action,
      serviceId,
      result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('MCP request error:', error);
    
    // エラーイベントをSSEクライアントに送信
    sendEventToClients({
      type: 'request_error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      error: 'Server Error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;