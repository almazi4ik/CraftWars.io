// Переключение окон (Открыть/Закрыть)
function toggleWindow(windowId) {
    const windowEl = document.getElementById(windowId);
    if (windowEl) {
        windowEl.classList.toggle('hidden');
    }
}

// Выбор активного слота в хотбаре
function selectSlot(slotNumber) {
    // Убираем активный класс у всех слотов
    document.querySelectorAll('#hotbar .slot').forEach(slot => {
        slot.classList.remove('active');
    });

    // Добавляем активный класс выбранному слоту
    const activeSlot = document.querySelector(`#hotbar .slot[data-slot="${slotNumber}"]`);
    if (activeSlot) {
        activeSlot.classList.add('active');
        console.log(`Выбран слот: ${slotNumber}`);
        // Тут можно слать пакет на сервер: socket.emit('select_item', slotNumber);
    }
}

// Клик по слотам мышкой
document.querySelectorAll('#hotbar .slot').forEach(slot => {
    slot.addEventListener('click', () => {
        const slotNum = slot.getAttribute('data-slot');
        selectSlot(slotNum);
    });
});

// Слушаем клавиатуру (Цифры и Горячие клавиши)
window.addEventListener('keydown', (e) => {
    // Цифры 1-5
    if (e.key >= '1' && e.key <= '5') {
        selectSlot(e.key);
    }
    
    // Английская I или русская Ш для инвентаря
    if (e.key.toLowerCase() === 'i' || e.key.toLowerCase() === 'ш') {
        toggleWindow('inventory-window');
    }

    // Английская C или русская С для крафта
    if (e.key.toLowerCase() === 'c' || e.key.toLowerCase() === 'с') {
        toggleWindow('craft-window');
    }
});

// Функция крафта (Заглушка, отправляй отсюда данные на сервер)
function craftItem(itemName) {
    console.log(`Запрос на крафт предмета: ${itemName}`);
    alert(`Ты скрафтил: ${itemName}! (Здесь должен быть запрос на сервер)`);
    // socket.emit('craft', itemName);
}
