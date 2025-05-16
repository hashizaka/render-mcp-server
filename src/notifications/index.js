// 通知モジュール
const fs = require('fs-extra');
const path = require('path');
const nodemailer = require('nodemailer');
const axios = require('axios');
const logger = require('../utils/logger').getLogger();

// 設定ファイルのロード
let config;
try {
  const configPath = path.join(__dirname, '../../config/notifications.json');
  if (fs.existsSync(configPath)) {
    config = require(configPath);
  } else {
    config = {
      email: { enabled: false },
      slack: { enabled: false },
      events: {}
    };
    logger.warn('通知設定ファイルが見つかりません。デフォルト設定を使用します。');
  }
} catch (error) {
  logger.error(`通知設定のロード中にエラーが発生しました: ${error.message}`);
  config = {
    email: { enabled: false },
    slack: { enabled: false },
    events: {}
  };
}

/**
 * メール通知の送信
 * @param {string} recipient - 受信者メールアドレス
 * @param {string} subject - メール件名
 * @param {string} message - メール本文
 * @returns {Promise<void>}
 */
const sendEmailNotification = async (recipient, subject, message) => {
  if (!config.email.enabled) {
    logger.debug('メール通知が無効化されています');
    return;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: config.email.smtpHost,
      port: config.email.smtpPort,
      secure: config.email.secure,
      auth: {
        user: config.email.auth.user,
        pass: config.email.auth.pass
      }
    });
    
    const mailOptions = {
      from: config.email.from,
      to: recipient,
      subject: `[リモートMCPサーバー] ${subject}`,
      text: message,
      html: `<p>${message.replace(/\n/g, '<br>')}</p>`
    };
    
    await transporter.sendMail(mailOptions);
    logger.info(`メール通知を送信しました: ${recipient}`);
  } catch (error) {
    logger.error(`メール通知の送信に失敗しました: ${error.message}`);
    throw new Error(`メール通知の送信に失敗しました: ${error.message}`);
  }
};

/**
 * Slack通知の送信
 * @param {string} message - 通知メッセージ
 * @returns {Promise<void>}
 */
const sendSlackNotification = async (message) => {
  if (!config.slack.enabled) {
    logger.debug('Slack通知が無効化されています');
    return;
  }
  
  try {
    await axios.post(config.slack.webhookUrl, {
      channel: config.slack.channel,
      text: message
    });
    logger.info('Slack通知を送信しました');
  } catch (error) {
    logger.error(`Slack通知の送信に失敗しました: ${error.message}`);
    throw new Error(`Slack通知の送信に失敗しました: ${error.message}`);
  }
};

/**
 * イベント通知の送信
 * @param {string} eventType - イベントタイプ
 * @param {Object} data - イベントデータ
 * @returns {Promise<void>}
 */
const notify = async (eventType, data = {}) => {
  // イベント設定の取得
  const eventConfig = config.events[eventType];
  
  if (!eventConfig) {
    logger.debug(`イベントタイプ ${eventType} の通知設定が見つかりません`);
    return;
  }
  
  const timestamp = new Date().toISOString();
  const message = formatMessage(eventType, data, timestamp);
  
  const promises = [];
  
  // メール通知の送信
  if (eventConfig.email) {
    const recipient = process.env.ADMIN_EMAIL || 'admin@example.com';
    promises.push(sendEmailNotification(recipient, `${eventType} イベント`, message));
  }
  
  // Slack通知の送信
  if (eventConfig.slack) {
    promises.push(sendSlackNotification(message));
  }
  
  try {
    await Promise.all(promises);
    logger.debug(`イベント ${eventType} の通知を送信しました`);
  } catch (error) {
    logger.error(`イベント ${eventType} の通知送信中にエラーが発生しました: ${error.message}`);
  }
};

/**
 * サーバー起動通知の送信
 * @returns {Promise<void>}
 */
const notifyServerStart = async () => {
  const data = {
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: require('../../package.json').version
  };
  
  return notify('serverStart', data);
};

/**
 * メッセージのフォーマット
 * @param {string} eventType - イベントタイプ
 * @param {Object} data - イベントデータ
 * @param {string} timestamp - タイムスタンプ
 * @returns {string} フォーマットされたメッセージ
 */
const formatMessage = (eventType, data, timestamp) => {
  let message = `[${timestamp}] ${eventType.toUpperCase()}\n`;
  
  switch (eventType) {
    case 'serverStart':
      message += `サーバーが起動しました。\n`;
      message += `環境: ${data.environment}\n`;
      message += `バージョン: ${data.version}\n`;
      message += `起動時刻: ${data.time}`;
      break;
    
    case 'serverStop':
      message += `サーバーが停止しました。\n`;
      message += `環境: ${data.environment}\n`;
      message += `バージョン: ${data.version}\n`;
      message += `停止時刻: ${data.time}`;
      break;
    
    case 'syncCompleted':
      message += `同期が完了しました。\n`;
      message += `ユーザー: ${data.userId}\n`;
      message += `追加ファイル: ${data.result.stats.filesAdded}\n`;
      message += `更新ファイル: ${data.result.stats.filesUpdated}\n`;
      message += `削除ファイル: ${data.result.stats.filesDeleted}\n`;
      message += `競合: ${data.result.stats.conflicts}`;
      break;
    
    case 'syncFailed':
      message += `同期に失敗しました。\n`;
      message += `ユーザー: ${data.userId}\n`;
      message += `エラー: ${data.error}`;
      break;
    
    case 'authFailure':
      message += `認証に失敗しました。\n`;
      message += `IP: ${data.ip}\n`;
      message += `試行回数: ${data.attempts}`;
      break;
    
    default:
      message += JSON.stringify(data, null, 2);
  }
  
  return message;
};

module.exports = {
  notify,
  notifyServerStart
};
