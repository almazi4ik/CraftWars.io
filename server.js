const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, './')));

const MAP_SIZE = 9000;
const GRID_SIZE = 50;
let gameObjects = [];
let mobs = [];
let droppedItems = [];
const players = {};

const CRAFT_RECIPES = {
    axe: { wood: 20, stone: 10, gold: 0 },
    pickaxe: { wood: 20, stone: 15, gold: 0 },
    sword: { wood: 30, stone: 20, gold: 0 }, // Убрали золото из стартового рецепта меча
    wood_wall: { wood: 10, stone: 0, gold: 0 },
    stone_wall: { wood: 0, stone: 15, gold: 0 },
    spike: { wood: 10, stone: 5, gold: 0 },
    door: { wood: 20, stone: 0, gold: 0 }
};

function isTooCloseToOthers(x, y, radius) {
    for (let obj of gameObjects) {
        const dx = obj.x - x;
        const dy = obj.y - y;
        if (Math.sqrt(dx*dx + dy*dy) < (obj.radius + radius + 30)) return true;
    }
    return false;
}

// Генерация ресурсов под биомы
function generateResources() {
    const totalObjects = 700;
    let attempts = 0;
    while (gameObjects.length < totalObjects && attempts < 3000) {
        attempts++;
        const x = Math.random() * MAP_SIZE;
        const y = Math.random() * MAP_SIZE;
        const radius = 25 + Math.random() * 15;
        let type = 'tree';

        if (y < MAP_SIZE * 0.3) {
            // Зима -> Ёлки и Камни
            type = Math.random() > 0.4 ? 'fir' : 'stone';
        } else if (x > MAP_SIZE * 0.7 && y > MAP_SIZE * 0.7) {
            // Пустыня -> Кактусы и Золотая жила
            type = Math.random() > 0.4 ? 'cactus' : 'gold_ore';
        } else {
            // Обычный биом -> Обычные деревья и камни
            type = Math.random() > 0.3 ? 'tree' : 'stone';
        }

        if (!isTooCloseToOthers(x, y, radius)) {
            gameObjects.push({ id: Math.random().toString(36).substr(2, 9), x, y, radius, type, health: 100 });
        }
    }
}
generateResources();

