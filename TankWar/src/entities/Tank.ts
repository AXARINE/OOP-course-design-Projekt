import Phaser from 'phaser';
import { Bullet } from './Bullet';

export class Tank extends Phaser.Physics.Arcade.Sprite {
    protected moveSpeed: number = 150;
    public hp: number = 1;
    public team: 'player' | 'enemy' | 'neutral' = 'neutral';

    protected lastFired: number = 0;
    protected fireDelay: number = 500;
    protected bulletGroup?: Phaser.Physics.Arcade.Group;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
        super(scene, x, y, texture);

        // === 【关键点 1】必须把自己添加到场景 ===
        scene.add.existing(this);

        // === 【关键点 2】必须把自己添加到物理世界 ===
        // 如果漏了这一行，坦克就动不了！
        scene.physics.add.existing(this);

        // 设置碰撞框大小
        this.body?.setSize(28, 28);

        // 开启边界碰撞
        this.setCollideWorldBounds(true);
    }

    public setBullets(bullets: Phaser.Physics.Arcade.Group) {
        this.bulletGroup = bullets;
    }

    protected muzzleOffset: number = 18; // 子弹从坦克前方多少像素处生成

    protected shoot(aim?: number) {
        if (!this.bulletGroup || !this.active) return;

        const time = this.scene.time.now;
        if (time > this.lastFired) {
            const rot = (typeof aim === 'number') ? aim : this.rotation;
            // 从坦克前方发射，避免子弹从中心穿过坦克
            const spawnX = this.x + Math.cos(rot) * this.muzzleOffset;
            const spawnY = this.y + Math.sin(rot) * this.muzzleOffset;

            const bullet = this.bulletGroup.get(spawnX, spawnY) as Bullet;
            if (bullet) {
                // 传入发射者引用，便于在碰撞时过滤友军/自伤
                bullet.fire(spawnX, spawnY, rot, this);
                this.lastFired = time + this.fireDelay;
            }
        }
    }

    public takeDamage() {
        this.hp--;
        // 受伤闪烁特效
        this.scene.tweens.add({
            targets: this,
            alpha: 0,
            duration: 50,
            yoyo: true,
            repeat: 3
        });

        if (this.hp <= 0) {
            this.destroy();
        }
    }
}