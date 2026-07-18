const config = {
    type: Phaser.AUTO,
    width: window.innerWidth,
    height: window.innerHeight,
    physics: { default: 'arcade', arcade: { gravity: 0 } },
    scene: { create: create, update: update }
};

const game = new Phaser.Game(config);
let player;
let cursors;

function create() {
    // 1. Делаем фон ярко-зеленым
    this.cameras.main.setBackgroundColor('#86B946');

    // 2. Создаем игрока (желтый квадрат, как в классике)
    player = this.add.rectangle(window.innerWidth/2, window.innerHeight/2, 40, 40, 0xFEDC3D);
    this.physics.add.existing(player);
    
    // 3. Чтобы при изменении размера окна всё не ломалось
    window.addEventListener('resize', () => {
        game.scale.resize(window.innerWidth, window.innerHeight);
    });
}

function update() {
    // Движение к нажатию мышки или касанию пальца
    if (this.input.activePointer.isDown) {
        let angle = Phaser.Math.Angle.Between(
            player.x, player.y, 
            this.input.activePointer.x, this.input.activePointer.y
        );
        
        let velocity = 250;
        player.body.setVelocity(
            Math.cos(angle) * velocity,
            Math.sin(angle) * velocity
        );
    } else {
        player.body.setVelocity(0);
    }
}
