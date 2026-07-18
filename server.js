const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, './')));

const MAP_SIZE = 3000; // Размер карты 3000x3000px
const players = {};
const gameObjects = [];

// Спавним стартовые деревья и камни на карте
function spawnResources() {
    for (let i = 0; i < 60; i++) {
        gameObjects.push({
            id: 'tree_' + i,
            type: 'tree',
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            radius: 40
        });
    }
    for (let i = 0; i < 40; i++) {
        gameObjects.push({
            id: 'stone_' + i,
            type: 'stone',
            x: Math.random() * MAP_SIZE,
            y: Math.random() * MAP_SIZE,
            radius: 35
        });
    }
}
spawnResources();

const CRAFT_RECIPES = {
    wood_wall: { wood: 10, stone: 0, gold: 0 },
    stone_wall: { wood: 0, stone: 15, gold: 0 },
    spike: { wood: 10, stone: 5, gold: 0 }
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
            resources: { wood: 0, stone: 0, gold: 0 },
            hotbar: { 1: "tool_axe", 2: "tool_pick", 3: "empty", 4: "empty", 5: "empty" }
        };
        // Отправляем игроку начальное состояние мира
        socket.emit('init', { id: socket.id, mapSize: MAP_SIZE, objects: gameObjects });
    });

    // Получаем вектор движения и угол поворота от клиента
    socket.on('player_input', (data) => {
        const player = players[socket.id];
        if (!player) return;

        player.angle = data.angle;

        // Движение с ограничением по границам карты
        const speed = 4;
        if (data.move.x !== 0 || data.move.y !== 0) {
            // Нормализация вектора
            const length = Math.sqrt(data.move.x * data.move.x + data.move.y * data.move.y);
            player.x += (data.move.x / length) * speed;
            player.y += (data.move.y / length) * speed;

            player.x = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.y));
        }
    });

    // Обработка удара (клик мыши или пробел)
    socket.on('player_strike', () => {
        const player = players[socket.id];
        if (!player) return;

        // Вычисляем точку удара перед лицом игрока
        const strikeX = player.x + Math.cos(player.angle) * 45;
        const strikeY = player.y + Math.sin(player.angle) * 45;

        // Проверяем попадание по объектам на карте
        for (let obj of gameObjects) {
            const dist = Math.hypot(strikeX - obj.x, strikeY - obj.y);
            if (dist <= obj.radius + 15) {
                // Если бьем топором по дереву или киркой по камню
                if (obj.type === 'tree' && player.activeSlot === 1) {
                    player.resources.wood += 5;
                } else if (obj.type === 'stone' && player.activeSlot === 2) {
                    player.resources.stone += 5;
                } else {
                    // Кулаком или не тем инструментом получаем меньше
                    if (obj.type === 'tree') player.resources.wood += 1;
                    if (obj.type === 'stone') player.resources.stone += 1;
                }
                
                // Модифицируем объект (визуальный эффект удара)
                io.emit('resource_hit', { id: obj.id, x: obj.x, y: obj.y });
                socket.emit('update_resources', player.resources);
                break;
            }
        }
    });

    socket.on('select_slot', (slotNumber) => {
        const player = players[socket.id];
        if (player && slotNumber >= 1 && slotNumber <= 5) {
            player.activeSlot = Number(slotNumber);
            socket.emit('slot_changed', { success: true, activeSlot: player.activeSlot });
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

            socket.emit('craft_response', { 
                success: true, 
                resources: player.resources,
                hotbar: player.hotbar,
                message: `Скрафчено: ${itemName}!`
            });
        } else {
            socket.emit('craft_response', { success: false, message: "Не хватает ресурсов!" });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// Игровой тик: отправляем координаты всем игрокам 60 раз в секунду
setInterval(() => {
    io.emit('game_update', { players: players });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));
