const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

io.on('connection', (socket) => {
    console.log('Игрок вошел в CraftWars:', socket.id);
    socket.on('disconnect', () => console.log('Игрок вышел'));
});

http.listen(3000, () => console.log('Сервер CraftWars запущен на http://localhost:3000'));
