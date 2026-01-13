import Phaser from 'phaser';
import { Tank } from './Tank';

export class Player extends Tank {
    private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    private rotateSpeed: number = 200;
    private keySpace: Phaser.Input.Keyboard.Key;
    private debugTick: number = 0;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'tank-texture');
        this.hp = 3; // 玩家 3 条命
        this.team = 'player';

        if (scene.input.keyboard) {
            this.cursors = scene.input.keyboard.createCursorKeys();
            this.keySpace = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        } else {
            throw new Error("Keyboard not found");
        }
    }

    update() {
        if (!this.active) return;

        // 调试：每30帧打印按键状态
        this.debugTick++;
        if (this.debugTick % 30 === 0) {
            console.log('Player.update', {
                left: this.cursors.left.isDown,
                right: this.cursors.right.isDown,
                up: this.cursors.up.isDown,
                down: this.cursors.down.isDown,
                rotation: this.rotation.toFixed(2)
            });
        }


        // 1. 先把角速度归零
        this.setAngularVelocity(0);

        // 2. 只有按键时才设置移动速度，否则归零
        // 这种写法比 setVelocity(0) 更安全
        let currentSpeed = 0;

        // 旋转
        if (this.cursors.left.isDown) {
            this.setAngularVelocity(-this.rotateSpeed);
        } else if (this.cursors.right.isDown) {
            this.setAngularVelocity(this.rotateSpeed);
        }

        // 前后 (只记录速度，不直接设置)
        if (this.cursors.up.isDown) {
            currentSpeed = this.moveSpeed;
        } else if (this.cursors.down.isDown) {
            currentSpeed = -this.moveSpeed;
        }

        // 3. 【核心修复】计算出 x 和 y 的速度，然后一次性设置
        // 这样保证物理引擎能正确识别
        if (currentSpeed !== 0) {
            const vec = this.scene.physics.velocityFromRotation(this.rotation, currentSpeed);
            this.setVelocity(vec.x, vec.y);
        } else {
            this.setVelocity(0, 0); // 没按键就停下（明确设置 X/Y）
        }

        // 射击
        if (this.keySpace.isDown) {
            this.shoot();
        }
    }
}