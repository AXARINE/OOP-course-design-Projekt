/**
 * 实体管理器
 * 负责管理游戏中的所有实体（玩家、敌人、子弹）
 */
import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { EnemyAI } from '../entities/EnemyAI';
import { Bullet } from '../entities/Bullet';

export interface EntityManagerCallbacks {
    onPlayerDeath: () => void;
    onAllEnemiesDead: () => void;
}

export class EntityManager {
    private scene: Phaser.Scene;
    private player!: Player;
    private enemies!: Phaser.Physics.Arcade.Group;
    private bullets!: Phaser.Physics.Arcade.Group;
    private callbacks?: EntityManagerCallbacks;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * 初始化实体组
     */
    init(callbacks: EntityManagerCallbacks): void {
        this.callbacks = callbacks;

        // 创建子弹组
        this.bullets = this.scene.physics.add.group({
            classType: Bullet,
            runChildUpdate: true,
            maxSize: 30
        });

        // 创建敌人组
        this.enemies = this.scene.physics.add.group({
            runChildUpdate: true
        });
    }

    /**
     * 创建玩家
     */
    createPlayer(x: number, y: number): Player {
        this.player = new Player(this.scene, x, y);
        this.player.setBullets(this.bullets);
        return this.player;
    }

    /**
     * 生成敌人
     */
    spawnEnemy(x: number, y: number): EnemyAI {
        const enemy = new EnemyAI(this.scene, x, y);
        enemy.setBullets(this.bullets);
        enemy.setActive(true);
        enemy.setVisible(true);
        this.enemies.add(enemy);

        const eb = enemy.body as Phaser.Physics.Arcade.Body | undefined;
        if (eb) {
            eb.setCollideWorldBounds(true);
            eb.setImmovable(false);
            eb.setBounce(0);
            eb.setDrag(100, 100);
        }

        // 监听敌人死亡
        enemy.on('destroy', () => {
            this.scene.time.delayedCall(0, () => {
                const alive = this.enemies.getChildren().filter((c: any) => c && c.active).length;
                if (alive === 0 && this.callbacks) {
                    this.callbacks.onAllEnemiesDead();
                }
            });
        });

        return enemy;
    }

    /**
     * 随机生成多个敌人
     */
    spawnEnemies(
        count: number,
        playerX: number,
        playerY: number,
        checkWallCollision: (x: number, y: number) => boolean
    ): void {
        const positions: Array<{ x: number; y: number }> = [];
        const minDistToPlayer = 120;
        const minDistBetween = 64;
        const maxAttempts = 50;

        for (let i = 0; i < count; i++) {
            let attempt = 0;
            let x = 0, y = 0;

            while (true) {
                x = Phaser.Math.Between(50, 750);
                y = Phaser.Math.Between(50, 550);

                const tooCloseToPlayer = Phaser.Math.Distance.Between(x, y, playerX, playerY) < minDistToPlayer;
                const tooCloseToOthers = positions.some(p => Phaser.Math.Distance.Between(x, y, p.x, p.y) < minDistBetween);
                const tooCloseToWalls = checkWallCollision(x, y);

                if (!tooCloseToPlayer && !tooCloseToOthers && !tooCloseToWalls) break;

                attempt++;
                if (attempt >= maxAttempts) break;
            }

            positions.push({ x, y });
            this.spawnEnemy(x, y);
        }

        console.log(`spawned ${positions.length} enemies`, positions);
    }

    /**
     * 暂停所有敌人AI
     */
    pauseEnemies(): void {
        this.enemies.getChildren().forEach((e: any) => {
            if (e && typeof e.pauseAI === 'function') e.pauseAI();
        });
    }

    /**
     * 恢复所有敌人AI
     */
    resumeEnemies(): void {
        this.enemies.getChildren().forEach((e: any) => {
            if (e && typeof e.resumeAI === 'function') e.resumeAI();
        });
    }

    /**
     * 停止所有敌人移动
     */
    stopEnemies(): void {
        this.enemies.getChildren().forEach((e: any) => {
            if (e) {
                if (typeof e.pauseAI === 'function') e.pauseAI();
                try {
                    e.setVelocity && e.setVelocity(0, 0);
                } catch (err) { }
            }
        });
    }

    /**
     * 清理所有子弹
     */
    clearBullets(): void {
        this.bullets.getChildren().forEach((b: any) => {
            if (b && typeof b.deactivate === 'function') b.deactivate();
        });
    }

    /**
     * 更新玩家
     */
    updatePlayer(): void {
        if (this.player && this.player.active) {
            this.player.update();
        }
    }

    /**
     * 获取玩家
     */
    getPlayer(): Player {
        return this.player;
    }

    /**
     * 获取敌人组
     */
    getEnemies(): Phaser.Physics.Arcade.Group {
        return this.enemies;
    }

    /**
     * 获取子弹组
     */
    getBullets(): Phaser.Physics.Arcade.Group {
        return this.bullets;
    }

    /**
     * 检查玩家血量并触发死亡回调
     */
    checkPlayerHealth(): void {
        if (this.player && this.player.hp <= 0 && this.callbacks) {
            this.callbacks.onPlayerDeath();
        }
    }
}
