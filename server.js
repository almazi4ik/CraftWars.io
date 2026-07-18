const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

// Указываем папку для статических файлов
app.use(express.static('public'));

// ВАЖНО: Render сам назначает порт через переменную среды
const PORT = process.env.PORT || 3000;

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
    });
});

http.listen(PORT, () => {
    console.log(`Сервер CraftWars запущен на порту ${PORT}`);
});
