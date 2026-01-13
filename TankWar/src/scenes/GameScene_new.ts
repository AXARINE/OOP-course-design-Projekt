import Phaser from 'phaser';
import { GameStateManager } from '../managers/GameStateManager';
import type { GameStateListener, GameState } from '../managers/GameStateManager';
import { MapManager } from '../managers/MapManager';
import { CollisionManager } from '../managers/CollisionManager';
import { InputManager } from '../managers/InputManager';
import { UIManager } from '../managers/UIManager';
import { EntityManager } from '../managers/EntityManager';
import { DebugManager } from '../managers/DebugManager';
import { GameContext } from '../core/GameContext';
import type { IGameContext } from '../core/GameContext';

export class GameScene extends Phaser.Scene implements GameStateListener {
    // 管理器
    private stateManager!: GameStateManager;
    private mapManager!: MapManager;
    private collisionManager!: CollisionManager;
    private inputManager!: InputManager;
    private uiManager!: UIManager;
    private entityManager!: EntityManager;
    private debugManager!: DebugManager;
    private gameContext!: IGameContext;

    private debugTick: number = 0;

    constructor() {
        super('GameScene');
    }

    preload() {
        const graphics = this.make.graphics({ x: 0, y: 0 });

        // 玩家贴图
        graphics.fillStyle(0x00ff00);
        graphics.fillRect(0, 0, 32, 32);
        graphics.fillStyle(0x0000ff);
        graphics.fillRect(16, 12, 16, 8);
        graphics.generateTexture('tank-texture', 32, 32);
        graphics.clear();

        // 敌人贴图
        graphics.fillStyle(0xff0000);
        graphics.fillRect(0, 0, 32, 32);
        graphics.fillStyle(0xffffff);
        graphics.fillRect(16, 12, 16, 8);
        graphics.generateTexture('enemy-texture', 32, 32);
        graphics.clear();

        // 墙壁贴图
        graphics.fillStyle(0xbcae76);
        graphics.fillRect(0, 0, 32, 32);
        graphics.lineStyle(2, 0x000000);
        graphics.strokeRect(0, 0, 32, 32);
        graphics.generateTexture('wall-texture', 32, 32);
        graphics.clear();

        // 子弹贴图
        graphics.fillStyle(0xffff00);
        graphics.fillCircle(4, 4, 4);
        graphics.generateTexture('bullet-texture', 8, 8);

        graphics.destroy();
    }

    create() {
        this.add.rectangle(400, 300, 800, 600, 0x000000);
        this.physics.world.setFPS(120);

        // 初始化所有管理器
        this.initManagers();

        // 创建UI元素
        this.uiManager.create();

        // 创建游戏上下文
        this.gameContext = new GameContext(
            this.mapManager,
            this.stateManager,
            () => this.entityManager.getPlayer(),
            () => this.entityManager.getEnemies().getChildren() as any[],
            (shooter, tx, ty, margin) => this.collisionManager.hasFriendlyBetween(
                shooter, tx, ty, this.entityManager.getEnemies(), margin
            )
        );

        // 创建玩家
        const player = this.entityManager.createPlayer(300, 500);

        // 生成地图（使用新的 Ricochet 算法）
        this.mapManager.createMap(player.x, player.y);
        this.mapManager.buildGridFromWalls();

        // 显示种子
        this.uiManager.showSeed(this.mapManager.getLastSeed());

        // 确保玩家不在墙内
        const safePos = this.mapManager.ensureNotInWall(player.x, player.y);
        player.setPosition(safePos.x, safePos.y);

        // 创建调试绘制
        this.debugManager.create();
        this.debugManager.draw(
            this.mapManager.getGrid(),
            this.mapManager['gridWidth'],
            this.mapManager['gridHeight'],
            this.mapManager.getTileSize(),
            this.entityManager.getEnemies()
        );

        // 生成敌人
        const enemyCount = Phaser.Math.Between(2, 5);
        this.entityManager.spawnEnemies(
            enemyCount,
            player.x,
            player.y,
            (x, y) => {
                return this.mapManager.getWalls().getChildren().some((w: any) =>
                    Phaser.Math.Distance.Between(x, y, w.x, w.y) < 40
                );
            }
        );

        // 设置碰撞
        this.setupCollisions();

        // 设置输入
        this.inputManager.setup(
            () => this.handleStartGame(),
            () => this.handleRestartGame()
        );

        // 初始状态
        this.stateManager.setState('START');
    }

