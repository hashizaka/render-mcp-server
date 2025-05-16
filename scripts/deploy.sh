#!/bin/bash
# デプロイメントスクリプト
# 作成日: 2025年5月13日
# 作成者: Claude 3.7 Sonnet

set -e

# 変数設定
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DEPLOY_LOG="$PROJECT_DIR/logs/deploy_$(date +"%Y%m%d_%H%M%S").log"
BACKUP_DIR="$PROJECT_DIR/backup/predeploy_$(date +"%Y%m%d_%H%M%S")"

# ログディレクトリの作成
mkdir -p "$(dirname "$DEPLOY_LOG")"

# ログ出力関数
log() {
  echo "[$(date +"%Y-%m-%d %H:%M:%S")] $1" | tee -a "$DEPLOY_LOG"
}

# エラーハンドリング
handle_error() {
  log "エラーが発生しました。デプロイを中止します。"
  exit 1
}
trap handle_error ERR

# 開始ログ
log "デプロイメントを開始します..."

# 前回のデプロイバックアップを作成
log "現在の状態をバックアップします..."
mkdir -p "$BACKUP_DIR"
cp -r "$PROJECT_DIR/config" "$BACKUP_DIR/"
cp -r "$PROJECT_DIR/src" "$BACKUP_DIR/"
cp "$PROJECT_DIR/package.json" "$BACKUP_DIR/"
cp "$PROJECT_DIR/.env.production" "$BACKUP_DIR/" 2>/dev/null || true
log "バックアップが完了しました: $BACKUP_DIR"

# 依存関係のインストール
log "依存関係をインストールします..."
cd "$PROJECT_DIR"
npm ci
log "依存関係のインストールが完了しました。"

# 設定ファイルの適用
log "本番環境設定を適用します..."
if [ -f "$PROJECT_DIR/config/.env.production" ]; then
  cp "$PROJECT_DIR/config/.env.production" "$PROJECT_DIR/.env"
  log "本番環境設定ファイルを適用しました。"
else
  log "警告: 本番環境設定ファイル (.env.production) が見つかりません。デフォルト設定を使用します。"
fi

# ビルド（必要に応じて）
log "プロジェクトをビルドします..."
npm run build
log "ビルドが完了しました。"

# テストの実行
log "テストを実行します..."
npm test
log "テストが完了しました。"

# サービスの停止と再起動
log "サービスを再起動します..."
# 本番環境での再起動方法（PM2を想定）
if command -v pm2 &> /dev/null; then
  pm2 restart remote-mcp-server || pm2 start src/index.js --name "remote-mcp-server" --time
  log "PM2によるサービス再起動が完了しました。"
else
  log "PM2が見つかりませんでした。手動での再起動が必要です。"
  log "実行コマンド: NODE_ENV=production node src/index.js"
  NODE_ENV=production node src/index.js &
fi

# 完了ログ
log "デプロイメントが完了しました!"
