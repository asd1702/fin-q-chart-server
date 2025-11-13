import config from './config/index';
import http from 'http';
import { createApp } from './app';
import { initWebSocketServer } from './services/websocket.service';
import { connectToTwelveData } from './services/twelvedata.service';
import { syncMissingData } from './services/sync.service';

const port = config.port;

const app = createApp();

const httpServer = http.createServer(app);

initWebSocketServer(httpServer);

httpServer.listen(port, async () => {
  console.log(`Server is running at http://localhost:${port}`);
  try{
    await syncMissingData();
  } catch(err) {
    console.error('데이터 동기화 중 에러 발생:', err);
  }
  connectToTwelveData();
})
