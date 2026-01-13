import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy } from '../entities/Enemy';
import { Bullet } from '../entities/Bullet'; // 引入子弹

import { findPath as astarFindPath } from '../utils/Pathfinder';

export class GameScene extends Phaser.Scene {
    private player!: Player;
    private enemies!: Phaser.Physics.Arcade.Group;
    private walls!: Phaser.Physics.Arcade.StaticGroup;
    private bullets!: Phaser.Physics.Arcade.Group; // 子弹组
    private hpText!: Phaser.GameObjects.Text; // 血量文字
    private debugTick: number = 0;

    // 游戏状态机：START -> PLAYING -> ENDED
    private gameState: 'START' | 'PLAYING' | 'ENDED' = 'START';
    private stateText!: Phaser.GameObjects.Text;

    // 网格地图相关（用于寻路）
    private tileSize: number = 32;
    private gridWidth!: number;
    private gridHeight!: number;
    private grid: number[][] = []; // 0=free, 1=wall

    // Debug 可视化（用于显示网格与路径）
    private debugGraphics!: Phaser.GameObjects.Graphics;
    private debugShowGrid: boolean = true;
    private debugShowPaths: boolean = true;

    // 将世界坐标映射到网格
    public worldToGrid(x: number, y: number) {
        return { gx: Math.floor(x / this.tileSize), gy: Math.floor(y / this.tileSize) };
    }

    // 将网格坐标映射到世界坐标（格子中心）
    public gridToWorld(gx: number, gy: number) {
        return { x: gx * this.tileSize + this.tileSize / 2, y: gy * this.tileSize + this.tileSize / 2 };
    }

    // 生成 grid 数组（在 generate 地形之后调用）
    public buildGridFromWalls() {
        const width = this.game.config.width as number;
        const height = this.game.config.height as number;
        this.gridWidth = Math.ceil(width / this.tileSize);
        this.gridHeight = Math.ceil(height / this.tileSize);

        this.grid = new Array(this.gridHeight).fill(0).map(() => new Array(this.gridWidth).fill(0));

        this.walls.getChildren().forEach((w: any) => {
            const cell = this.worldToGrid(w.x, w.y);
            if (cell.gx >= 0 && cell.gx < this.gridWidth && cell.gy >= 0 && cell.gy < this.gridHeight) {
                this.grid[cell.gy][cell.gx] = 1;
            }
        });
    }

    // 快速检查某点是否在墙内（世界坐标）
    public isCellBlockedWorldSpace(x: number, y: number) {
        const c = this.worldToGrid(x, y);
        // 如果 grid 尚未构建（createMap 在 buildGridFromWalls 之前会调用），退回到检查当前 walls 集合
        if (!this.grid || !this.grid.length) {
            return this.walls.getChildren().some((w: any) => {
                const wc = this.worldToGrid(w.x, w.y);
                return wc.gx === c.gx && wc.gy === c.gy;
            });
        }

        if (c.gx < 0 || c.gx >= this.gridWidth || c.gy < 0 || c.gy >= this.gridHeight) return true;
        return this.grid[c.gy][c.gx] === 1;
    }

    // 基于网格做寻路（世界坐标输入，返回世界坐标的路径点数组或 null）
    public findPathWorld(startX: number, startY: number, endX: number, endY: number): Array<{ x: number, y: number }> | null {
        const s = this.worldToGrid(startX, startY);
        const e = this.worldToGrid(endX, endY);
        if (s.gx < 0 || s.gx >= this.gridWidth || s.gy < 0 || s.gy >= this.gridHeight) return null;
        if (e.gx < 0 || e.gx >= this.gridWidth || e.gy < 0 || e.gy >= this.gridHeight) return null;
        if (this.grid[e.gy][e.gx] === 1) return null; // 目标在墙上

        const raw = astarFindPath(this.grid, { x: s.gx, y: s.gy }, { x: e.gx, y: e.gy });
        if (!raw) return null;

        // 转换为世界坐标中心点
        return raw.map(n => this.gridToWorld(n.x, n.y));
    }

    // 检查两点之间是否有直线视野（没有被墙阻挡）
    public hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        const s = this.worldToGrid(x1, y1);
        const e = this.worldToGrid(x2, y2);

        // 如果 grid 尚未构建，退回到简单的几何相交检测（墙的矩形）
        if (!this.grid || !this.grid.length) {
            const line = new Phaser.Geom.Line(x1, y1, x2, y2);
            return !this.walls.getChildren().some((w: any) => {
                const rect = new Phaser.Geom.Rectangle(w.x - this.tileSize / 2, w.y - this.tileSize / 2, this.tileSize, this.tileSize);
                return Phaser.Geom.Intersects.LineToRectangle(line, rect);
            });
        }