// Спавн мобов по биомам
function spawnMobs() {
    const maxMobs = 40;
    const mobTypes = ['wolf', 'pig', 'rabbit'];
    
    while (mobs.length < maxMobs) {
        const x = Math.random() * MAP_SIZE;
        const y = Math.random() * MAP_SIZE;
        let type = 'pig';

        if (y < MAP_SIZE * 0.3) {
            type = 'rabbit'; // Белые кролики в зиме
        } else if (x > MAP_SIZE * 0.7 && y > MAP_SIZE * 0.7) {
            type = Math.random() > 0.5 ? 'wolf' : 'pig';
        } else {
            type = Math.random() > 0.6 ? 'wolf' : 'pig';
        }

        mobs.push({
            id: Math.random().toString(36).substr(2, 9),
            x, y, type,
            health: type === 'wolf' ? 120 : (type === 'pig' ? 80 : 30),
            maxHealth: type === 'wolf' ? 120 : (type === 'pig' ? 80 : 30),
            speed: type === 'rabbit' ? 3.5 : 2,
            angle: Math.random() * Math.PI * 2,
            targetId: null
        });
    }
}

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id,
        x: MAP_SIZE / 2,
        y: MAP_SIZE / 2,
        radius: 25,
        angle: 0,
        name: "Player",
        activeSlot: 1,
        activeItem: "empty",
        resources: { wood: 40, stone: 30, gold: 10, meat: 0 },
        hotbar: { 1: "empty", 2: "empty", 3: "empty", 4: "empty", 5: "empty" }
    };

    socket.emit('init', { id: socket.id, mapSize: MAP_SIZE });

    socket.on('player_join', (data) => {
        if (players[socket.id]) players[socket.id].name = data.name || "Player";
    });

    socket.on('select_slot', (slotNumber) => {
        const p = players[socket.id];
        if (p && p.hotbar[slotNumber]) {
            p.activeSlot = Number(slotNumber);
            p.activeItem = p.hotbar[slotNumber];
            socket.emit('slot_changed', { success: true, activeSlot: p.activeSlot, activeItem: p.activeItem });
        }
    });

    socket.on('craft_request', (itemName) => {
        const p = players[socket.id];
        if (!p) return;
        const recipe = CRAFT_RECIPES[itemName];
        if (!recipe) return;

        if (p.resources.wood >= recipe.wood && p.resources.stone >= recipe.stone) {
            p.resources.wood -= recipe.wood;
            p.resources.stone -= recipe.stone;

            let slot = null;
            for (let i = 1; i <= 5; i++) {
                if (p.hotbar[i] === 'empty') { slot = i; break; }
            }
            if (!slot) slot = p.activeSlot;

            p.hotbar[slot] = itemName;
            p.activeItem = p.hotbar[p.activeSlot];

            socket.emit('craft_response', { success: true, resources: p.resources, hotbar: p.hotbar, activeItem: p.activeItem });
        }
    });

    // ОБРАБОТКА ЛКМ (УДАР ИЛИ СТРОИТЕЛЬСТВО)
    socket.on('player_strike', () => {
        const p = players[socket.id];
        if (!p) return;

        // Если в руках строительный блок
        if (p.activeItem.includes('wall') || p.activeItem === 'spike' || p.activeItem === 'door') {
            const buildDist = 80;
            const bx = p.x + Math.cos(p.angle) * buildDist;
            const by = p.y + Math.sin(p.angle) * buildDist;
            const gridX = Math.floor(bx / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
            const gridY = Math.floor(by / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;

            // Проверяем, не занято ли место
            const blockExists = gameObjects.some(o => Math.abs(o.x - gridX) < 10 && Math.abs(o.y - gridY) < 10);
            if (!blockExists) {
                gameObjects.push({
                    id: Math.random().toString(36).substr(2, 9),
                    x: gridX, y: gridY, radius: GRID_SIZE / 2,
                    type: p.activeItem, health: 150
                });
                // Забираем блок из рук
                p.hotbar[p.activeSlot] = 'empty';
                p.activeItem = 'empty';
                socket.emit('slot_changed', { success: true, activeSlot: p.activeSlot, activeItem: 'empty' });
                socket.emit('craft_response', { success: true, resources: p.resources, hotbar: p.hotbar, activeItem: 'empty' });
            }
            return;
        }

        // Логика атаки / сбора ресурсов ближнего боя
        const attackDist = 70;
        const hx = p.x + Math.cos(p.angle) * attackDist;
        const hy = p.y + Math.sin(p.angle) * attackDist;

        // Удар по объектам
        gameObjects.forEach((obj, idx) => {
            const dx = obj.x - hx; const dy = obj.y - hy;
            if (Math.sqrt(dx*dx + dy*dy) < obj.radius + 20) {
                let amount = 1;
                let resType = null;
                if (obj.type === 'tree' || obj.type === 'fir') { resType = 'wood'; }
                if (obj.type === 'stone') { resType = 'stone'; }
                if (obj.type === 'cactus') { resType = 'wood'; amount = 2; }
                if (obj.type === 'gold_ore') { resType = 'gold'; }

                if (resType) {
                    p.resources[resType] += amount;
                    socket.emit('loot_received', { type: resType, count: amount });
                    socket.emit('update_resources', p.resources);
                }
            }
        });

        // Удар по мобам
        mobs.forEach((mob) => {
            const dx = mob.x - hx; const dy = mob.y - hy;
            if (Math.sqrt(dx*dx + dy*dy) < 35) {
                let dmg = p.activeItem === 'sword' ? 35 : 15;
                mob.health -= dmg;
                if (mob.type === 'pig' || mob.type === 'rabbit') mob.angle = p.angle; // Убегает в направлении удара
            }
        });
    });

    // ПОДБОР ПРЕДМЕТОВ НА СЕРВЕРЕ (Клавиша Q)
    socket.on('pickup_item', () => {
        const p = players[socket.id];
        if (!p) return;

        droppedItems = droppedItems.filter(item => {
            const dx = item.x - p.x;
            const dy = item.y - p.y;
            if (Math.sqrt(dx*dx + dy*dy) < 50) {
                p.resources.meat += 1;
                socket.emit('loot_received', { type: 'meat', count: 1 });
                socket.emit('update_resources', p.resources);
                return false; // Удаляем с земли
            }
            return true;
        });
    });

    socket.on('player_input', (data) => {
        const p = players[socket.id];
        if (!p) return;
        if (data.move) {
            p.x += data.move.x * 4; p.y += data.move.y * 4;
            p.x = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.x));
            p.y = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.y));
        }
        p.angle = data.angle || 0;
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

// ИИ Моб-движок
setInterval(() => {
    spawnMobs();

    mobs = mobs.filter(mob => {
        if (mob.health <= 0) {
            if (mob.type === 'pig' || mob.type === 'wolf') {
                droppedItems.push({ x: mob.x, y: mob.y, type: 'meat', id: Math.random() });
            }
            return false;
        }

        // Логика поведения Волка (Агрессивный)
        if (mob.type === 'wolf') {
            let closestPlayer = null;
            let minDist = 350;
            for (let id in players) {
                const dist = Math.sqrt((players[id].x - mob.x)**2 + (players[id].y - mob.y)**2);
                if (dist < minDist) { minDist = dist; closestPlayer = players[id]; }
            }
            if (closestPlayer) {
                mob.angle = Math.atan2(closestPlayer.y - mob.y, closestPlayer.x - mob.x);
                mob.x += Math.cos(mob.angle) * mob.speed;
                mob.y += Math.sin(mob.angle) * mob.speed;
            } else {
                if (Math.random() < 0.02) mob.angle = Math.random() * Math.PI * 2;
                mob.x += Math.cos(mob.angle) * 0.5; mob.y += Math.sin(mob.angle) * 0.5;
            }
        } else {
            // Пассивные свиньи и кролики (Хаотично бродят / Убегают)
            if (Math.random() < 0.03) mob.angle = Math.random() * Math.PI * 2;
            mob.x += Math.cos(mob.angle) * mob.speed * 0.4;
            mob.y += Math.sin(mob.angle) * mob.speed * 0.4;
        }

        mob.x = Math.max(30, Math.min(MAP_SIZE - 30, mob.x));
        mob.y = Math.max(30, Math.min(MAP_SIZE - 30, mob.y));
        return true;
    });

    io.emit('game_update', { players, gameObjects, mobs, droppedItems });
}, 1000 / 60);

server.listen(process.env.PORT || 3000);
