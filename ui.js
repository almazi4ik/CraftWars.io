const socket = io('https://craftwars-io.onrender.com');

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const radarCanvas = document.getElementById('radarCanvas');
const radarCtx = radarCanvas.getContext('2d');

// Размеры экрана
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

let myId = null;
let mapSize = 3000;
let gameActive = false;
let players = {};
let gameObjects = [];

// Ввод игрока (клавиатура и мышь)
const keys = { w: false, a: false, s: false, d: false };
let mouseAngle = 0;

function startGame() {
    const nick = document.getElementById('nickname-input').value.trim();
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('game-ui').classList.remove('hidden');
    
    gameActive = true;
    socket.emit('player_join', { name: nick });
    
    // Запускаем цикл отрисовки
    requestAnimationFrame(gameLoop);
}

// Прием настроек от сервера
socket.on('init', (data) => {
    myId = data.id;
    mapSize = data.mapSize;
    gameObjects = data.objects;
});

// Синхронизация игроков с сервером
socket.on('game_update', (data) => {
    players = data.players;
});

// Обновление ресурсов в UI
socket.on('update_resources', (resources) => {
    document.getElementById('res-wood').innerText = resources.wood;
    document.getElementById('res-stone').innerText = resources.stone;
});

socket.on('slot_changed', (data) => {
    if (data.success) {
        document.querySelectorAll('#hotbar .slot').forEach(s => s.classList.remove('active'));
        document.querySelector(`#hotbar .slot[data-slot="${data.activeSlot}"]`).classList.add('active');
    }
});

socket.on('craft_response', (data) => {
    if (data.success) {
        document.getElementById('res-wood').innerText = data.resources.wood;
        document.getElementById('res-stone').innerText = data.resources.stone;
        updateUIHotbar(data.hotbar);
    } else {
        alert(data.message);
    }
});

// Управление клавиатурой (Движение)
window.addEventListener('keydown', (e) => {
    if (!gameActive || document.activeElement.id === 'nickname-input') return;
    if (e.key === 'w' || e.key === 'ц') keys.w = true;
    if (e.key === 'a' || e.key === 'ф') keys.a = true;
    if (e.key === 's' || e.key === 'ы') keys.s = true;
    if (e.key === 'd' || e.key === 'в') keys.d = true;

    if (e.key >= '1' && e.key <= '5') socket.emit('select_slot', e.key);
    if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') toggleWindow('inventory-window');
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') toggleWindow('craft-window');
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'w' || e.key === 'ц') keys.w = false;
    if (e.key === 'a' || e.key === 'ф') keys.a = false;
    if (e.key === 's' || e.key === 'ы') keys.s = false;
    if (e.key === 'd' || e.key === 'в') keys.d = false;
});

// Расчет угла направления за курсором мыши
window.addEventListener('mousemove', (e) => {
    if (!gameActive) return;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    mouseAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
});

// Клик — отправка удара на сервер
window.addEventListener('mousedown', () => {
    if (gameActive) socket.emit('player_strike');
});

// Основной игровой рендер-цикл клиента
function gameLoop() {
    if (!gameActive) return;

    // Считаем вектор направления движения
    let moveX = 0;
    let moveY = 0;
    if (keys.w) moveY = -1;
    if (keys.s) moveY = 1;
    if (keys.a) moveX = -1;
    if (keys.d) moveX = 1;

    // Отправляем ввод на сервер
    socket.emit('player_input', { move: { x: moveX, y: moveY }, angle: mouseAngle });

    // Отрисовка
    const me = players[myId];
    if (me) {
        // Камера центрируется на нашем персонаже
        const camX = me.x - canvas.width / 2;
        const camY = me.y - canvas.height / 2;

        // Чистим экран и рисуем травяную сетку
        ctx.fillStyle = '#578a34';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        drawGrid(ctx, camX, camY);

        // Рисуем ресурсы (деревья, камни)
        for (let obj of gameObjects) {
            drawObject(ctx, obj, camX, camY);
        }

        // Рисуем всех игроков на сервере
        for (let id in players) {
            drawPlayer(ctx, players[id], camX, camY, id === myId);
        }

        // Рендерим радар (миникарту)
        drawRadar(me);
    }

    requestAnimationFrame(gameLoop);
}

