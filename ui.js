// Подключаемся напрямую к твоему серверу на Render
const socket = io('https://craftwars-io.onrender.com');

// Как только подключились, сервер пришлет начальные данные (ресурсы и слоты)
socket.on('init', (data) => {
    if (data && data.resources) {
        updateUIResources(data.resources);
    }
});

// Переключение окон интерфейса (Открыть/Закрыть)
function toggleWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (windowEl) {
        windowEl.classList.toggle('hidden');
    }
}

// Отправка на сервер запроса на смену активного слота
function selectSlot(slotNumber) {
    socket.emit('select_slot', slotNumber);
}

// Сервер подтвердил, что слот успешно изменен
socket.on('slot_changed', (data) => {
    if (data.success) {
        // Убираем подсветку со всех слотов хотбара
        document.querySelectorAll('#hotbar .slot').forEach(slot => {
            slot.classList.remove('active');
        });

        // Подсвечиваем тот слот, который вернул сервер
        const activeSlot = document.querySelector(`#hotbar .slot[data-slot="${data.activeSlot}"]`);
        if (activeSlot) {
            activeSlot.classList.add('active');
        }
    }
});

// Клик по нижним слотам хотбара мышкой
document.querySelectorAll('#hotbar .slot').forEach(slot => {
    slot.addEventListener('click', () => {
        const slotNum = slot.getAttribute('data-slot');
        selectSlot(slotNum);
    });
});

// Слушаем клавиатуру (Цифры 1-5 и кнопки окон I и C)
window.addEventListener('keydown', (e) => {
    if (e.key >= '1' && e.key <= '5') {
        selectSlot(e.key);
    }
    
    if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') {
        toggleWindow('inventory-window');
    }

    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') {
        toggleWindow('craft-window');
    }
});

// Отправка запроса на крафт блока на сервер
function craftItem(itemName) {
    socket.emit('craft_request', itemName);
}

// Получаем ответ от сервера после попытки крафта
socket.on('craft_response', (data) => {
    // Выводим сообщение от сервера (например: "Недостаточно ресурсов!" или "Скрафчено!")
    alert(data.message); 
    
    if (data.success) {
        // Если крафт успешный, обновляем циферки ресурсов на экране
        updateUIResources(data.resources);
        
        // Здесь можно обновить отображение предметов в слотах, если сервер прислал обновленный хотбар
        if (data.hotbar) {
            updateUIHotbar(data.hotbar);
        }
    }
});

// Функция, которая берет данные ресурсов и рисует их в левом окошке
function updateUIResources(resources) {
    if (document.getElementById('res-wood')) document.getElementById('res-wood').innerText = resources.wood || 0;
    if (document.getElementById('res-stone')) document.getElementById('res-stone').innerText = resources.stone || 0;
    if (document.getElementById('res-gold')) document.getElementById('res-gold').innerText = resources.gold || 0;
}

// (Необязательно) Функция для обновления названий предметов внутри слотов хотбара
function updateUIHotbar(hotbar) {
    for (let slotNum in hotbar) {
        const slotText = document.querySelector(`#hotbar .slot[data-slot="${slotNum}"] .slot-icon`);
        if (slotText) {
            // Переводим техническое имя в понятное для игрока
            let name = hotbar[slotNum];
            if (name === 'wood_wall') name = 'Дер. Стена';
            if (name === 'stone_wall') name = 'Кам. Стена';
            if (name === 'spike') name = 'Шипы';
            if (name === 'empty') name = 'Пусто';
            
            slotText.innerText = name;
        }
    }
}
