const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаем статические файлы из папки public
app.use(express.static('public'));

// Хранилище игроков
const players = {};

io.on('connection', (socket) => {
    console.log('Игрок подключился:', socket.id);

    // Создаем нового игрока со случайным цветом и позицией
    players[socket.id] = {
        x: Math.floor(Math.random() * 700) + 50,
        y: Math.floor(Math.random() * 500) + 50,
        color: `hsl(${Math.random() * 360}, 100%, 50%)`,
        radius: 20
    };

    // Отправляем новому игроку данные обо всех текущих игроках
    socket.emit('currentPlayers', players);

    // Уведомляем остальных о новом игроке
    socket.broadcast.emit('newPlayer', { id: socket.id, player: players[socket.id] });

    // Обработка движения
    socket.on('movement', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            // Отправляем новые координаты всем остальным
            socket.broadcast.emit('playerMoved', { id: socket.id, x: data.x, y: data.y });
        }
    });

    // Обработка отключения
    socket.on('disconnect', () => {
        console.log('Игрок отключился:', socket.id);
        delete players[socket.id];
        io.emit('playerDisconnected', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер WildCraft.io запущен на http://localhost:${PORT}`);
});
