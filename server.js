const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
app.use(express.static(path.join(__dirname, './')));

const MAP_SIZE = 9000; const GRID_SIZE = 50;
let gameObjects = []; let mobs = []; let droppedItems = []; const players = {};

const CRAFT_RECIPES = {
    axe: { wood: 20, stone: 10 },
    pickaxe: { wood: 20, stone: 15 },
    sword: { wood: 30, stone: 20 },
    wood_wall: { wood: 10, stone: 0 },
    stone_wall: { wood: 0, stone: 15 },
    spike: { wood: 10, stone: 5 },
    door: { wood: 20, stone: 0 }
};

function isTooClose(x, y, radius) {
    for (let obj of gameObjects) {
        if (Math.sqrt((obj.x - x)**2 + (obj.y - y)**2) < (obj.radius + radius + 30)) return true;
    }
    return false;
}

function generateResources() {
    const totalObjects = 700; let attempts = 0;
    while (gameObjects.length < totalObjects && attempts < 3000) {
        attempts++;
        const x = Math.random() * MAP_SIZE; const y = Math.random() * MAP_SIZE;
        const radius = 25 + Math.random() * 15;
        let type = 'tree';

        if (y < MAP_SIZE * 0.3) { type = Math.random() > 0.4 ? 'fir' : 'stone'; } // Зима
        else if (x > MAP_SIZE * 0.7 && y > MAP_SIZE * 0.7) { type = Math.random() > 0.4 ? 'cactus' : 'stone'; } // Пустыня (без золота)
        else { type = Math.random() > 0.3 ? 'tree' : 'stone'; }

        if (!isTooClose(x, y, radius)) gameObjects.push({ id: Math.random().toString(36).substr(2, 9), x, y, radius, type, health: 100 });
    }
}
generateResources();

function spawnMobs() {
    while (mobs.length < 40) {
        const x = Math.random() * MAP_SIZE; const y = Math.random() * MAP_SIZE;
        let type = 'pig';
        if (y < MAP_SIZE * 0.3) type = 'rabbit';
        else if (x > MAP_SIZE * 0.7 && y > MAP_SIZE * 0.7) type = Math.random() > 0.5 ? 'wolf' : 'pig';
        else type = Math.random() > 0.6 ? 'wolf' : 'pig';

        mobs.push({ id: Math.random().toString(36).substr(2, 9), x, y, type,
            health: type === 'wolf' ? 120 : (type === 'pig' ? 80 : 30), maxHealth: type === 'wolf' ? 120 : (type === 'pig' ? 80 : 30),
            speed: type === 'rabbit' ? 3.5 : 2, angle: Math.random() * Math.PI * 2
        });
    }
}

