const io = require('socket.io-client');

const socket = io('http://localhost:5000');

socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
  socket.emit('join', '6819908f237d7926a795d3f9');
});

socket.on('notification', (data) => {
  console.log('Received notification:', data.message);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});