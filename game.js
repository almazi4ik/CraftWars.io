const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    physics: { default: 'arcade' },
    scene: { preload: preload, create: create, update: update }
};
const game = new Phaser.Game(config);
let player;

function preload() {
    // В MooMoo/Dynast была трава. Зальем фон цветом травы
}

function create() {
    this.cameras.main.setBackgroundColor('#86B946'); // Тот самый цвет травы

    // Рисуем сетку (как в Dynast.io), чтобы было видно движение
    let grid = this.add.grid(0, 0, 2000, 2000, 50, 50, 0x86B946, 0, 0x76A936, 0.5);
    
    // Игрок (квадратный персонаж, как в старых добрых ио)
    player = this.add.rectangle(400, 300, 30, 30, 0xffd700); // Золотистый квадрат
    this.physics.add.existing(player);
    this.cameras.main.startFollow(player);

    // Добавим дерево (как в MooMoo)
    let tree = this.add.rectangle(500, 400, 40, 40, 0x5D4037);
    this.add.rectangle(500, 370, 20, 20, 0x2E7D32).setOrigin(0.5); // Крона
}

function update() {
    // Движение к курсору
    if (this.input.activePointer.isDown) {
        this.physics.moveToObject(player, this.input.activePointer, 200);
    } else {
        player.body.setVelocity(0);
    }
}
