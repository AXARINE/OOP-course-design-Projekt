import Phaser from 'phaser';
import { Tank } from './Tank';

export class Enemy extends Tank {
    private moveEvent: Phaser.Time.TimerEvent;

    // AI 目标与参数
    private targetAngle: number = 0; // 希望朝向（弧度）
    private aimAngle: number | null = null; // 射击用的朝向（不直接影响移动）
    private targetPos: { x: number, y: number } | null = null; // 当前寻路目标点（世界坐标）
    private path: Array<{ x: number, y: number }> | null = null; // 路径点（世界坐标）
    private pathIndex: number = 0;
    private desiredSpeed: number = 0; // 希望移动速度（像素/秒）
    private rotationSpeedDeg: number = 180; // 最大转向速度（度/秒）
    private behavior: 'chase' | 'random' | 'idle' = 'idle';
    private noiseRadius: number = 24; // 追击时的随机偏移半径（像素） (缩小，优先寻路)
    private waypointTolerance: number = 18; // 到达目标点的容差（像素）

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'enemy-texture');

        this.moveSpeed = 100;
        this.hp = 1; // 敌人只有 1 条命
        this.team = 'enemy';
        this.fireDelay = 2000; // 敌人射击慢一点

        // 初始目标角度为当前朝向
        this.targetAngle = this.rotation;

        // 确保与世界边界发生碰撞（万一父类未生效）
        this.setCollideWorldBounds(true);

        // AI 循环：每 1.5 秒做一次决策
        this.moveEvent = scene.time.addEvent({
            delay: 1500,
            callback: () => this.aiLogic(),
            loop: true
        });
    }

    // 外部控制 AI 的开关（用于游戏状态机暂停/恢复行为）
    public pauseAI() {
        if (this.moveEvent) this.moveEvent.paused = true;
        this.desiredSpeed = 0;
        this.setVelocity(0, 0);
    }

    public resumeAI() {
        if (this.moveEvent) this.moveEvent.paused = false;
    }

    update() {
        // 若游戏未处于 PLAYING，则不执行射击/移动逻辑
        const sceneAny = this.scene as any;
        if (sceneAny.gameState && sceneAny.gameState !== 'PLAYING') {
            this.setVelocity(0, 0);
            this.setAngularVelocity(0);
            return;
        }
        // 每一帧尝试射击：若能看到玩家则瞄准并在合适角度发射，但不打断路径跟随
        const player = (this.scene as any).player as any;
        if (player && Phaser.Math.Between(0, 100) > 96) {
            const aim = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const scene = this.scene as any;
            const hasLOS = scene.hasLineOfSight ? scene.hasLineOfSight(this.x, this.y, player.x, player.y) : true;

            if (hasLOS) {
                // 将 aim 保存在 aimAngle（用于判断是否可开火），但只有在没有路径或不在追击行为时才把它作为移动目标角
                this.aimAngle = aim;
                if (!this.path || this.behavior !== 'chase') {
                    this.targetAngle = aim;
                }

                // 如果路径上可能有友军，则不要开火（避免友伤）
                const hasFriendBetween = scene.hasFriendlyBetween ? scene.hasFriendlyBetween(this, player.x, player.y) : false;

                // 只有在朝向接近目标角度且没有友军在射线上的时候才发射（避免斜射和误伤）
                const angleDiffAim = Phaser.Math.Angle.Wrap(aim - this.rotation);
                const maxToleranceRad = Phaser.Math.DegToRad(12); // 允许 12 度误差
                if (Math.abs(angleDiffAim) <= maxToleranceRad && !hasFriendBetween) {
                    this.shoot(this.rotation);
                }
            }
        }

        // 平滑转向：根据 targetAngle 设置角速度，而不是瞬间转向
        const angleDiff = Phaser.Math.Angle.Wrap(this.targetAngle - this.rotation);
        const degDiff = Phaser.Math.RadToDeg(angleDiff);
        const absDeg = Math.abs(degDiff);

        if (absDeg < 2) {
            // 足够接近就停止旋转并微调到目标角度
            this.setAngularVelocity(0);
            this.setRotation(this.targetAngle);
        } else {
            // 根据 sign 设定角速度，避免瞬转
            const sign = Math.sign(degDiff);
            this.setAngularVelocity(sign * this.rotationSpeedDeg);
        }

        // 移动逻辑：始终以朝向为前进方向（像玩家），若设置了 targetPos 则向其前进
        if (this.desiredSpeed && this.desiredSpeed > 0) {
            // 如果有目标点，检查是否到达
            if (this.targetPos) {
                const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
                if (dist < this.waypointTolerance) {
                    // 到达目标点：若有路径则推进到下一个节点；若无路径且是追击行为，则生成新的噪声目标；否则停止
                    if (this.path && this.pathIndex < (this.path.length - 1)) {
                        this.pathIndex++;
                        this.targetPos = (this.path && this.path[this.pathIndex]) ? this.path[this.pathIndex] : null;
                        if (this.targetPos) this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
                    } else if (this.behavior === 'chase' && !this.path && player) {
                        // 生成新的带噪声目标并继续
                        this.targetPos = {
                            x: player.x + Phaser.Math.Between(-this.noiseRadius, this.noiseRadius),
                            y: player.y + Phaser.Math.Between(-this.noiseRadius, this.noiseRadius)
                        };
                        this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
                    } else {
                        this.targetPos = null;
                        this.desiredSpeed = 0;
                    }
                }
            }

            // 根据当前朝向前进，转向未完成时减速以模拟转向惯性（不允许斜着直接走）
            const speedFactor = Phaser.Math.Clamp(1 - Math.min(Math.abs(angleDiff) / Math.PI, 1), 0.3, 1);
            const finalSpeed = this.desiredSpeed * speedFactor;
            const vec = (this.scene.physics as Phaser.Physics.Arcade.ArcadePhysics).velocityFromRotation(this.rotation, finalSpeed);
            this.setVelocity(vec.x, vec.y);
        }

        // 如果碰到世界边界（blocked），立即停止移动，避免跑出屏幕
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body && (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down)) {
            this.setVelocity(0, 0);
        }

        // 额外保护：如果位置超出世界范围，则强制修正到边界内
        const bounds = this.scene.physics.world.bounds;
        const margin = 16; // 以半个贴图宽度作为安全边距
        if (this.x < bounds.x + margin) this.x = bounds.x + margin;
        if (this.x > bounds.right - margin) this.x = bounds.right - margin;
        if (this.y < bounds.y + margin) this.y = bounds.y + margin;
        if (this.y > bounds.bottom - margin) this.y = bounds.bottom - margin;
    }

    private aiLogic() {
        const sceneAny = this.scene as any;
        if (sceneAny.gameState && sceneAny.gameState !== 'PLAYING') {
            // 未开始或已结束时不进行 AI 决策
            this.desiredSpeed = 0;
            this.targetPos = null;
            this.path = null;
            return;
        }
        if (!this.active) return;

        const player = (this.scene as any).player as any;

        // 行为决策：提高追击优先级（更多使用寻路）
        const roll = Phaser.Math.Between(0, 100);
        this.setVelocity(0);
        this.setAngularVelocity(0);

        if (roll < 65 && player) { // 65% chase, 更倾向寻路
            // 追击：请求路径（A*），若找到则沿路径前进，否则回退到带噪声的近点策略
            console.log('Enemy.aiLogic: chase', this.x, this.y);
            this.behavior = 'chase';
            this.desiredSpeed = this.moveSpeed;

            const scene = this.scene as any;
            const path = scene.findPathWorld(this.x, this.y, player.x, player.y);
            if (path && path.length > 1) {
                // 使用路径（world 坐标数组）
                this.path = path;
                this.pathIndex = 1; // 0 是当前格子，1 是下一步
                this.targetPos = (this.path && this.path[this.pathIndex]) ? this.path[this.pathIndex] : null;
                if (this.targetPos) this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
            } else {
                // 回退：使用带噪声的目标点（避开墙）
                let attempts = 0;
                let tx = player.x, ty = player.y;
                while (attempts < 8) {
                    tx = player.x + Phaser.Math.Between(-this.noiseRadius, this.noiseRadius);
                    ty = player.y + Phaser.Math.Between(-this.noiseRadius, this.noiseRadius);
                    const tooCloseToWalls = scene.walls.getChildren().some((w: any) => Phaser.Math.Distance.Between(tx, ty, w.x, w.y) < 40);
                    if (!tooCloseToWalls) break;
                    attempts++;
                }
                this.path = null;
                this.pathIndex = 0;
                this.targetPos = { x: tx, y: ty };
                this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, tx, ty);
            }
        } else if (roll < 80) {
            // 随机前进：选取地图内随机点作为 waypoint（前进式，不瞬转），并避免墙
            console.log('Enemy.aiLogic: roam', this.x, this.y);
            this.behavior = 'random';
            this.desiredSpeed = this.moveSpeed * 0.8;

            let attemptsR = 0;
            let rx = 0, ry = 0;
            while (attemptsR < 12) {
                rx = Phaser.Math.Between(50, this.scene.physics.world.bounds.right - 50);
                ry = Phaser.Math.Between(50, this.scene.physics.world.bounds.bottom - 50);
                const tooCloseToWallsR = (this.scene as any).walls.getChildren().some((w: any) => Phaser.Math.Distance.Between(rx, ry, w.x, w.y) < 40);
                const tooCloseToPlayerR = Phaser.Math.Distance.Between(rx, ry, (this.scene as any).player.x, (this.scene as any).player.y) < 80;
                if (!tooCloseToWallsR && !tooCloseToPlayerR) break;
                attemptsR++;
            }
            this.targetPos = { x: rx, y: ry };
            this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, rx, ry);
        } else {
            // 停顿
            console.log('Enemy.aiLogic: idle', this.x, this.y);
            this.behavior = 'idle';
            this.desiredSpeed = 0;
            this.targetPos = null;
        }
    }

    destroy(fromScene?: boolean) {
        this.moveEvent.destroy();
        super.destroy(fromScene);
    }

    // 供调试/外部访问当前瞄准方向（用于可视化）
    public getAimAngle(): number | null {
        return this.aimAngle;
    }
}