    private initManagers(): void {
        this.stateManager = new GameStateManager();
        this.stateManager.addListener(this);

        this.mapManager = new MapManager(this);
        this.collisionManager = new CollisionManager(this);
        this.inputManager = new InputManager(this);
        this.uiManager = new UIManager(this);
        this.debugManager = new DebugManager(this);

        this.entityManager = new EntityManager(this);
        this.entityManager.init({
            onPlayerDeath: () => this.handlePlayerDeath(),
            onAllEnemiesDead: () => this.handleAllEnemiesDead()
        });
    }

    private setupCollisions(): void {
        const player = this.entityManager.getPlayer();
        const enemies = this.entityManager.getEnemies();
        const bullets = this.entityManager.getBullets();
        const walls = this.mapManager.getWalls();

        this.collisionManager.setupTankWallCollision(player, enemies, walls);
        this.collisionManager.setupTankTankCollision(player, enemies);
        this.collisionManager.setupBulletEnemyOverlap(bullets, enemies);
        this.collisionManager.setupBulletPlayerOverlap(
            bullets,
            player,
            () => this.handlePlayerHit()
        );
    }

    // 游戏状态监听器实现
    onStateChange(newState: GameState, oldState: GameState): void {
        console.log(`State changed from ${oldState} to ${newState}`);
        this.uiManager.updateStateUI(newState);

        switch (newState) {
            case 'START':
                this.entityManager.pauseEnemies();
                this.entityManager.clearBullets();
                break;
            case 'PLAYING':
                this.entityManager.resumeEnemies();
                this.uiManager.updateHP(this.entityManager.getPlayer().hp);
                break;
            case 'ENDED':
                this.entityManager.stopEnemies();
                this.entityManager.clearBullets();
                break;
        }
    }

    // 事件处理
    private handleStartGame(): void {
        if (this.stateManager.getState() === 'START') {
            this.stateManager.setState('PLAYING');
        }
    }

    private handleRestartGame(): void {
        if (this.stateManager.getState() === 'ENDED') {
            this.scene.restart();
        }
    }

    private handlePlayerHit(): void {
        this.uiManager.updateHP(this.entityManager.getPlayer().hp);
        this.entityManager.checkPlayerHealth();
    }

    private handlePlayerDeath(): void {
        this.stateManager.setState('ENDED');
    }

    private handleAllEnemiesDead(): void {
        if (this.stateManager.isPlaying()) {
            this.stateManager.setState('ENDED');
        }
    }

    update() {
        this.debugTick++;
        if (this.debugTick % 60 === 0) {
            console.log('GameScene.update tick', this.debugTick);
        }

        // 只在游戏进行中更新玩家
        if (this.stateManager.isPlaying()) {
            this.entityManager.updatePlayer();
        }

        // 定期刷新调试绘制
        if (this.debugTick % 10 === 0) {
            this.debugManager.draw(
                this.mapManager.getGrid(),
                this.mapManager['gridWidth'],
                this.mapManager['gridHeight'],
                this.mapManager.getTileSize(),
                this.entityManager.getEnemies()
            );
        }
    }

    // 为Enemy类提供游戏上下文（向后兼容）
    public getGameContext(): IGameContext {
        return this.gameContext;
    }

    // 为Bullet类提供必要的访问器（向后兼容）
    public get walls() {
        return this.mapManager.getWalls();
    }

    public get tileSize() {
        return this.mapManager.getTileSize();
    }

    public get gameState() {
        return this.stateManager.getState();
    }

    public get player() {
        return this.entityManager.getPlayer();
    }

    public hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        return this.mapManager.hasLineOfSight(x1, y1, x2, y2);
    }

    public hasFriendlyBetween(shooter: any, tx: number, ty: number, margin?: number): boolean {
        return this.collisionManager.hasFriendlyBetween(
            shooter, tx, ty, this.entityManager.getEnemies(), margin
        );
    }
}
