const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

app.use(express.static('public'));

let players = {};

io.on('connection', (socket) => {
    players[socket.id] = { 
        x: 400, y: 300, 
        wood: 0, stone: 0, 
        inventory: { axe: false, pickaxe: false } 
    };

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
        }
    });

    socket.on('gather', (type) => {
        if (players[socket.id]) {
            if (type === 'tree') players[socket.id].wood += 1;
            if (type === 'rock') players[socket.id].stone += 1;
        }
    });

    socket.on('disconnect', () => delete players[socket.id]);
});

setInterval(() => io.emit('state', players), 16);
http.listen(3000, () => console.log('Сервер запущен на порту 3000'));
