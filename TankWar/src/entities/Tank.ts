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
        this.body?.setOffset(2, 2); // 设置偏移，确保碰撞体居中
        this.setCollideWorldBounds(true);
        // 设置反弹系数，使坦克碰到墙壁时不会穿过去
        this.setBounce(0.1);
        // 设置阻尼，帮助坦克更快停止
        this.setDrag(500);
    }

    /**
     * 设置用于发射的子弹组
     */
    public setBullets(bullets: Phaser.Physics.Arcade.Group) {
        this.bulletGroup = bullets;
    }

    protected muzzleOffset: number = 24; // 增加炮口偏移量，让子弹从炮管前端发射

    /**
     * 发射子弹，`aim` 为可选角度（弧度），不传则使用当前朝向
     */
    protected shoot(aim?: number) {
        if (!this.bulletGroup || !this.active) return;

        const time = this.scene.time.now;
        if (time > this.lastFired) {
            const rot = (typeof aim === 'number') ? aim : this.rotation;
            // 从炮管前端发射，避免子弹从中心穿过坦克
            const spawnX = this.x + Math.cos(rot) * this.muzzleOffset;
            const spawnY = this.y + Math.sin(rot) * this.muzzleOffset;

            const bullet = this.bulletGroup.get(spawnX, spawnY) as Bullet;
            if (bullet) {
                // 检查炮口是否在墙壁内部
                if (this.isBarrelInWall(spawnX, spawnY)) {
                    // 不激活子弹，直接对自己造成伤害
                    console.log("Tank shot at wall, taking damage instead of firing");
                    this.takeDamage();
                    this.lastFired = time + this.fireDelay;
                    return;
                }

                // 传入发射者引用以便碰撞过滤
                bullet.fire(spawnX, spawnY, rot, this);
                this.lastFired = time + this.fireDelay;
            }
        }
    }

    /**
     * 检查炮口是否在墙壁内部
     */
    private isBarrelInWall(barrelX: number, barrelY: number): boolean {
        const sceneAny = this.scene as any;
        const walls = sceneAny?.walls;
        if (!walls) return false;

        const children = walls.getChildren() as Phaser.Physics.Arcade.Image[];
        const half = (sceneAny.tileSize ?? 32) / 2;

        for (const wall of children) {
            if (!wall || !wall.active) continue;

            // 检查炮口位置是否在墙壁内部，使用更精确的碰撞检测
            const wallLeft = wall.x - half;
            const wallRight = wall.x + half;
            const wallTop = wall.y - half;
            const wallBottom = wall.y + half;

            // 使用包含边界的情况，以确保即使在边界上的点也会被检测到
            if (barrelX >= wallLeft && barrelX <= wallRight &&
                barrelY >= wallTop && barrelY <= wallBottom) {
                console.log(`Barrel position (${barrelX}, ${barrelY}) is inside wall (${wallLeft}, ${wallTop}, ${wallRight}, ${wallBottom})`);
                return true;
            }
        }

        return false;
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

        // 添加调试日志，确认扣血被调用
        console.log(`${this.constructor.name} took damage, HP: ${this.hp}`);

        // 只有玩家坦克受到伤害时才更新UI血量显示
        const sceneAny = this.scene as any;
        if (this.team === 'player' && sceneAny.uiManager && typeof sceneAny.uiManager.updateHP === 'function') {
            sceneAny.uiManager.updateHP(this.hp);
        } else if (sceneAny.entityManager && typeof sceneAny.entityManager.checkPlayerHealth === 'function') {
            // 如果是玩家坦克，通过entityManager间接更新UI
            console.log("Calling entityManager.checkPlayerHealth to update UI");
            sceneAny.entityManager.checkPlayerHealth();
        }

        if (this.hp <= 0) {
            // 触发EntityManager中的检查
            if (sceneAny.entityManager && typeof sceneAny.entityManager.checkPlayerHealth === 'function') {
                sceneAny.entityManager.checkPlayerHealth();
            }
            this.destroy();
        }
    }

    /**
     * 检测并校正坦克位置，防止进入墙壁内部
     */
    protected adjustPositionWithinBounds() {
        const sceneAny = this.scene as any;
        const walls = sceneAny?.walls;
        const tileSize: number = sceneAny?.tileSize ?? 32;

        if (walls) {
            const half = tileSize / 2;
            const children = walls.getChildren() as any[];

            for (const w of children) {
                if (!w || !w.active) continue;

                // 检查坦克是否在墙内
                const wallLeft = w.x - half;
                const wallRight = w.x + half;
                const wallTop = w.y - half;
                const wallBottom = w.y + half;

                // 检查坦克中心是否在墙内
                if (this.x >= wallLeft && this.x <= wallRight &&
                    this.y >= wallTop && this.y <= wallBottom) {
                    // 如果坦克在墙内，将其移到最近的墙外位置
                    // 计算四个方向到墙边的距离
                    const distToLeft = this.x - wallLeft;
                    const distToRight = wallRight - this.x;
                    const distToTop = this.y - wallTop;
                    const distToBottom = wallBottom - this.y;

                    // 找到最小距离的方向
                    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

                    // 为坦克大小留出空间（坦克半径约为14）
                    const tankRadius = 14;

                    if (minDist === distToLeft) {
                        this.x = wallLeft - tankRadius; // 左边
                    } else if (minDist === distToRight) {
                        this.x = wallRight + tankRadius; // 右边
                    } else if (minDist === distToTop) {
                        this.y = wallTop - tankRadius; // 上边
                    } else { // distToBottom
                        this.y = wallBottom + tankRadius; // 下边
                    }
                }
            }
        }
    }

    // 安全的物理方法调用，防止在body未初始化时出错
    public setAngularVelocity(value: number) {
        if (this.body && (this.body as Phaser.Physics.Arcade.Body).setAngularVelocity) {
            (this.body as Phaser.Physics.Arcade.Body).setAngularVelocity(value);
        }
        return this;
    }

    public setVelocity(x: number, y: number) {
        if (this.body && (this.body as Phaser.Physics.Arcade.Body).setVelocity) {
            (this.body as Phaser.Physics.Arcade.Body).setVelocity(x, y);
        }
        return this;
    }

    public setRotation(rotation: number) {
        if (this.body) {
            this.rotation = rotation;
        }
        return this;
    }
}