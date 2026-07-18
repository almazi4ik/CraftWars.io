const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: { create: create, update: update }
};

const game = new Phaser.Game(config);
let socket = io();
let player;

function create() {
    // 1. Устанавливаем фон, чтобы не было серым
    this.cameras.main.setBackgroundColor('#2d2d2d');

    // 2. Рисуем игрока
    player = this.add.circle(400, 300, 20, 0x00ff00);
    this.physics.add.existing(player);
    
    // 3. Камера должна следовать за игроком
    this.cameras.main.startFollow(player);

    this.add.text(10, 10, 'CraftWars.io - В игре!', { fill: '#fff' }).setScrollFactor(0);
}

function update() {
    // Управление для примера (движение за мышкой/тачем)
    if (this.input.activePointer.isDown) {
        this.physics.moveToObject(player, this.input.activePointer, 200);
    } else {
        player.body.setVelocity(0);
    }
}
