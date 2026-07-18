const config = {
    type: Phaser.AUTO, width: 800, height: 600,
    scene: { preload: preload, create: create, update: update }
};
const game = new Phaser.Game(config);
let socket = io();
let player;
let inventoryUI;

function preload() {
    this.load.image('tree', 'assets/tree.png'); // Создай папку assets
}

function create() {
    this.players = this.add.group();
    
    // Инвентарь UI (скрыт по умолчанию)
    inventoryUI = document.createElement('div');
    inventoryUI.innerHTML = `<div id="inv" style="display:none; background:white; padding:20px; border:2px solid black;">
        <h3>Инвентарь (E)</h3>
        <p>Дерево: <span id="wood">0</span></p>
        <p>Камень: <span id="stone">0</span></p>
    </div>`;
    document.body.appendChild(inventoryUI);

    // Клавиша E
    this.input.keyboard.on('keydown-E', () => {
        let div = document.getElementById('inv');
        div.style.display = (div.style.display === 'none') ? 'block' : 'none';
    });
}

function update() {
    // Движение к курсору
    let pointer = this.input.activePointer;
    if (pointer.isDown) {
        socket.emit('playerMove', { x: pointer.x, y: pointer.y });
    }
    
    // Обновление данных UI
    socket.on('state', (players) => {
        if(players[socket.id]) {
            document.getElementById('wood').innerText = players[socket.id].wood;
            document.getElementById('stone').innerText = players[socket.id].stone;
        }
    });
}
