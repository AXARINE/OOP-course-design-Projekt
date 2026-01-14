import Phaser from 'phaser';
import { Bullet } from './Bullet';

/**
 * 基类：坦克实体，封装移动、射击与受伤逻辑
 */
export class Tank extends Phaser.Physics.Arcade.Sprite {
    protected moveSpeed: number = 150;
    public hp: number = 1;
    public team: 'player' | 'enemy' | 'neutral' = 'neutral';

    protected lastFired: number = 0;
    protected fireDelay: number = 500;
    protected bulletGroup?: Phaser.Physics.Arcade.Group;

    /**
     * 构造函数：将实体加入场景并启用物理
     */
    constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
        super(scene, x, y, texture);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body?.setSize(28, 28);
        this.setCollideWorldBounds(true);
    }

    /**
     * 设置用于发射的子弹组
     */
    public setBullets(bullets: Phaser.Physics.Arcade.Group) {
        this.bulletGroup = bullets;
    }

    protected muzzleOffset: number = 18; // 子弹从坦克前方多少像素处生成

    /**
     * 发射子弹，`aim` 为可选角度（弧度），不传则使用当前朝向
     */
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
                // 传入发射者引用以便碰撞过滤
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