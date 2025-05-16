// ロガーユーティリティ
const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

let logger;

/**
 * ロガーの設定
 * @returns {winston.Logger} 設定済みのロガーインスタンス
 */
const setupLogger = () => {
  // ロギング設定の読み込み
  let config;
  try {
    const configPath = path.join(__dirname, '../../config/logging.json');
    if (fs.existsSync(configPath)) {
      config = require(configPath);
    } else {
      config = {
        level: 'info',
        format: 'json',
        logDir: path.join(__dirname, '../../logs'),
        maxSize: '10m',
        maxFiles: '7d',
        compress: true
      };
    }
  } catch (error) {
    console.error(`ロギング設定の読み込みに失敗しました: ${error.message}`);
    config = {
      level: 'info',
      format: 'json',
      logDir: path.join(__dirname, '../../logs'),
      maxSize: '10m',
      maxFiles: '7d',
      compress: true
    };
  }
  
  // ログディレクトリの作成
  fs.ensureDirSync(config.logDir);
  
  // フォーマッターの設定
  const formats = [
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true })
  ];
  
  if (config.format === 'json') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.printf(info => {
        return `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`;
      })
    );
  }
  
  // ロガーの作成
  logger = winston.createLogger({
    level: config.level,
    format: winston.format.combine(...formats),
    defaultMeta: { service: 'remote-mcp-server' },
    transports: [
      // コンソール出力
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.printf(info => {
            return `${info.timestamp} ${info.level}: ${info.message}${info.stack ? `\n${info.stack}` : ''}`;
          })
        )
      }),
      
      // ファイル出力（日次ローテーション）
      new winston.transports.File({
        filename: path.join(config.logDir, 'error.log'),
        level: 'error'
      }),
      new winston.transports.File({
        filename: path.join(config.logDir, 'combined.log')
      })
    ]
  });
  
  return logger;
};

/**
 * 設定済みのロガーインスタンスを取得
 * @returns {winston.Logger} ロガーインスタンス
 */
const getLogger = () => {
  if (!logger) {
    return setupLogger();
  }
  return logger;
};

module.exports = {
  setupLogger,
  getLogger
};
