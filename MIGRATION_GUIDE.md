# n8nからRender.com直接実装への移行ガイド

## 移行理由
- ライセンス問題の完全解決
- 運用保守の簡素化
- デプロイ速度の向上

## 機能の対応関係

### N8n実装 → 直接実装
| N8n ワークフロー | 直接実装 |
|-----------------|----------|
| SSE Webhook Trigger | Express POST エンドポイント |
| JSON Parser | req.body 直接解析 |
| Tool Dispatcher | switch 文による分岐 |
| Response Formatter | JSON.stringify + SSE |

## 設計仕様の継承

### 1. 既存の仕様維持
- 同一エンドポイントURL
- 同一レスポンス形式
- 同一ツール定義

### 2. Custom Integrations互換性
- URL変更のみで対応
- 既存設定の継続利用

## 実装の簡素化

### Before (N8n) - 約200行のJSON
```json
{
  "name": "Remote MCP Server",
  "nodes": [
    // 7個のノード定義
  ],
  "connections": {
    // 複雑な接続定義
  }
}
```

### After (Node.js) - 約150行のJavaScript
```javascript
// シンプルなExpress実装
app.post('/webhook/*', (req, res) => {
  // 直接的な処理
});
```

## 新規実装の利点

### 1. 開発速度
- コード直接編集
- 即時テスト可能
- デバッグ容易

### 2. 運用効率
- 単一プロセス
- リソース効率向上
- ログ管理簡素化

### 3. 拡張性
- 新機能追加容易
- カスタマイズ自由度

## 移行手順

### 1. 新サービス作成
```bash
cd /Users/hashizaka/mcp-local/render-mcp-server
npm install
```

### 2. ローカルテスト
```bash
npm run dev
npm test
```

### 3. Render.comデプロイ
- 新規Webサービス作成
- GitHub連携設定
- 自動デプロイ有効化

### 4. Custom Integrations更新
- URL更新: 新デプロイURLへ変更
- 動作確認実施

## 機能完全性

### 実装済み機能
- ツール一覧取得
- 現在時刻取得
- エラーハンドリング
- ヘルスチェック

### 将来実装予定
- ドキュメント操作
- ユーザー認証
- レート制限

## トラブルシューティング

### 接続エラー
1. URLの正確性確認
2. CORS設定確認
3. ヘルスチェック実行

### レスポンスエラー
1. ログ確認
2. テストスクリプト実行
3. リクエスト形式確認

---

移行により、実装・運用共に大幅簡素化。
