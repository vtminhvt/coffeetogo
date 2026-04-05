const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST'],
  },
});

// Make io available to route handlers via req.app.locals.io
app.locals.io = io;

io.on('connection', (socket) => {
  // Clients join rooms to receive targeted updates:
  //   'order:<id>'  — customer / delivery person tracking a specific order
  //   'shop:<id>'   — shop owner monitoring incoming orders
  socket.on('join:order', (orderId) => socket.join(`order:${orderId}`));
  socket.on('join:shop', (shopId) => socket.join(`shop:${shopId}`));
  socket.on('leave:order', (orderId) => socket.leave(`order:${orderId}`));
  socket.on('leave:shop', (shopId) => socket.leave(`shop:${shopId}`));
});

server.listen(PORT, () => {
  console.log(`CoffeeToGo API running on port ${PORT}`);
});

