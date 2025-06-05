import express from 'express';
import { createServer } from 'http';
import GameServer from './websocket';

const app = express();
const server = createServer(app);
const gameServer = new GameServer(server);

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 