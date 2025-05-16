// 同期コントローラー
const path = require('path');
const fs = require('fs-extra');
const logger = require('../../utils/logger').getLogger();
const { notify } = require('../../notifications');

// 同期状態
let syncState = {
  active: false,
  lastSync: null,
  currentOperation: null,
  progress: 0,
  errors: []
};

// 同期履歴
const syncHistory = [];

// 競合リスト
const conflicts = [];

/**
 * 同期ステータスの取得
 */
const getStatus = (req, res) => {
  logger.info(`ユーザー ${req.user.id} が同期ステータスを要求しました`);
  res.status(200).json(syncState);
};

/**
 * 同期処理の開始
 */
const startSync = async (req, res) => {
  const { mode = 'auto' } = req.body; // 同期モード: auto, manual, newer, local, remote
  
  logger.info(`ユーザー ${req.user.id} が同期を開始しました。モード: ${mode}`);
  
  if (syncState.active) {
    return res.status(409).json({
      error: '同期処理がすでに実行中です',
      currentState: syncState
    });
  }
  
  // 同期状態の更新
  syncState = {
    active: true,
    lastSync: new Date(),
    currentOperation: '初期化中',
    progress: 0,
    errors: []
  };
  
  // 同期の非同期実行
  performSync(mode, req.user)
    .then(result => {
      logger.info(`同期が完了しました: ${JSON.stringify(result)}`);
      
      // 通知の送信
      notify('syncCompleted', {
        userId: req.user.id,
        result
      }).catch(err => {
        logger.error(`同期完了通知の送信に失敗しました: ${err.message}`);
      });
    })
    .catch(error => {
      logger.error(`同期処理中にエラーが発生しました: ${error.message}`);
      
      // 同期状態の更新
      syncState.active = false;
      syncState.errors.push({
        time: new Date(),
        message: error.message
      });
      
      // 通知の送信
      notify('syncFailed', {
        userId: req.user.id,
        error: error.message
      }).catch(err => {
        logger.error(`同期失敗通知の送信に失敗しました: ${err.message}`);
      });
    });
  
  // 即時レスポンス
  res.status(200).json({
    message: '同期処理を開始しました',
    state: syncState
  });
};

/**
 * 同期処理の実行
 * @param {string} mode - 同期モード
 * @param {Object} user - ユーザー情報
 * @returns {Promise<Object>} 同期結果
 */
const performSync = async (mode, user) => {
  try {
    // 同期処理のシミュレーション
    
    // ファイル変更の検出
    syncState.currentOperation = 'ファイル変更の検出中';
    syncState.progress = 10;
    await simulateOperation(1000); // 処理の遅延をシミュレート
    
    // ローカルファイルの同期
    syncState.currentOperation = 'ローカルファイルの同期中';
    syncState.progress = 30;
    await simulateOperation(1500);
    
    // リモートファイルの同期
    syncState.currentOperation = 'リモートファイルの同期中';
    syncState.progress = 60;
    await simulateOperation(2000);
    
    // 競合の解決
    syncState.currentOperation = '競合の解決中';
    syncState.progress = 80;
    await simulateOperation(1000);
    
    // 同期完了
    syncState.currentOperation = '完了';
    syncState.progress = 100;
    await simulateOperation(500);
    
    // 同期履歴の更新
    const historyEntry = {
      id: generateId(),
      startTime: syncState.lastSync,
      endTime: new Date(),
      user: user.id,
      mode,
      filesAdded: 5,
      filesUpdated: 10,
      filesDeleted: 2,
      conflicts: 1,
      status: 'completed'
    };
    
    syncHistory.unshift(historyEntry); // 履歴の先頭に追加
    
    // 履歴の最大数を制限
    if (syncHistory.length > 100) {
      syncHistory.pop();
    }
    
    // 同期状態のリセット
    syncState = {
      active: false,
      lastSync: new Date(),
      currentOperation: null,
      progress: 0,
      errors: []
    };
    
    return {
      success: true,
      stats: historyEntry
    };
  } catch (error) {
    logger.error(`同期エラー: ${error.message}`);
    
    // 同期状態の更新
    syncState.active = false;
    syncState.errors.push({
      time: new Date(),
      message: error.message
    });
    
    throw error;
  }
};

/**
 * 処理の遅延をシミュレート
 * @param {number} ms - 遅延時間（ミリ秒）
 * @returns {Promise<void>}
 */
const simulateOperation = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * 同期停止
 */
const stopSync = (req, res) => {
  logger.info(`ユーザー ${req.user.id} が同期の停止を要求しました`);
  
  if (!syncState.active) {
    return res.status(400).json({ error: '同期処理が実行中ではありません' });
  }
  
  // 同期状態の更新
  syncState.active = false;
  syncState.currentOperation = '停止済み';
  
  res.status(200).json({
    message: '同期処理を停止しました',
    state: syncState
  });
};

/**
 * 同期履歴の取得
 */
const getSyncHistory = (req, res) => {
  logger.info(`ユーザー ${req.user.id} が同期履歴を要求しました`);
  
  const { limit = 10, offset = 0 } = req.query;
  const limitNum = parseInt(limit, 10);
  const offsetNum = parseInt(offset, 10);
  
  const paginatedHistory = syncHistory.slice(offsetNum, offsetNum + limitNum);
  
  res.status(200).json({
    total: syncHistory.length,
    offset: offsetNum,
    limit: limitNum,
    history: paginatedHistory
  });
};

/**
 * 競合リストの取得
 */
const getConflicts = (req, res) => {
  logger.info(`ユーザー ${req.user.id} が競合リストを要求しました`);
  
  const { resolved = 'false' } = req.query;
  const showResolved = resolved === 'true';
  
  // 解決済みかどうかでフィルタリング
  const filteredConflicts = conflicts.filter(conflict => conflict.resolved === showResolved);
  
  res.status(200).json({
    total: filteredConflicts.length,
    conflicts: filteredConflicts
  });
};

/**
 * 競合の解決
 */
const resolveConflict = (req, res) => {
  const { conflictId, resolution } = req.body;
  
  logger.info(`ユーザー ${req.user.id} が競合 ${conflictId} を解決しようとしています。解決方法: ${resolution}`);
  
  if (!conflictId || !resolution) {
    return res.status(400).json({ error: '競合IDと解決方法が必要です' });
  }
  
  // 競合の検索
  const conflictIndex = conflicts.findIndex(conflict => conflict.id === conflictId);
  
  if (conflictIndex === -1) {
    return res.status(404).json({ error: '指定された競合が見つかりません' });
  }
  
  // 競合の解決
  conflicts[conflictIndex].resolved = true;
  conflicts[conflictIndex].resolution = resolution;
  conflicts[conflictIndex].resolvedBy = req.user.id;
  conflicts[conflictIndex].resolvedAt = new Date();
  
  res.status(200).json({
    message: '競合を解決しました',
    conflict: conflicts[conflictIndex]
  });
};

/**
 * ユニークIDの生成
 * @returns {string} ユニークID
 */
const generateId = () => {
  return Math.random().toString(36).substring(2, 15) +
         Math.random().toString(36).substring(2, 15);
};

module.exports = {
  getStatus,
  startSync,
  stopSync,
  getSyncHistory,
  getConflicts,
  resolveConflict
};
