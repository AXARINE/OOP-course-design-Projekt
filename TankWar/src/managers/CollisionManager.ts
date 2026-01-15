/**
 * 碰撞管理器
 * 负责处理所有游戏对象之间的碰撞和重叠检测
 */
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Bullet } from '../entities/Bullet';

export class CollisionManager {
    private scene: Phaser.Scene;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * 设置坦克与墙的碰撞
     */
    setupTankWallCollision(
        player: Player,
        enemies: Phaser.Physics.Arcade.Group,
        walls: Phaser.Physics.Arcade.StaticGroup
    ): void {
        // 确保墙壁具有正确的物理属性
        walls.children.entries.forEach(wall => {
            (wall as Phaser.Physics.Arcade.Sprite).setImmovable(true);
            // 移除对静态对象调用setCollideWorldBounds的错误操作
        });

        // 为玩家和墙壁设置碰撞
        this.scene.physics.add.collider(player, walls);
        // 为敌人和墙壁设置碰撞
        this.scene.physics.add.collider(enemies, walls);
    }

    /**
     * 设置坦克之间的碰撞
     */
    setupTankTankCollision(
        player: Player,
        enemies: Phaser.Physics.Arcade.Group
    ): void {
        this.scene.physics.add.collider(player, enemies);
        this.scene.physics.add.collider(enemies, enemies);
    }

    /**
     * 设置子弹与敌人的重叠检测
     */
    setupBulletEnemyOverlap(
        bullets: Phaser.Physics.Arcade.Group,
        enemies: Phaser.Physics.Arcade.Group
    ): void {
        this.scene.physics.add.overlap(bullets, enemies, (bullet, enemy) => {
            const b = bullet as Bullet;
            const e: any = enemy;

            // 移除所有伤害限制，允许任何子弹伤害任何目标，包括发射者
            b.deactivate();

            if (typeof e.takeDamage === 'function') {
                e.takeDamage();
            } else if (e.gameObject && typeof e.gameObject.takeDamage === 'function') {
                e.gameObject.takeDamage();
            } else {
                console.warn('Unable to call takeDamage on enemy', e);
            }
        });
    }

    /**
     * 设置子弹与玩家的重叠检测
     */
    setupBulletPlayerOverlap(
        bullets: Phaser.Physics.Arcade.Group,
        player: Player,
        onPlayerHit: () => void
    ): void {
        this.scene.physics.add.overlap(bullets, player, (playerObj, bullet) => {
            const b = bullet as Bullet;

            // 允许任何子弹伤害玩家，包括玩家自己的子弹（自伤）
            b.deactivate();
            (playerObj as Player).takeDamage();
            onPlayerHit();
        });
    }

    /**
     * 检查射线路径上是否有友军
     */
    hasFriendlyBetween(
        shooter: any,
        tx: number,
        ty: number,
        enemies: Phaser.Physics.Arcade.Group,
        margin: number = 14
    ): boolean {
        const x1 = shooter.x, y1 = shooter.y;
        const x2 = tx, y2 = ty;
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return false;

        const enemyList = enemies ? enemies.getChildren() : [];
        for (const c of enemyList as any[]) {
            if (!c || c === shooter) continue;
            if (!c.active) continue;
            const px = c.x, py = c.y;

            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
            const projx = x1 + t * dx;
            const projy = y1 + t * dy;
            const dist = Phaser.Math.Distance.Between(px, py, projx, projy);
            if (dist <= margin) return true;
        }
        return false;
    }
}