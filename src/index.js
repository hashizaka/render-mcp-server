// リモートMCPサーバーのメインエントリポイント
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs-extra');
const winston = require('winston');
const passport = require('passport');

// 自作モジュールのインポート
const authRoutes = require('./auth/routes');
const apiRoutes = require('./api/routes');
const { setupPassport } = require('./auth/passport-config');
const { notifyServerStart } = require('./notifications');
const { setupLogger } = require('./utils/logger');

// ロガーのセットアップ
const logger = setupLogger();

// アプリケーションの初期化
const app = express();
const PORT = process.env.PORT || 8082;

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
app.use(passport.initialize());

// Passportの設定
setupPassport();

// ルートの設定
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// ヘルスチェックエンドポイント
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: require('../package.json').version
  });
});

// エラーハンドリングミドルウェア
app.use((err, req, res, next) => {
  logger.error(`Error: ${err.message}`);
  logger.error(err.stack);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'サーバー内部エラーが発生しました',
      status: err.status || 500
    }
  });
});

// サーバーの起動
const server = app.listen(PORT, () => {
  logger.info(`リモートMCPサーバーが起動しました。ポート: ${PORT}`);
  
  // 起動通知を送信
  notifyServerStart()
    .then(() => logger.info('サーバー起動通知が送信されました'))
    .catch(error => logger.error(`サーバー起動通知の送信に失敗しました: ${error.message}`));
});

// 終了処理
process.on('SIGTERM', () => {
  logger.info('SIGTERMシグナルを受信しました。サーバーをシャットダウンします...');
  server.close(() => {
    logger.info('サーバーが正常にシャットダウンされました');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINTシグナルを受信しました。サーバーをシャットダウンします...');
  server.close(() => {
    logger.info('サーバーが正常にシャットダウンされました');
    process.exit(0);
  });
});

// 未処理のエラーをキャッチ
process.on('uncaughtException', (error) => {
  logger.error(`未処理の例外が発生しました: ${error.message}`);
  logger.error(error.stack);
  
  // 致命的なエラーの場合は、安全にサーバーをシャットダウン
  server.close(() => {
    logger.info('サーバーが正常にシャットダウンされました');
    process.exit(1);
  });
  
  // 60秒以内にシャットダウンできない場合は強制終了
  setTimeout(() => {
    logger.error('サーバーのグレースフルシャットダウンに失敗しました。強制終了します。');
    process.exit(1);
  }, 60000);
});

module.exports = server; // テスト用にエクスポート
