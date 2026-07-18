const config = {
    type: Phaser.AUTO, width: 800, height: 600,
    scene: { create: create, update: update }
};
const game = new Phaser.Game(config);
let socket = io();

function create() {
    this.add.text(400, 300, 'Добро пожаловать, ' + (window.playerNickname || 'Игрок'), { fill: '#fff' }).setOrigin(0.5);
    // Здесь будет твой игровой мир
}

function update() {}
