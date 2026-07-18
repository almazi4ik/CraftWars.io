const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" } 
});

// КРИТИЧЕСКИ ВАЖНО: Указываем серверу раздавать файлы фронтенда из текущей папки
app.use(express.static(path.join(__dirname, './')));

// База рецептов крафта
const CRAFT_RECIPES = {
    wood_wall: { wood: 10, stone: 0, gold: 0 },
    stone_wall: { wood: 0, stone: 15, gold: 0 },
    spike: { wood: 10, stone: 5, gold: 0 }
};

const players = {};

io.on('connection', (socket) => {
    console.log(`Игрок подключился: ${socket.id}`);

    // Создаем профиль игрока со стартовыми ресурсами для теста
    players[socket.id] = {
        id: socket.id,
        x: 100,
        y: 100,
        activeSlot: 1,
        resources: { wood: 50, stone: 50, gold: 10 },
        hotbar: { 1: "tool_axe", 2: "tool_pick", 3: "empty", 4: "empty", 5: "empty" }
    };

    socket.emit('init', players[socket.id]);

    socket.on('select_slot', (slotNumber) => {
        const player = players[socket.id];
        if (!player) return;
        if (slotNumber >= 1 && slotNumber <= 5) {
            player.activeSlot = Number(slotNumber);
            socket.emit('slot_changed', { success: true, activeSlot: player.activeSlot });
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

            if (itemName === 'wood_wall') player.hotbar[3] = 'wood_wall';
            if (itemName === 'stone_wall') player.hotbar[3] = 'stone_wall';
            if (itemName === 'spike') player.hotbar[4] = 'spike';

            socket.emit('craft_response', { 
                success: true, 
                resources: player.resources,
                hotbar: player.hotbar,
                message: `Вы успешно скрафтили ${itemName}!`
            });
        } else {
            socket.emit('craft_response', { success: false, message: "Недостаточно ресурсов!" });
        }
    });

    socket.on('disconnect', () => {
        delete players[socket.id];
    });
});

// На Render порт выдается автоматически через process.env.PORT
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Сервер CraftWars.io запущен на порту ${PORT}`);
});
