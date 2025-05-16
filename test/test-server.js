const http = require('http');
const { URL } = require('url');

// テスト設定
const TEST_URL = process.env.TEST_URL || 'http://localhost:5678';
const MCP_ENDPOINT = '/webhook/mcp-test/c079dca3-1f7c-4d20-ae55-7023501af894/sse';

console.log('MCP Server Test Suite');
console.log('====================');
console.log(`Target: ${TEST_URL}${MCP_ENDPOINT}\n`);

async function runTest(description, request) {
  console.log(`Testing: ${description}`);
  
  const url = new URL(MCP_ENDPOINT, TEST_URL);
  const postData = JSON.stringify(request);
  
  const options = {
    hostname: url.hostname,
    port: url.port || 80,
    path: url.pathname,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      'Accept': 'text/event-stream'
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        
        if (data.startsWith('data: ')) {
          const jsonData = data.slice(6).trim();
          try {
            const parsed = JSON.parse(jsonData);
            console.log('Response:', JSON.stringify(parsed, null, 2));
            resolve(parsed);
          } catch (e) {
            console.log('Raw response:', data);
            resolve(data);
          }
        } else {
          console.log('Raw response:', data);
          resolve(data);
        }
        console.log('-------------------\n');
      });
    });
    
    req.on('error', (error) => {
      console.error('Request failed:', error.message);
      console.log('-------------------\n');
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

async function main() {
  try {
    // Test 1: Health Check
    console.log('1. Health Check');
    const healthUrl = new URL('/health', TEST_URL);
    await new Promise((resolve) => {
      http.get(healthUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          console.log('Status:', res.statusCode);
          console.log('Response:', data);
          console.log('-------------------\n');
          resolve();
        });
      });
    });
    
    // Test 2: Tools List
    await runTest('Tools List', {
      jsonrpc: '2.0',
      id: 'test-001',
      method: 'tools/list',
      params: {}
    });
    
    // Test 3: Get Current Time
    await runTest('Get Current Time (Asia/Tokyo)', {
      jsonrpc: '2.0',
      id: 'test-002',
      method: 'tools/call',
      params: {
        name: 'get_current_time',
        arguments: {
          timezone: 'Asia/Tokyo'
        }
      }
    });
    
    // Test 4: Get Current Time (UTC)
    await runTest('Get Current Time (UTC)', {
      jsonrpc: '2.0',
      id: 'test-003',
      method: 'tools/call',
      params: {
        name: 'get_current_time',
        arguments: {
          timezone: 'UTC'
        }
      }
    });
    
    // Test 5: Invalid Tool
    await runTest('Invalid Tool Call', {
      jsonrpc: '2.0',
      id: 'test-004',
      method: 'tools/call',
      params: {
        name: 'non_existent_tool',
        arguments: {}
      }
    });
    
    console.log('All tests completed!');
    
  } catch (error) {
    console.error('Test suite failed:', error);
    process.exit(1);
  }
}

// 引数に基づく実行
if (require.main === module) {
  main();
}

module.exports = { runTest };
