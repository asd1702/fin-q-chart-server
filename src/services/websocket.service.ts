import { WebSocket, WebSocketServer } from 'ws';
import http from 'http';
import { OutboundSocketMessage } from '../types.js';

let wss: WebSocketServer | undefined;

export function initWebSocketServer(httpServer: http.Server){
    wss = new WebSocketServer({ server: httpServer, path: '/ws'});

    wss.on('connection', ws => {
    console.log('[Frontend] 클라이언트가 WebSocket으로 연결되었습니다.');
    
    ws.on('message', message => {
      console.log('수신 메시지 (무시됨):', message.toString());
    });
    ws.on('close', () => {
      console.log('[Frontend] 클라이언트 연결이 끊어졌습니다.');
    });
    ws.on('error', (err) => {
        console.error('[Frontend] WebSocket 오류:', err);
    });
  });
}

export function broadcast(message: OutboundSocketMessage){
  if (!wss) {
        console.warn('WebSocket 서버가 초기화되지 않아 브로드캐스트할 수 없습니다.');
        return;
    }

    const data = JSON.stringify(message);
  wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(data);
        }
    });
}
