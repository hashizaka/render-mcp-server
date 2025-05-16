const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5678;

// CORS設定
app.use(cors({
  origin: [
    'https://claude.ai',
    'https://api.anthropic.com',
    'http://localhost:3000'
  ],
  credentials: true
}));

app.use(express.json());

// SSEヘルパー
function setupSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
  });
}

// ツール定義
const tools = [
  {
    name: 'get_current_time',
    description: '現在時刻を取得する',
    input_schema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: 'タイムゾーン識別子',
          default: 'Asia/Tokyo'
        }
      }
    }
  },
  {
    name: 'read_document',
    description: 'ドキュメントを読み込む',
    input_schema: {
      type: 'object',
      properties: {
        doc_id: {
          type: 'string',
          description: 'ドキュメント識別子'
        }
      },
      required: ['doc_id']
    }
  }
];

// ツール実行関数
const toolExecutors = {
  get_current_time: (args) => {
    const timezone = args.timezone || 'Asia/Tokyo';
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ja-JP', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });
    
    return {
      content: [{
        type: 'text',
        text: `現在時刻: ${formatter.format(now)}`
      }]
    };
  },
  
  read_document: (args) => {
    // 実装予定
    return {
      content: [{
        type: 'text',
        text: `ドキュメント "${args.doc_id}" の読み込み機能は開発中です。`
      }]
    };
  }
};

// MCPエンドポイント
app.post('/webhook/mcp-test/c079dca3-1f7c-4d20-ae55-7023501af894/sse', async (req, res) => {
  setupSSE(res);
  
  const { method, params, id } = req.body;
  let response;
  
  try {
    switch (method) {
      case 'tools/list':
        response = {
          jsonrpc: '2.0',
          id: id,
          result: {
            tools: tools
          }
        };
        break;
        
      case 'tools/call':
        const toolName = params.name;
        const toolArgs = params.arguments || {};
        
        if (toolExecutors[toolName]) {
          const result = toolExecutors[toolName](toolArgs);
          response = {
            jsonrpc: '2.0',
            id: id,
            result: result
          };
        } else {
          response = {
            jsonrpc: '2.0',
            id: id,
            error: {
              code: -32601,
              message: `Method not found: ${toolName}`
            }
          };
        }
        break;
        
      default:
        response = {
          jsonrpc: '2.0',
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
    
    res.write(`data: ${JSON.stringify(response)}\n\n`);
  } catch (error) {
    response = {
      jsonrpc: '2.0',
      id: id,
      error: {
        code: -32000,
        message: error.message,
        data: {
          timestamp: new Date().toISOString()
        }
      }
    };
    res.write(`data: ${JSON.stringify(response)}\n\n`);
  }
  
  res.end();
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// 基本情報
app.get('/', (req, res) => {
  res.json({
    name: 'Remote MCP Server',
    version: '1.0.0',
    endpoints: {
      mcp: '/webhook/mcp-test/c079dca3-1f7c-4d20-ae55-7023501af894/sse',
      health: '/health'
    }
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});

module.exports = app;