// Рисование сетки земли
function drawGrid(c, cx, cy) {
    c.strokeStyle = '#4d7a2e';
    c.lineWidth = 2;
    const gridSize = 100;
    const startX = Math.floor(cx / gridSize) * gridSize;
    const startY = Math.floor(cy / gridSize) * gridSize;

    for (let x = startX; x < startX + canvas.width + gridSize; x += gridSize) {
        c.beginPath(); c.moveTo(x - cx, 0); c.lineTo(x - cx, canvas.height); c.stroke();
    }
    for (let y = startY; y < startY + canvas.height + gridSize; y += gridSize) {
        c.beginPath(); c.moveTo(0, y - cy); c.lineTo(canvas.width, y - cy); c.stroke();
    }
}

// Отрисовка Деревьев/Камней
function drawObject(c, obj, cx, cy) {
    const screenX = obj.x - cx;
    const screenY = obj.y - cy;
    
    // Проверка видимости на экране
    if (screenX < -100 || screenX > canvas.width + 100 || screenY < -100 || screenY > canvas.height + 100) return;

    c.beginPath();
    c.arc(screenX, screenY, obj.radius, 0, Math.PI * 2);
    c.fillStyle = obj.type === 'tree' ? '#2e5c1e' : '#7a7a7a';
    c.strokeStyle = obj.type === 'tree' ? '#1f3d14' : '#555';
    c.lineWidth = 5;
    c.fill();
    c.stroke();
}

// Отрисовка Игрока с руками-кругляшками (как в MooMoo/Dynast)
function drawPlayer(c, p, cx, cy, isMe) {
    const sX = p.x - cx;
    const sY = p.y - cy;

    c.save();
    c.translate(sX, sY);
    c.rotate(p.angle);

    // Рисуем руки/инструменты (две окружности по бокам)
    c.fillStyle = '#e0ac69';
    c.strokeStyle = '#333';
    c.lineWidth = 3;
    
    // Левая рука
    c.beginPath(); c.arc(20, -20, 10, 0, Math.PI * 2); c.fill(); c.stroke();
    // Правая рука (бьющая)
    c.beginPath(); c.arc(20, 20, 10, 0, Math.PI * 2); c.fill(); c.stroke();

    // Тело персонажа
    c.fillStyle = isMe ? '#4a90e2' : '#e0ac69'; // Вы — синий, враги — бежевые
    c.beginPath();
    c.arc(0, 0, p.radius, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    c.restore();

    // Имя над головой
    c.fillStyle = 'white';
    c.font = 'bold 14px Arial';
    c.textAlign = 'center';
    c.shadowColor = 'black'; c.shadowBlur = 4;
    c.fillText(p.name, sX, sY - p.radius - 10);
    c.shadowBlur = 0;
}

// РИСОВАНИЕ РАДАРА (МИНИКАРТЫ)
function drawRadar(me) {
    radarCtx.clearRect(0, 0, 150, 150);
    
    // Получаем относительные координаты нас на карте
    const radarX = (me.x / mapSize) * 150;
    const radarY = (me.y / mapSize) * 150;

    // Отрисовка точек других игроков
    radarCtx.fillStyle = 'rgba(255, 0, 0, 0.7)'; // Враги красные
    for (let id in players) {
        if (id !== myId) {
            const pX = (players[id].x / mapSize) * 150;
            const pY = (players[id].y / mapSize) * 150;
            radarCtx.beginPath(); radarCtx.arc(pX, pY, 3, 0, Math.PI * 2); radarCtx.fill();
        }
    }

    // Наша точка на радаре
    radarCtx.fillStyle = '#ffffff'; // Вы белая мигающая точка
    radarCtx.beginPath();
    radarCtx.arc(radarX, radarY, 4, 0, Math.PI * 2);
    radarCtx.fill();
}

function toggleWindow(wId) { document.getElementById(wId).classList.toggle('hidden'); }
function craftItem(name) { socket.emit('craft_request', name); }

function updateUIHotbar(hotbar) {
    for (let slotNum in hotbar) {
        const slotText = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"] .slot-icon`);
        if (slotText) {
            let n = hotbar[slotNum];
            if (n === 'wood_wall') n = 'Дер. Стена';
            if (n === 'stone_wall') n = 'Кам. Стена';
            if (n === 'spike') n = 'Шипы';
            if (n === 'empty') n = 'Пусто';
            slotText.innerText = n;
        }
    }
}
