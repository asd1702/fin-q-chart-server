import config from './config';
import http from 'http';
import { createApp } from './app';
import { initWebSocketServer } from './services/websocket.service';
import { connectToTwelveData } from './services/twelvedata.service';

const port = config.port;

const app = createApp();

const httpServer = http.createServer(app);

initWebSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  connectToTwelveData();
})
