const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Разрешаем сокетам принимать соединения из внешнего мира (твоего GitHub Pages)
const io = new Server(server, {
    cors: {
        origin: "*", 
        methods: ["GET", "POST"]
    }
});

const MAP_SIZE = 3000;
const players = {};
const gameObjects = [];

function spawnResources() {
    for (let i = 0; i < 60; i++) gameObjects.push({ id: 'tree_' + i, type: 'tree', x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, radius: 40 });
    for (let i = 0; i < 40; i++) gameObjects.push({ id: 'stone_' + i, type: 'stone', x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, radius: 35 });
}
spawnResources();

const CRAFT_RECIPES = {
    wood_wall: { wood: 10, stone: 0 },
    stone_wall: { wood: 0, stone: 15 },
    spike: { wood: 10, stone: 5 }
};

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);

    socket.on('player_join', (data) => {
        players[socket.id] = {
            id: socket.id,
            name: data.name || 'Игрок',
            x: Math.random() * (MAP_SIZE - 200) + 100,
            y: Math.random() * (MAP_SIZE - 200) + 100,
            angle: 0,
            radius: 30,
            activeSlot: 1,
            resources: { wood: 30, stone: 30 }, // Даем немного ресурсов для теста
            hotbar: { 1: "tool_axe", 2: "tool_pick", 3: "empty", 4: "empty", 5: "empty" }
        };
        socket.emit('init', { id: socket.id, mapSize: MAP_SIZE, objects: gameObjects });
        socket.emit('update_resources', players[socket.id].resources);
    });

    socket.on('player_input', (data) => {
        const player = players[socket.id];
        if (!player) return;
        player.angle = data.angle;
        const speed = 4;
        if (data.move.x !== 0 || data.move.y !== 0) {
            const length = Math.sqrt(data.move.x * data.move.x + data.move.y * data.move.y);
            player.x += (data.move.x / length) * speed;
            player.y += (data.move.y / length) * speed;
            player.x = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.y));
        }
    });

    socket.on('player_strike', () => {
        const player = players[socket.id];
        if (!player) return;
        const strikeX = player.x + Math.cos(player.angle) * 45;
        const strikeY = player.y + Math.sin(player.angle) * 45;

        for (let obj of gameObjects) {
            if (Math.hypot(strikeX - obj.x, strikeY - obj.y) <= obj.radius + 15) {
                if (obj.type === 'tree') player.resources.wood += (player.activeSlot === 1 ? 5 : 1);
                if (obj.type === 'stone') player.resources.stone += (player.activeSlot === 2 ? 5 : 1);
                socket.emit('update_resources', player.resources);
                break;
            }
        }
    });

    socket.on('select_slot', (slotNumber) => {
        if (players[socket.id] && slotNumber >= 1 && slotNumber <= 5) {
            players[socket.id].activeSlot = Number(slotNumber);
            socket.emit('slot_changed', { success: true, activeSlot: slotNumber });
        }
    });

    socket.on('craft_request', (itemName) => {
        const player = players[socket.id];
        if (!player) return;
        const recipe = CRAFT_RECIPES[itemName];
        if (!recipe) return;

        if (player.resources.wood >= recipe.wood && player.resources.stone >= recipe.stone) {
            player.resources.wood -= recipe.wood;
            player.resources.stone -= recipe.stone;
            if (itemName === 'wood_wall') player.hotbar[3] = 'wood_wall';
            if (itemName === 'stone_wall') player.hotbar[3] = 'stone_wall';
            if (itemName === 'spike') player.hotbar[4] = 'spike';
            socket.emit('craft_response', { success: true, resources: player.resources, hotbar: player.hotbar });
        } else {
            socket.emit('craft_response', { success: false, message: "Не хватает ресурсов!" });
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

setInterval(() => { io.emit('game_update', { players: players }); }, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер запущен`));
