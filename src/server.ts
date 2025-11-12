import config from './config/index.js';
import http from 'http';
import { createApp } from './app.js';
import { initWebSocketServer } from './services/websocket.service.js';
import { connectToTwelveData } from './services/twelvedata.service.js';

const port = config.port;

const app = createApp();

const httpServer = http.createServer(app);

initWebSocketServer(httpServer);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
  connectToTwelveData();
})