io.on('connection', (socket) => {
    players[socket.id] = {
        id: socket.id, x: MAP_SIZE / 2, y: MAP_SIZE / 2, radius: 25, angle: 0,
        name: "Player", activeSlot: 1, activeItem: "empty",
        resources: { wood: 40, stone: 30, meat: 0 },
        hotbar: { 1: "empty", 2: "empty", 3: "empty", 4: "empty", 5: "empty" }
    };

    socket.emit('init', { id: socket.id, mapSize: MAP_SIZE });

    socket.on('player_join', (data) => { if (players[socket.id]) players[socket.id].name = data.name || "Player"; });

    socket.on('select_slot', (slotNumber) => {
        const p = players[socket.id];
        if (p && p.hotbar[slotNumber] !== undefined) {
            p.activeSlot = Number(slotNumber); p.activeItem = p.hotbar[slotNumber];
            socket.emit('slot_changed', { success: true, activeSlot: p.activeSlot, activeItem: p.activeItem });
        }
    });

    socket.on('craft_request', (itemName) => {
        const p = players[socket.id]; const recipe = CRAFT_RECIPES[itemName];
        if (p && recipe && p.resources.wood >= recipe.wood && p.resources.stone >= recipe.stone) {
            p.resources.wood -= recipe.wood; p.resources.stone -= recipe.stone;
            let slot = null;
            for (let i = 1; i <= 5; i++) if (p.hotbar[i] === 'empty') { slot = i; break; }
            if (!slot) slot = p.activeSlot;
            p.hotbar[slot] = itemName; p.activeItem = p.hotbar[p.activeSlot];
            socket.emit('craft_response', { success: true, resources: p.resources, hotbar: p.hotbar, activeItem: p.activeItem });
        }
    });

    socket.on('player_strike', () => {
        const p = players[socket.id]; if (!p) return;
        
        if (p.activeItem.includes('wall') || p.activeItem === 'spike' || p.activeItem === 'door') {
            const bx = p.x + Math.cos(p.angle) * 80; const by = p.y + Math.sin(p.angle) * 80;
            const gridX = Math.floor(bx / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
            const gridY = Math.floor(by / GRID_SIZE) * GRID_SIZE + GRID_SIZE / 2;
            if (!gameObjects.some(o => Math.abs(o.x - gridX) < 10 && Math.abs(o.y - gridY) < 10)) {
                gameObjects.push({ id: Math.random().toString(), x: gridX, y: gridY, radius: GRID_SIZE / 2, type: p.activeItem, health: 150, isOpen: false });
                p.hotbar[p.activeSlot] = 'empty'; p.activeItem = 'empty';
                socket.emit('slot_changed', { success: true, activeSlot: p.activeSlot, activeItem: 'empty' });
                socket.emit('craft_response', { success: true, resources: p.resources, hotbar: p.hotbar, activeItem: 'empty' });
            }
            return;
        }

        const hx = p.x + Math.cos(p.angle) * 70; const hy = p.y + Math.sin(p.angle) * 70;
        gameObjects.forEach(obj => {
            if (Math.sqrt((obj.x-hx)**2 + (obj.y-hy)**2) < obj.radius + 20) {
                let res = (obj.type === 'tree' || obj.type === 'fir') ? 'wood' : (obj.type === 'stone' ? 'stone' : (obj.type === 'cactus' ? 'wood' : null));
                let amount = obj.type === 'cactus' ? 2 : 1;
                if (res) {
                    p.resources[res] += amount;
                    socket.emit('loot_received', { type: res, count: amount });
                    socket.emit('update_resources', p.resources);
                }
            }
        });
        mobs.forEach(mob => {
            if (Math.sqrt((mob.x-hx)**2 + (mob.y-hy)**2) < 35) {
                mob.health -= p.activeItem === 'sword' ? 35 : 15;
                if (mob.type === 'pig' || mob.type === 'rabbit') mob.angle = p.angle;
            }
        });
    });

    socket.on('pickup_item', () => {
        const p = players[socket.id]; if (!p) return;
        droppedItems = droppedItems.filter(item => {
            if (Math.sqrt((item.x - p.x)**2 + (item.y - p.y)**2) < 50) {
                p.resources.meat += 1;
                socket.emit('loot_received', { type: 'meat', count: 1 });
                socket.emit('update_resources', p.resources);
                return false;
            }
            return true;
        });
    });

    socket.on('player_input', (data) => {
        const p = players[socket.id]; if (!p) return;
        if (data.move) {
            let dx = data.move.x * 4; let dy = data.move.y * 4;
            let newX = p.x + dx; let newY = p.y + dy;

            // ФУНКЦИЯ КОЛЛИЗИИ (БЛОКИРУЕТ ДВИЖЕНИЕ)
            function isSolid(x, y) {
                for (let obj of gameObjects) {
                    if (obj.type.includes('wall') || obj.type === 'spike' || (obj.type === 'door' && !obj.isOpen)) {
                        const testX = Math.max(obj.x - GRID_SIZE/2, Math.min(x, obj.x + GRID_SIZE/2));
                        const testY = Math.max(obj.y - GRID_SIZE/2, Math.min(y, obj.y + GRID_SIZE/2));
                        if (Math.sqrt((x - testX)**2 + (y - testY)**2) < p.radius) return true;
                    }
                }
                return false;
            }

            if (!isSolid(newX, p.y)) p.x = newX;
            if (!isSolid(p.x, newY)) p.y = newY;
            p.x = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.x));
            p.y = Math.max(p.radius, Math.min(MAP_SIZE - p.radius, p.y));
        }
        p.angle = data.angle || 0;
    });

    socket.on('disconnect', () => delete players[socket.id]);
});

setInterval(() => {
    spawnMobs();
    
    // АВТО-ОТКРЫВАНИЕ ДВЕРЕЙ РЯДОМ С ИГРОКАМИ
    gameObjects.forEach(obj => {
        if (obj.type === 'door') {
            obj.isOpen = false;
            for (let id in players) {
                if (Math.sqrt((players[id].x - obj.x)**2 + (players[id].y - obj.y)**2) < 90) { obj.isOpen = true; break; }
            }
        }
    });

    mobs = mobs.filter(mob => {
        if (mob.health <= 0) {
            if (mob.type === 'pig' || mob.type === 'wolf') droppedItems.push({ x: mob.x, y: mob.y, type: 'meat', id: Math.random() });
            return false;
        }
        if (mob.type === 'wolf') {
            let target = null; let minDist = 350;
            for (let id in players) {
                let d = Math.sqrt((players[id].x - mob.x)**2 + (players[id].y - mob.y)**2);
                if (d < minDist) { minDist = d; target = players[id]; }
            }
            if (target) { mob.angle = Math.atan2(target.y - mob.y, target.x - mob.x); mob.x += Math.cos(mob.angle)*mob.speed; mob.y += Math.sin(mob.angle)*mob.speed; }
            else { if (Math.random()<0.02) mob.angle=Math.random()*Math.PI*2; mob.x+=Math.cos(mob.angle)*0.5; mob.y+=Math.sin(mob.angle)*0.5; }
        } else {
            if (Math.random()<0.03) mob.angle=Math.random()*Math.PI*2;
            mob.x += Math.cos(mob.angle)*mob.speed*0.4; mob.y += Math.sin(mob.angle)*mob.speed*0.4;
        }
        mob.x = Math.max(30, Math.min(MAP_SIZE - 30, mob.x)); mob.y = Math.max(30, Math.min(MAP_SIZE - 30, mob.y));
        return true;
    });
    io.emit('game_update', { players, gameObjects, mobs, droppedItems });
}, 1000 / 60);

server.listen(process.env.PORT || 3000);
