import Phaser from 'phaser';
import { Tank } from './Tank';
import type { IGameContext } from '../core/GameContext';

/**
 * 敌方 AI 坦克：包含寻路、巡逻与射击决策
 */
export class EnemyAI extends Tank {
    private moveEvent: Phaser.Time.TimerEvent;
    private gameContext?: IGameContext;

    // AI 目标与参数
    private targetAngle: number = 0;
    private aimAngle: number | null = null;
    private targetPos: { x: number, y: number } | null = null;
    public path: Array<{ x: number, y: number }> | null = null;
    private pathIndex: number = 0;
    private desiredSpeed: number = 0;
    private rotationSpeedDeg: number = 180;
    private behavior: 'chase' | 'random' | 'idle' = 'idle';
    private noiseRadius: number = 24;
    private waypointTolerance: number = 18;

    /**
     * 创建敌人并启动周期性 AI 逻辑
     */
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'enemy-texture');

        this.moveSpeed = 100;
        this.hp = 1;
        this.team = 'enemy';
        this.fireDelay = 2000;

        this.targetAngle = this.rotation;
        this.setCollideWorldBounds(true);

        this.moveEvent = scene.time.addEvent({
            delay: 1500,
            callback: () => this.aiLogic(),
            loop: true
        });

        // 尝试从场景获取游戏上下文
        const sceneAny = scene as any;
        if (sceneAny.getGameContext) {
            this.gameContext = sceneAny.getGameContext();
        }
    }

    /** 暂停 AI 行为（停止定时器并清零速度） */
    public pauseAI() {
        if (this.moveEvent) this.moveEvent.paused = true;
        this.desiredSpeed = 0;
        this.setVelocity(0, 0);
    }

    /** 恢复 AI 定时事件 */
    public resumeAI() {
        if (this.moveEvent) this.moveEvent.paused = false;
    }

    /** 每帧更新：处理射击判定、转向和平滑移动 */
    update() {
        // 使用游戏上下文检查状态
        if (this.gameContext && !this.gameContext.isPlaying()) {
            this.setVelocity(0, 0);
            this.setAngularVelocity(0);
            return;
        }

        // 尝试射击
        const player = this.gameContext ? this.gameContext.getPlayer() : null;
        if (player && Phaser.Math.Between(0, 100) > 96) {
            const aim = Phaser.Math.Angle.Between(this.x, this.y, player.x, player.y);
            const hasLOS = this.gameContext
                ? this.gameContext.hasLineOfSight(this.x, this.y, player.x, player.y)
                : true;

            if (hasLOS) {
                this.aimAngle = aim;
                if (!this.path || this.behavior !== 'chase') {
                    this.targetAngle = aim;
                }

                const hasFriendBetween = this.gameContext
                    ? this.gameContext.hasFriendlyBetween(this, player.x, player.y)
                    : false;

                const angleDiffAim = Phaser.Math.Angle.Wrap(aim - this.rotation);
                const maxToleranceRad = Phaser.Math.DegToRad(12);
                if (Math.abs(angleDiffAim) <= maxToleranceRad && !hasFriendBetween) {
                    this.shoot(this.rotation);
                }
            }
        }

        // 平滑转向
        const angleDiff = Phaser.Math.Angle.Wrap(this.targetAngle - this.rotation);
        const degDiff = Phaser.Math.RadToDeg(angleDiff);
        const absDeg = Math.abs(degDiff);

        if (absDeg < 2) {
            this.setAngularVelocity(0);
            this.setRotation(this.targetAngle);
        } else {
            const sign = Math.sign(degDiff);
            this.setAngularVelocity(sign * this.rotationSpeedDeg);
        }

        // 移动逻辑
        if (this.desiredSpeed && this.desiredSpeed > 0) {
            if (this.targetPos) {
                const dist = Phaser.Math.Distance.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
                if (dist < this.waypointTolerance) {
                    if (this.path && this.pathIndex < (this.path.length - 1)) {
                        this.pathIndex++;
                        this.targetPos = this.path[this.pathIndex];
                        if (this.targetPos) {
                            this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
                        }
                    } else if (this.behavior === 'chase' && !this.path && player) {
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

            const speedFactor = Phaser.Math.Clamp(1 - Math.min(Math.abs(angleDiff) / Math.PI, 1), 0.3, 1);
            const finalSpeed = this.desiredSpeed * speedFactor;
            const vec = this.scene.physics.velocityFromRotation(this.rotation, finalSpeed);
            this.setVelocity(vec.x, vec.y);
        }

        // 边界检查
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body && (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down)) {
            this.setVelocity(0, 0);
        }

        const bounds = this.scene.physics.world.bounds;
        const margin = 16;
        if (this.x < bounds.x + margin) this.x = bounds.x + margin;
        if (this.x > bounds.right - margin) this.x = bounds.right - margin;
        if (this.y < bounds.y + margin) this.y = bounds.y + margin;
        if (this.y > bounds.bottom - margin) this.y = bounds.bottom - margin;
    }

    /** 周期性 AI 决策逻辑（选择 chase/random/idle 等行为） */
    private aiLogic() {
        if (this.gameContext && !this.gameContext.isPlaying()) {
            this.desiredSpeed = 0;
            this.targetPos = null;
            this.path = null;
            return;
        }
        if (!this.active) return;

        const player = this.gameContext ? this.gameContext.getPlayer() : null;
        const roll = Phaser.Math.Between(0, 100);
        this.setVelocity(0);
        this.setAngularVelocity(0);

        if (roll < 65 && player) {
            console.log('Enemy.aiLogic: chase', this.x, this.y);
            this.behavior = 'chase';
            this.desiredSpeed = this.moveSpeed;

            const path = this.gameContext
                ? this.gameContext.findPathWorld(this.x, this.y, player.x, player.y)
                : null;

            if (path && path.length > 1) {
                this.path = path;
                this.pathIndex = 1;
                this.targetPos = this.path[this.pathIndex];
                if (this.targetPos) {
                    this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, this.targetPos.x, this.targetPos.y);
                }
            } else {
                let attempts = 0;
                let tx = player.x, ty = player.y;
                while (attempts < 8) {
                    tx = player.x + Phaser.Math.Between(-this.noiseRadius, this.noiseRadius);
                    ty = player.y + Phaser.Math.Between(-this.noiseRadius, this.noiseRadius);

                    const tooCloseToWalls = this.gameContext
                        ? this.gameContext.isCellBlockedWorldSpace(tx, ty)
                        : false;
                    if (!tooCloseToWalls) break;
                    attempts++;
                }
                this.path = null;
                this.pathIndex = 0;
                this.targetPos = { x: tx, y: ty };
                this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, tx, ty);
            }
        } else if (roll < 80) {
            console.log('Enemy.aiLogic: roam', this.x, this.y);
            this.behavior = 'random';
            this.desiredSpeed = this.moveSpeed * 0.8;

            let attemptsR = 0;
            let rx = 0, ry = 0;
            while (attemptsR < 12) {
                rx = Phaser.Math.Between(50, this.scene.physics.world.bounds.right - 50);
                ry = Phaser.Math.Between(50, this.scene.physics.world.bounds.bottom - 50);

                const tooCloseToWalls = this.gameContext
                    ? this.gameContext.isCellBlockedWorldSpace(rx, ry)
                    : false;
                const player = this.gameContext ? this.gameContext.getPlayer() : null;
                const tooCloseToPlayer = player
                    ? Phaser.Math.Distance.Between(rx, ry, player.x, player.y) < 80
                    : false;

                if (!tooCloseToWalls && !tooCloseToPlayer) break;
                attemptsR++;
            }
            this.targetPos = { x: rx, y: ry };
            this.targetAngle = Phaser.Math.Angle.Between(this.x, this.y, rx, ry);
        } else {
            console.log('Enemy.aiLogic: idle', this.x, this.y);
            this.behavior = 'idle';
            this.desiredSpeed = 0;
            this.targetPos = null;
        }
    }

    /** 销毁：清理定时器后调用父类销毁 */
    destroy(fromScene?: boolean) {
        this.moveEvent.destroy();
        super.destroy(fromScene);
    }

    /** 返回当前瞄准角度（若存在） */
    public getAimAngle(): number | null {
        return this.aimAngle;
    }
}
