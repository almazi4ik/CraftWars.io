const config = {
    type: Phaser.AUTO, width: 800, height: 600,
    scene: [Menu, Game]
};
const game = new Phaser.Game(config);

// СЦЕНА МЕНЮ
class Menu extends Phaser.Scene {
    constructor() { super('Menu'); }
    create() {
        this.add.text(400, 200, 'CraftWars.io', { fontSize: '64px', fill: '#fff' }).setOrigin(0.5);
        let btn = this.add.text(400, 400, 'ИГРАТЬ', { fontSize: '32px', fill: '#0f0', backgroundColor: '#333', padding: {x: 20, y: 10} }).setOrigin(0.5).setInteractive();
        
        btn.on('pointerdown', () => this.scene.start('Game'));
    }
}

// СЦЕНА ИГРЫ
class Game extends Phaser.Scene {
    constructor() { super('Game'); }
    create() {
        this.add.text(10, 10, 'Вы в игре! (Нажми E для инвентаря)', { fill: '#fff' });
        // Здесь будет ваш основной код игры
    }
}
