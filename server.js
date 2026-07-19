const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static(__dirname));

const players = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);
    
    // Спавним игрока
    players[socket.id] = {
        x: 0,
        y: 0,
        id: socket.id
    };

    // Отправляем игроку его личный ID, чтобы клиент знал, за кем следить камерой
    socket.emit('init', socket.id);

    // Получаем нажатия клавиш
    socket.on('move', (data) => {
        if (players[socket.id]) {
            // Двигаем плавно, без привязки к жесткой сетке
            players[socket.id].x += data.dx * 7;
            players[socket.id].y += data.dy * 7;
        }
    });

    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
    });
});

// Отправляем координаты ВСЕХ игроков 10 раз в секунду (10 TPS)
setInterval(() => {
    io.emit('gameState', players);
}, 1000 / 10);

http.listen(3000, () => {
    console.log('Сервер WildCraft.io запущен на порту 3000');
});
