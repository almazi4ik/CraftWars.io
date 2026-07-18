// Подключаемся к твоему серверу на Render
const socket = io('https://craftwars-io.onrender.com');

// Функция запуска игры при нажатии на кнопку PLAY
function startGame() {
    const nick = document.getElementById('nickname-input').value.trim();
    
    // Прячем главное меню
    document.getElementById('main-menu').classList.add('hidden');
    
    // Показываем весь игровой интерфейс (кнопки, крафт, слоты)
    document.getElementById('game-ui').classList.remove('hidden');
    
    // Отправляем ник игрока на сервер, чтобы начать спавн
    console.log(`Заходим в игру с ником: ${nick}`);
    socket.emit('player_join', { name: nick });
}

// Получаем начальные данные (ресурсы)
socket.on('init', (data) => {
    if (data && data.resources) {
        updateUIResources(data.resources);
    }
});

// Открыть/Закрыть окно инвентаря или крафта
function toggleWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (windowEl) {
        windowEl.classList.toggle('hidden');
    }
}

// Отправка смены активного слота
function selectSlot(slotNumber) {
    socket.emit('select_slot', slotNumber);
}

// Подтверждение смены слота от сервера
socket.on('slot_changed', (data) => {
    if (data.success) {
        document.querySelectorAll('#hotbar .slot').forEach(slot => slot.classList.remove('active'));
        const activeSlot = document.querySelector(`#hotbar .slot[data-slot="${data.activeSlot}"]`);
        if (activeSlot) {
            activeSlot.classList.add('active');
        }
    }
});

// Клик мышкой по слотам
document.querySelectorAll('#hotbar .slot').forEach(slot => {
    slot.addEventListener('click', () => {
        const slotNum = slot.getAttribute('data-slot');
        selectSlot(slotNum);
    });
});

// Горячие клавиши (1-5, I, C)
window.addEventListener('keydown', (e) => {
    // Не реагируем, если игрок сейчас пишет ник в меню
    if (document.activeElement.id === 'nickname-input') return;

    if (e.key >= '1' && e.key <= '5') selectSlot(e.key);
    if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') toggleWindow('inventory-window');
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') toggleWindow('craft-window');
});

// Запрос на крафт
function craftItem(itemName) {
    socket.emit('craft_request', itemName);
}

// Ответ от сервера по крафту
socket.on('craft_response', (data) => {
    alert(data.message); 
    if (data.success) {
        updateUIResources(data.resources);
        if (data.hotbar) updateUIHotbar(data.hotbar);
    }
});

// Обновление цифр ресурсов в UI
function updateUIResources(resources) {
    if (document.getElementById('res-wood')) document.getElementById('res-wood').innerText = resources.wood || 0;
    if (document.getElementById('res-stone')) document.getElementById('res-stone').innerText = resources.stone || 0;
    if (document.getElementById('res-gold')) document.getElementById('res-gold').innerText = resources.gold || 0;
}

// Обновление подписей предметов в хотбаре
function updateUIHotbar(hotbar) {
    for (let slotNum in hotbar) {
        const slotText = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"] .slot-icon`);
        if (slotText) {
            let name = hotbar[slotNum];
            if (name === 'wood_wall') name = 'Дер. Стена';
            if (name === 'stone_wall') name = 'Кам. Стена';
            if (name === 'spike') name = 'Шипы';
            if (name === 'empty') name = 'Пусто';
            slotText.innerText = name;
        }
    }
}
