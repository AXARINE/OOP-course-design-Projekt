/**
 * 输入管理器
 * 负责处理游戏的输入事件
 */
import Phaser from 'phaser';

export class InputManager {
    private scene: Phaser.Scene;
    private onStartGame?: () => void;
    private onRestartGame?: () => void;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * 初始化输入系统
     */
    setup(onStartGame: () => void, onRestartGame: () => void): void {
        this.onStartGame = onStartGame;
        this.onRestartGame = onRestartGame;

        // 确保 canvas 可聚焦
        const canvas = this.scene.game.canvas as HTMLCanvasElement;
        if (canvas) {
            canvas.tabIndex = 0;
            canvas.style.outline = 'none';
            canvas.focus();

            this.scene.input.on('pointerdown', () => canvas.focus());
        }

        // 调试键盘事件
        this.scene.input?.keyboard?.on('keydown', (e: any) => {
            console.log('keydown:', e.code || e.key);
        });

        // ENTER 开始游戏
        const enter = this.scene.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        enter?.on('down', () => {
            if (this.onStartGame) {
                this.onStartGame();
            }
        });

        // R 重启游戏
        const rkey = this.scene.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        rkey?.on('down', () => {
            if (this.onRestartGame) {
                this.onRestartGame();
            }
        });

        // 兼容性：全局 R 键监听
        this.scene.input?.keyboard?.on('keydown-R', () => {
            if (this.onRestartGame) {
                this.onRestartGame();
            }
        });
    }
}
