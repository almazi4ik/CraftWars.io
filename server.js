const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, './')));

// КАРТА УВЕЛИЧЕНА В 3 РАЗА (9000х9000)
const MAP_SIZE = 9000;
const gameObjects = [];
const players = {};

// База рецептов крафта инструментов и блоков
const CRAFT_RECIPES = {
    axe: { wood: 20, stone: 10, gold: 0 },
    pickaxe: { wood: 20, stone: 15, gold: 0 },
    sword: { wood: 30, stone: 20, gold: 5 },
    wood_wall: { wood: 10, stone: 0, gold: 0 },
    stone_wall: { wood: 0, stone: 15, gold: 0 },
    spike: { wood: 10, stone: 5, gold: 0 },
    door: { wood: 20, stone: 0, gold: 0 }
};

// Функция проверки расстояния, чтобы объекты не спавнились друг в друге
function isTooCloseToOthers(x, y, radius) {
    for (let obj of gameObjects) {
        const dx = obj.x - x;
        const dy = obj.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < (obj.radius + radius + 40)) { // 40px запас между объектами
            return true;
        }
    }
    return false;
}

// Генерация ресурсов с учетом биомов и проверки пересечений
function generateResources() {
    const totalObjects = 600; // Увеличили количество под большую карту
    let attempts = 0;

    while (gameObjects.length < totalObjects && attempts < 2000) {
        attempts++;
        const x = Math.random() * MAP_SIZE;
        const y = Math.random() * MAP_SIZE;
        const radius = 30 + Math.random() * 20;
        let type = 'tree';

        // Определяем биом для ресурса
        if (y < MAP_SIZE * 0.3) {
            // Зимний биом (Сверху) -> Камни чаще
            type = Math.random() > 0.4 ? 'stone' : 'tree';
        } else if (x > MAP_SIZE * 0.7 && y > MAP_SIZE * 0.7) {
            // Песчаный биом (Справа снизу) -> Золото/Камни
            type = Math.random() > 0.5 ? 'stone' : 'tree';
        } else {
            // Обычный биом (Центр) -> Деревья чаще
            type = Math.random() > 0.3 ? 'tree' : 'stone';
        }

        if (!isTooCloseToOthers(x, y, radius)) {
            gameObjects.push({ id: gameObjects.length, x, y, radius, type });
        }
    }
}
generateResources();

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // Спавним игрока в центре (в обычном биоме)
    players[socket.id] = {
        id: socket.id,
        x: MAP_SIZE / 2,
        y: MAP_SIZE / 2,
        radius: 25,
        angle: 0,
        name: "Player",
        activeSlot: 1,
        activeItem: "empty", // Появляется БЕЗ НИЧЕГО в руках
        resources: { wood: 30, stone: 20, gold: 10 }, // Даем стартовые ресурсы, чтоб скрафтить первый инструмент
        hotbar: { 1: "empty", 2: "empty", 3: "empty", 4: "empty", 5: "empty" } // Слоты ПУСТЫЕ
    };

    socket.emit('init', { id: socket.id, mapSize: MAP_SIZE, objects: gameObjects });

    socket.on('player_join', (data) => {
        if (players[socket.id]) players[socket.id].name = data.name || "Player";
    });

    socket.on('select_slot', (slotNumber) => {
        const player = players[socket.id];
        if (!player) return;
        if (slotNumber >= 1 && slotNumber <= 5) {
            player.activeSlot = Number(slotNumber);
            player.activeItem = player.hotbar[slotNumber] || "empty";
            socket.emit('slot_changed', { success: true, activeSlot: player.activeSlot, activeItem: player.activeItem });
        }
    });

    socket.on('craft_request', (itemName) => {
        const player = players[socket.id];
        if (!player) return;

        const recipe = CRAFT_RECIPES[itemName];
        if (!recipe) return;

        if (player.resources.wood >= recipe.wood && 
            player.resources.stone >= recipe.stone && 
            player.resources.gold >= recipe.gold) {
            
            player.resources.wood -= recipe.wood;
            player.resources.stone -= recipe.stone;
            player.resources.gold -= recipe.gold;

            // Ищем первый пустой слот хотбара, чтобы положить скрафченную вещь
            let placedSlot = null;
            for (let i = 1; i <= 5; i++) {
                if (player.hotbar[i] === 'empty') {
                    player.hotbar[i] = itemName;
                    placedSlot = i;
                    break;
                }
            }

            // Если пустых слотов не было, перезаписываем текущий активный
            if (!placedSlot) {
                player.hotbar[player.activeSlot] = itemName;
            }

            player.activeItem = player.hotbar[player.activeSlot];

            socket.emit('craft_response', { 
                success: true, 
                resources: player.resources,
                hotbar: player.hotbar,
                activeItem: player.activeItem,
                message: `Crafted: ${itemName}!`
            });
        } else {
            socket.emit('craft_response', { success: false, message: "Not enough resources!" });
        }
    });

    socket.on('player_input', (data) => {
        const player = players[socket.id];
        if (!player) return;
        if (data.move) {
            player.x += data.move.x * 4;
            player.y += data.move.y * 4;
            // Ограничение карты
            player.x = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(MAP_SIZE - player.radius, player.y));
        }
        player.angle = data.angle || 0;
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

setInterval(() => {
    io.emit('game_update', { players });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