        const dx = e.gx - s.gx;
        const dy = e.gy - s.gy;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));
        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const gx = Math.round(Phaser.Math.Linear(s.gx, e.gx, t));
            const gy = Math.round(Phaser.Math.Linear(s.gy, e.gy, t));
            if (gx < 0 || gy < 0 || gx >= this.gridWidth || gy >= this.gridHeight) continue;
            if (this.grid[gy][gx] === 1) return false;
        }
        return true;
    }

    // 检查两点之间的射线是否可能击中友军（用于避免友伤）
    public hasFriendlyBetween(shooter: any, tx: number, ty: number, margin = 14): boolean {
        const x1 = shooter.x, y1 = shooter.y;
        const x2 = tx, y2 = ty;
        const dx = x2 - x1, dy = y2 - y1;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return false;

        const enemies = this.enemies ? this.enemies.getChildren() : [];
        for (const c of enemies as any[]) {
            if (!c || c === shooter) continue;
            if (!c.active) continue;
            const px = c.x, py = c.y;
            // 投影到线段上
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
            const projx = x1 + t * dx; const projy = y1 + t * dy;
            const dist = Phaser.Math.Distance.Between(px, py, projx, projy);
            if (dist <= margin) return true;
        }
        return false;
    }

    constructor() {
        super('GameScene');
    }

    preload() {
        // ... (保留之前的坦克和墙壁绘图代码) ...
        const graphics = this.make.graphics({ x: 0, y: 0 });

        // 1. 玩家贴图
        graphics.fillStyle(0x00ff00); graphics.fillRect(0, 0, 32, 32);
        graphics.fillStyle(0x0000ff); graphics.fillRect(16, 12, 16, 8);
        graphics.generateTexture('tank-texture', 32, 32);
        graphics.clear();

        // 2. 敌人贴图
        graphics.fillStyle(0xff0000); graphics.fillRect(0, 0, 32, 32);
        graphics.fillStyle(0xffffff); graphics.fillRect(16, 12, 16, 8);
        graphics.generateTexture('enemy-texture', 32, 32);
        graphics.clear();

        // 3. 墙壁贴图
        graphics.fillStyle(0xbcae76); graphics.fillRect(0, 0, 32, 32);
        graphics.lineStyle(2, 0x000000); graphics.strokeRect(0, 0, 32, 32);
        graphics.generateTexture('wall-texture', 32, 32);
        graphics.clear();

        // 4. 【新增】子弹贴图 (黄色小球)
        graphics.fillStyle(0xffff00);
        graphics.fillCircle(4, 4, 4); // 半径4
        graphics.generateTexture('bullet-texture', 8, 8);

        graphics.destroy();
    }

    create() {
        this.add.rectangle(400, 300, 800, 600, 0x000000);

        // 提高物理步频，减小高速物体穿透概率（默认约为 60）
        this.physics.world.setFPS(120);

        // --- 初始化组 ---
        this.walls = this.physics.add.staticGroup();

        // 创建子弹组 (使用对象池模式，性能好)
        this.bullets = this.physics.add.group({
            classType: Bullet,
            runChildUpdate: true,
            maxSize: 30 // 屏幕上最多同时存在30颗子弹
        });

        // --- 初始化角色 ---
        this.player = new Player(this, 300, 500);
        this.player.setBullets(this.bullets); // 把弹药库给玩家

        // 现在生成地形并基于 walls 构建寻路网格（需要 player 已存在以避免在玩家附近生成墙）
        this.createMap();
        this.buildGridFromWalls();

        // 确保玩家没有出生在墙内（若在墙内则把玩家移动到最近的空位）
        this.ensurePlayerNotInWall();

        // Debug 绘图：用于显示网格与敌人路径（便于观察寻路）
        this.debugGraphics = this.add.graphics();
        this.debugGraphics.setDepth(100);
        this.drawDebug(); // 初次绘制一次，后续每若干帧刷新

        // 使用物理组，让碰撞/重叠回调中的对象是带物理体的 Sprite
        this.enemies = this.physics.add.group({ runChildUpdate: true });

        // 随机生成敌人（每次刷新 2-5 个），避免生成在玩家附近或墙内
        {
            const count = Phaser.Math.Between(2, 5);
            const positions: Array<{ x: number, y: number }> = [];
            const minDistToPlayer = 120;
            const minDistBetween = 64;
            const maxAttempts = 50;

            for (let i = 0; i < count; i++) {
                let attempt = 0;
                let x = 0, y = 0;

                while (true) {
                    x = Phaser.Math.Between(50, 750);
                    y = Phaser.Math.Between(50, 550);

                    const tooCloseToPlayer = Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < minDistToPlayer;
                    const tooCloseToOthers = positions.some(p => Phaser.Math.Distance.Between(x, y, p.x, p.y) < minDistBetween);
                    const tooCloseToWalls = this.walls.getChildren().some((w: any) => Phaser.Math.Distance.Between(x, y, w.x, w.y) < 40);

                    if (!tooCloseToPlayer && !tooCloseToOthers && !tooCloseToWalls) break;

                    attempt++;
                    if (attempt >= maxAttempts) break; // 放弃后使用当前坐标
                }

                positions.push({ x, y });
                this.spawnEnemy(x, y);
            }

            console.log(`spawned ${positions.length} enemies`, positions);
        }

        // 敌人生成后先暂停 AI（等待玩家按 ENTER 开始）
        this.enemies.getChildren().forEach((e: any) => {
            if (e && typeof e.pauseAI === 'function') e.pauseAI();
        });

        // --- 碰撞检测 ---

        // 1. 坦克撞墙 (保持不变)
        this.physics.add.collider(this.player, this.walls);
        this.physics.add.collider(this.enemies, this.walls);
        this.physics.add.collider(this.player, this.enemies);
        // 额外：让敌人之间发生碰撞并分离，避免重叠
        this.physics.add.collider(this.enemies, this.enemies);

        // 2. 移除子弹-墙体的 Arcade 碰撞，由子弹自身的射线检测负责反弹

        // 3. 子弹打敌人 -> 敌人扣血，子弹销毁
        this.physics.add.overlap(this.bullets, this.enemies, (bullet, enemy) => {
            const b = bullet as Bullet;
            const e: any = enemy;
            const owner: any = b.getOwner && b.getOwner();

            // 允许同队互伤（友军伤害已启用）——但仍忽略自伤
            if (owner && owner === e) {
                return;
            }

            // 回收子弹
            b.deactivate();

            // 调用敌人受伤方法（兼容不同参数形态）
            if (typeof e.takeDamage === 'function') {
                e.takeDamage();
            } else if (e.gameObject && typeof e.gameObject.takeDamage === 'function') {
                e.gameObject.takeDamage();
            } else {
                console.warn('Unable to call takeDamage on enemy', e);
            }
        });

        // 4. 子弹打玩家 -> 玩家扣血，子弹销毁
        this.physics.add.overlap(this.bullets, this.player, (player, bullet) => {
            const b = bullet as Bullet;
            const owner: any = b.getOwner && b.getOwner();
            // 过滤：若子弹发射者与玩家属于同一队伍则忽略
            if (owner && owner.team && (player as any).team && owner.team === (player as any).team) {
                return;
            }
            // 过滤：若子弹发射者是玩家本人则忽略
            if (owner && owner === player) {
                return;
            }
            b.deactivate();
            this.player.takeDamage();
            this.updateHPText(); // 更新界面
        });

        // --- UI ---

        // 确保 canvas 可聚焦并自动聚焦：有时浏览器需要 canvas 获取焦点才能接收键盘事件
        const canvas = this.game.canvas as HTMLCanvasElement;
        if (canvas) {
            canvas.tabIndex = 0; // 使其可聚焦
            canvas.style.outline = 'none';
            canvas.focus(); // 自动聚焦一次

            // 点击画面也会聚焦（便于用户交互）
            this.input.on('pointerdown', () => canvas.focus());
        }

        // 调试：监听键盘按下事件，便于开发时快速确认按键事件是否到达
        this.input?.keyboard?.on('keydown', (e: any) => {
            console.log('keydown:', e.code || e.key);
        });

        this.hpText = this.add.text(10, 10, 'HP: 3', {
            fontSize: '24px',
            color: '#00ff00',
            fontStyle: 'bold'
        });

        // 状态文本（Start / Game Over 提示）
        this.stateText = this.add.text(400, 260, '', { fontSize: '32px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

        // ENTER 用于开始游戏，R 用于重启
        const enter = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
        enter?.on('down', () => {
            if (this.gameState === 'START') this.setGameState('PLAYING');
        });
        const rkey = this.input?.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.R);
        rkey?.on('down', () => {
            if (this.gameState === 'ENDED') this.scene.restart();
        });
        // 兼容性：也监听全局按键事件，确保在 ENDED 状态下按 R 能重启（有时 addKey 的回调可能被其它输入状态影响）
        this.input?.keyboard?.on('keydown-R', (e: any) => {
            console.log('keydown-R event received, gameState=', this.gameState, 'event:', e);
            if (this.gameState === 'ENDED') {
                console.log('Restarting scene via keydown-R');
                this.scene.restart();
            }
        });

        // 初始到 START 状态（敌人 AI 在 START 时被暂停）
        this.setGameState('START');
    }

    // ... 前面的代码不变 ...

    update() {
        // 调试：每60帧打印一次，确认场景 update 在跑
        this.debugTick++;
        if (this.debugTick % 60 === 0) console.log('GameScene.update tick', this.debugTick);

        // 只有在 PLAYING 状态下才允许玩家更新与移动
        if (this.gameState === 'PLAYING') {
            if (this.player && this.player.active) {
                this.player.update();
            }
        } else if (this.gameState === 'ENDED' && this.hpText) {
            this.hpText.setText("GAME OVER");
            this.hpText.setColor('#ff0000');
        }

        // 每隔若干帧刷新调试绘制，减少开销
        if (this.debugGraphics && (this.debugShowGrid || this.debugShowPaths)) {
            if (this.debugTick % 10 === 0) this.drawDebug();
        }
    }

    // Debug: 绘制网格占用与敌人路径
    private drawDebug() {
        try {
            if (!this.debugGraphics) return;
            this.debugGraphics.clear();

            // 绘制被占用的格子（安全检查 grid 与尺寸）
            if (this.debugShowGrid && Array.isArray(this.grid) && this.grid.length && Number.isFinite(this.gridWidth) && Number.isFinite(this.gridHeight)) {
                for (let gy = 0; gy < this.gridHeight; gy++) {
                    const row = this.grid[gy];
                    if (!row) continue;
                    for (let gx = 0; gx < this.gridWidth; gx++) {
                        if (row[gx] === 1) {
                            const x = gx * this.tileSize;
                            const y = gy * this.tileSize;
                            this.debugGraphics.fillStyle(0x883333, 0.6);
                            this.debugGraphics.fillRect(x, y, this.tileSize, this.tileSize);
                        }
                    }
                }
            }

            // 绘制敌人路径（安全检查 enemies）
            if (this.debugShowPaths && this.enemies && typeof this.enemies.getChildren === 'function') {
                const children = this.enemies.getChildren();
                if (Array.isArray(children)) {
                    children.forEach((en: any) => {
                        if (en && Array.isArray(en.path) && en.path.length) {
                            const p = en.path as Array<{ x: number, y: number }>;
                            this.debugGraphics.lineStyle(2, 0x00ffff, 0.9);
                            for (let i = 0; i < p.length - 1; i++) {
                                const a = p[i], b = p[i + 1];
                                if (!a || !b) continue;
                                this.debugGraphics.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
                            }
                            p.forEach(n => {
                                if (!n) return;
                                this.debugGraphics.fillStyle(0x00ffff, 1);
                                this.debugGraphics.fillCircle(n.x, n.y, 4);
                            });

                            // 绘制瞄准方向（若敌人有 aimAngle）
                            const aim = typeof (en as any).getAimAngle === 'function' ? (en as any).getAimAngle() : (en as any).aimAngle;
                            if (typeof aim === 'number' && !isNaN(aim)) {
                                const sx = en.x, sy = en.y;
                                const ex = sx + Math.cos(aim) * 20;
                                const ey = sy + Math.sin(aim) * 20;
                                this.debugGraphics.lineStyle(2, 0xff00ff, 0.9);
                                this.debugGraphics.strokeLineShape(new Phaser.Geom.Line(sx, sy, ex, ey));
                                this.debugGraphics.fillStyle(0xff00ff, 1);
                                this.debugGraphics.fillCircle(ex, ey, 3);
                            }
                        }
                    });
                }
            }
        } catch (err) {
            // 捕获并记录错误，避免在 create()/update 时抛出中断游戏流程
            console.error('drawDebug encountered error:', err);
        }
    }

    // ... 后面的代码不变 ...

    private spawnEnemy(x: number, y: number) {
        console.log('spawnEnemy called', x, y);
        const enemy = new Enemy(this, x, y);
        enemy.setBullets(this.bullets); // 别忘了给敌人弹药

        // 确保敌人处于激活和可见状态，然后加入物理组
        enemy.setActive(true);
        enemy.setVisible(true);
        this.enemies.add(enemy);

        // 配置物理 body，确保敌人会发生碰撞并分离（避免重叠）
        const eb = enemy.body as Phaser.Physics.Arcade.Body | undefined;
        if (eb) {
            eb.setCollideWorldBounds(true);
            eb.setImmovable(false);
            eb.setBounce(0);
            eb.setDrag(100, 100);
        }

        // 当敌人被 destroy 时检查是否还有剩余敌人，若无则结束游戏（玩家获胜）
        enemy.on('destroy', () => {
            // 延迟一帧确认 group 状态（避免在 destroy 回调里同步修改导致 race）
            this.time.delayedCall(0, () => {
                const alive = this.enemies.getChildren().filter((c: any) => c && c.active).length;
                if (alive === 0 && this.gameState === 'PLAYING') {
                    this.setGameState('ENDED');
                }
            });
        });

        console.log('enemies group length:', this.enemies.getLength(), 'contains:', this.enemies.getChildren().map((c: any) => ({ x: c.x, y: c.y, active: c.active })));
    }

    private updateHPText() {
        this.hpText.setText(`HP: ${this.player.hp}`);
        if (this.player.hp <= 1) this.hpText.setColor('#ff0000'); // 血少变红

        // 如果玩家死亡则进入 ENDED 状态
        if (this.player.hp <= 0) {
            this.setGameState('ENDED');
        }
    }

    // 设置游戏状态并在状态切换时执行必要动作
    private setGameState(state: 'START' | 'PLAYING' | 'ENDED') {
        this.gameState = state;
        if (state === 'START') {
            this.stateText.setText('按 Enter 开始');
            // 暂停所有敌人 AI
            this.enemies.getChildren().forEach((e: any) => { if (e && typeof e.pauseAI === 'function') e.pauseAI(); });
            // 清理子弹
            this.bullets.getChildren().forEach((b: any) => { if (b && typeof b.deactivate === 'function') b.deactivate(); });
        } else if (state === 'PLAYING') {
            this.stateText.setText('');
            // 恢复敌人 AI
            this.enemies.getChildren().forEach((e: any) => { if (e && typeof e.resumeAI === 'function') e.resumeAI(); });
            // 确保玩家生命值与界面一致
            this.updateHPText();
        } else if (state === 'ENDED') {
            this.stateText.setText('游戏结束 - 按 R 重启');
            // 暂停敌人并停止其移动
            this.enemies.getChildren().forEach((e: any) => {
                if (e) {
                    if (typeof e.pauseAI === 'function') e.pauseAI();
                    try { e.setVelocity && e.setVelocity(0, 0); } catch (err) { }
                }
            });
            // 回收并禁用所有子弹
            this.bullets.getChildren().forEach((b: any) => { if (b && typeof b.deactivate === 'function') b.deactivate(); });
        }
    }

    private createMap() {
        // 混合生成：长墙（A）与短墙（B），并对齐到网格
        this.walls.clear(true, true);

        // 偏好更长的墙体：增加长墙数量与长度，减少短墙密度
        const longWallCount = Phaser.Math.Between(4, 8); // A (更长/更多)
        const shortWallCount = Phaser.Math.Between(3, 6); // B (减少短墙)
        const minDistToPlayer = 6; // 单位：格，略微远离玩家
        const attemptsLimit = 80;

        // 网格尺寸
        const worldW = this.game.config.width as number;
        const worldH = this.game.config.height as number;
        const colsWorld = Math.floor(worldW / this.tileSize);
        const rowsWorld = Math.floor(worldH / this.tileSize);

        const playerCell = this.worldToGrid(this.player.x, this.player.y);

        // 控制总占用格子数，确保障碍比例小于 10%
        const maxWallCells = Math.floor(colsWorld * rowsWorld * 0.10);
        let placedCells = 0;

        // 辅助函数：检查一段墙是否可放（不靠玩家且不与现有墙重叠），也检测是否超出最大占用
        const canPlaceSegment = (startGx: number, startGy: number, len: number, orientation: 'h' | 'v') => {
            if (placedCells + len > maxWallCells) return false; // 超出总体比率限制
            if (startGx < 0 || startGy < 0) return false;
            const endGx = orientation === 'h' ? startGx + len - 1 : startGx;
            const endGy = orientation === 'v' ? startGy + len - 1 : startGy;
            if (endGx >= colsWorld || endGy >= rowsWorld) return false;
            // 距离玩家太近则不可
            if (Phaser.Math.Distance.Between(startGx, startGy, playerCell.gx, playerCell.gy) < minDistToPlayer) return false;
            for (let k = 0; k < len; k++) {
                const gx = orientation === 'h' ? startGx + k : startGx;
                const gy = orientation === 'v' ? startGy + k : startGy;
                const pos = this.gridToWorld(gx, gy);
                if (this.isCellBlockedWorldSpace(pos.x, pos.y)) return false;
            }
            return true;
        };

        // 1) 生成长墙 (A)
        for (let i = 0; i < longWallCount; i++) {
            let attempts = 0;
            let placed = false;
            while (attempts < attemptsLimit && !placed) {
                const len = Phaser.Math.Between(12, 24);
                const orientation: 'h' | 'v' = Math.random() < 0.5 ? 'h' : 'v';
                const gx = Phaser.Math.Between(2, colsWorld - (orientation === 'h' ? len + 2 : 3));
                const gy = Phaser.Math.Between(2, rowsWorld - (orientation === 'v' ? len + 2 : 3));
                if (canPlaceSegment(gx, gy, len, orientation)) {
                    for (let k = 0; k < len; k++) {
                        const gxk = orientation === 'h' ? gx + k : gx;
                        const gyk = orientation === 'v' ? gy + k : gy;
                        const pos = this.gridToWorld(gxk, gyk);
                        this.walls.create(pos.x, pos.y, 'wall-texture');
                        placedCells++;
                    }
                    placed = true;
                }
                attempts++;
            }
        }

        // 2) 生成短墙/柱子 (B)
        for (let i = 0; i < shortWallCount; i++) {
            let attempts = 0;
            let placed = false;
            while (attempts < attemptsLimit && !placed) {
                const len = Phaser.Math.Between(2, 4);
                const orientation: 'h' | 'v' = Math.random() < 0.5 ? 'h' : 'v';
                const gx = Phaser.Math.Between(1, colsWorld - (orientation === 'h' ? len + 1 : 2));
                const gy = Phaser.Math.Between(1, rowsWorld - (orientation === 'v' ? len + 1 : 2));
                if (canPlaceSegment(gx, gy, len, orientation)) {
                    for (let k = 0; k < len; k++) {
                        if (Phaser.Math.Between(0, 100) < 10 && k > 0 && k < len - 1) continue; // 中间小洞
                        const gxk = orientation === 'h' ? gx + k : gx;
                        const gyk = orientation === 'v' ? gy + k : gy;
                        const pos = this.gridToWorld(gxk, gyk);
                        this.walls.create(pos.x, pos.y, 'wall-texture');
                        placedCells++;
                        // 若已达到占比上限，则退出短墙生成循环
                        if (placedCells >= maxWallCells) { placed = true; break; }
                    }
                    placed = true;
                }
                attempts++;
            }
        }

        console.log('createMap: mixed walls generated', this.walls.getLength(), 'placedCells', placedCells, 'max', maxWallCells);
    }

    // 若玩家出生点在墙内则寻找最近的空格并移动玩家到该格中心
    private ensurePlayerNotInWall() {
        if (!this.player) return;
        if (!this.isCellBlockedWorldSpace(this.player.x, this.player.y)) return;

        const start = this.worldToGrid(this.player.x, this.player.y);
        const maxR = Math.max(this.gridWidth || 0, this.gridHeight || 0) || 20;
        for (let r = 1; r < maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    // 只检查环上，减少检查量
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const gx = start.gx + dx, gy = start.gy + dy;
                    if (gx < 0 || gy < 0 || gx >= (this.gridWidth || 0) || gy >= (this.gridHeight || 0)) continue;
                    const pos = this.gridToWorld(gx, gy);
                    if (!this.isCellBlockedWorldSpace(pos.x, pos.y)) {
                        // 移动玩家并返回
                        this.player.x = pos.x; this.player.y = pos.y;
                        // 若玩家带有 physics body，同步修正 body
                        const pb = (this.player.body as any);
                        if (pb) { pb.x = pos.x - (this.player.width || 0) / 2; pb.y = pos.y - (this.player.height || 0) / 2; }
                        console.log('ensurePlayerNotInWall: moved player to safe cell', gx, gy);
                        return;
                    }
                }
            }
        }
        console.warn('ensurePlayerNotInWall: unable to find free cell for player spawn');
    }
}