const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  query: { userId: '6819908f237d7926a795d3f9' }
});

socket.on('connect', () => {
  console.log('Connected to server:', socket.id);
  socket.emit('join', '6819908f237d7926a795d3f9');
});

socket.on('notification', (data) => {
  console.log('Received notification:', {
    type: data.type,
    message: data.message,
    relatedId: data.relatedId,
    isRead: data.isRead,
    createdAt: data.createdAt,
  });
});

// Add listeners for other potential notification types (if implemented later)
socket.on('newPost', (data) => {
  console.log('Received newPost notification:', data);
});

socket.on('newJob', (data) => {
  console.log('Received newJob notification:', data);
});

socket.on('applicationUpdate', (data) => {
  console.log('Received applicationUpdate notification:', data);
});

socket.on('postInteraction', (data) => {
  console.log('Received postInteraction notification:', data);
});

socket.on('connectionRequest', (data) => {
  console.log('Received connectionRequest notification:', data);
});

socket.on('disconnect', () => {
  console.log('Disconnected from server');
});

socket.on('error', (error) => {
  console.error('Socket error:', error);
});

// Simulate a message send to trigger a notification (optional, if you want to test manually)
setTimeout(() => {
  console.log('Simulating message send to trigger notification...');
}, 2000);