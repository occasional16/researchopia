// 简单的WebSocket模拟服务器
// 在开发环境中提供基础的协作功能演示

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('🚀 Researchopia WebSocket服务器启动 - 端口 8080');

// 存储连接的客户端
const clients = new Map();
const rooms = new Map();

wss.on('connection', function connection(ws) {
  console.log('✅ 新客户端连接');
  
  ws.on('message', function message(data) {
    try {
      const msg = JSON.parse(data.toString());
      console.log('📨 收到消息:', msg.type);
      
      switch (msg.type) {
        case 'join':
          // 加入房间
          const { documentId, userId, userName } = msg.payload;
          
          clients.set(ws, { userId, userName, documentId });
          
          if (!rooms.has(documentId)) {
            rooms.set(documentId, new Set());
          }
          rooms.get(documentId).add(ws);
          
          // 通知房间内其他用户
          broadcast(documentId, {
            type: 'userJoined',
            payload: {
              userId,
              userName,
              timestamp: Date.now()
            }
          }, ws);
          
          // 发送当前在线用户列表
          const roomUsers = Array.from(rooms.get(documentId) || [])
            .map(client => clients.get(client))
            .filter(Boolean);
            
          ws.send(JSON.stringify({
            type: 'usersUpdate',
            payload: { users: roomUsers }
          }));
          break;
          
        case 'annotationCreate':
        case 'annotationUpdate':
        case 'annotationDelete':
          // 广播标注操作
          const clientInfo = clients.get(ws);
          if (clientInfo) {
            broadcast(clientInfo.documentId, {
              type: 'operation',
              payload: msg.payload
            }, ws);
          }
          break;
          
        case 'cursor':
          // 广播鼠标位置
          const cursorClient = clients.get(ws);
          if (cursorClient) {
            broadcast(cursorClient.documentId, {
              type: 'cursor',
              payload: msg.payload
            }, ws);
          }
          break;
      }
      
    } catch (error) {
      console.error('❌ 消息处理错误:', error);
    }
  });
  
  ws.on('close', function close() {
    const clientInfo = clients.get(ws);
    if (clientInfo) {
      console.log(`👋 用户 ${clientInfo.userName} 断开连接`);
      
      // 从房间中移除
      const room = rooms.get(clientInfo.documentId);
      if (room) {
        room.delete(ws);
        
        // 通知其他用户
        broadcast(clientInfo.documentId, {
          type: 'userLeft',
          payload: {
            userId: clientInfo.userId,
            userName: clientInfo.userName,
            timestamp: Date.now()
          }
        });
        
        // 如果房间空了，清理房间
        if (room.size === 0) {
          rooms.delete(clientInfo.documentId);
        }
      }
      
      clients.delete(ws);
    }
  });
  
  ws.on('error', function error(err) {
    console.error('❌ WebSocket错误:', err);
  });
});

// 广播消息到房间内所有客户端（除了发送者）
function broadcast(documentId, message, sender = null) {
  const room = rooms.get(documentId);
  if (!room) return;
  
  const messageStr = JSON.stringify(message);
  
  room.forEach(client => {
    if (client !== sender && client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
}

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭WebSocket服务器...');
  wss.close(() => {
    console.log('✅ WebSocket服务器已关闭');
    process.exit(0);
  });
});

console.log(`
🌟 Researchopia WebSocket协作服务器已启动
📡 监听端口: 8080
🔗 连接地址: ws://localhost:8080

功能支持:
- ✅ 多用户房间管理
- ✅ 实时标注同步
- ✅ 用户状态跟踪
- ✅ 鼠标位置广播
`);