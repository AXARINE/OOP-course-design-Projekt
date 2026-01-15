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
        // 检测是否在单文件构建环境中，如果是，则跳过CSS加载
        if (typeof window !== 'undefined' && window.location.pathname.toLowerCase().includes('tankwar.html')) {
            // 在单文件构建中，CSS变量已经通过HTML的<style>标签注入，无需再次加载
            console.log('Detected single-file build, skipping external CSS loading');
        } else {
            // 非单文件构建环境下，仍然加载外部CSS
            this.load.css('game-theme', 'assets/styles/game-theme.css');
        }
        
        this.load.image('custom-tank-texture', 'assets/textures/tank-texture.png');
        this.load.image('custom-enemy-texture', 'assets/textures/enemy-texture.png');
        this.load.image('custom-wall-texture', 'assets/textures/wall-texture.png');
        this.load.image('custom-bullet-texture', 'assets/textures/bullet-texture.png');
        
        this.load.on('complete', () => {
            this.generateTextures();
        });

        this.load.start();
    }

    private getCSSVariable(variableName: string, defaultValue: string): string {
        // 获取根元素上的CSS变量值
        const value = getComputedStyle(document.documentElement)
            .getPropertyValue(variableName)
            .trim();

        // 如果值存在，则返回该值，否则返回默认值
        return value || defaultValue;
    }
    
    private getCSSVariableAsNumber(variableName: string, defaultValue: number): number {
        // 获取CSS变量并转换为数字
        const value = this.getCSSVariable(variableName, String(defaultValue));
        return Number(value) || defaultValue;
    }
    
    private hexToNumber(hex: string): number {
        // 移除 # 符号并转换为数字
        if (hex.startsWith('#')) {
            hex = hex.substring(1);
        }
        return parseInt(hex, 16);
    }

    private generateTextures(): void {
        // 尝试从自定义图片生成纹理，如果不存在则使用CSS变量或默认值生成
        if (!this.textures.exists('tank-texture')) {
            if (this.textures.exists('custom-tank-texture')) {
                this.textures.renameTexture('custom-tank-texture', 'tank-texture');
            } else {
                // 使用CSS变量生成玩家坦克纹理
                const playerColor = this.hexToNumber(this.getCSSVariable('--player-color', '#3f7f5f'));
                const playerTurretColor = this.hexToNumber(this.getCSSVariable('--player-turret-color', '#4c8f68'));
                const playerBarrelColor = this.hexToNumber(this.getCSSVariable('--player-barrel-color', '#333333'));

                // 从CSS变量获取坦克参数
                const tankBodyWidth = this.getCSSVariableAsNumber('--tank-body-width', 30);
                const tankBodyHeight = this.getCSSVariableAsNumber('--tank-body-height', 28);
                const tankBodyOffsetX = this.getCSSVariableAsNumber('--tank-body-offset-x', 2);
                const tankBodyOffsetY = this.getCSSVariableAsNumber('--tank-body-offset-y', 2);
                const tankBodyRadius = this.getCSSVariableAsNumber('--tank-body-radius', 4);
                
                const turretCenterX = this.getCSSVariableAsNumber('--turret-center-x', 16);
                const turretCenterY = this.getCSSVariableAsNumber('--turret-center-y', 16);
                const turretRadius = this.getCSSVariableAsNumber('--turret-radius', 10);
                
                const barrelLength = this.getCSSVariableAsNumber('--barrel-length', 32);
                const barrelWidth = this.getCSSVariableAsNumber('--barrel-width', 6);
                
                const trackWidth = this.getCSSVariableAsNumber('--track-width', 38);
                const trackHeight = this.getCSSVariableAsNumber('--track-height', 6);
                const topTrackOffsetX = this.getCSSVariableAsNumber('--top-track-offset-x', 0);
                const topTrackOffsetY = this.getCSSVariableAsNumber('--top-track-offset-y', 0);
                const bottomTrackOffsetX = this.getCSSVariableAsNumber('--bottom-track-offset-x', 0);
                const bottomTrackOffsetY = this.getCSSVariableAsNumber('--bottom-track-offset-y', 24);

                const graphics = this.make.graphics({ x: 0, y: 0 });

                // 绘制坦克车身 - 旋转90度以使坦克朝右
                // fillRoundedRect(x坐标, y坐标, 宽度, 高度, 圆角半径)
                graphics.fillStyle(playerColor);
                graphics.fillRoundedRect(tankBodyOffsetX, tankBodyOffsetY, tankBodyWidth, tankBodyHeight, tankBodyRadius); // 主体

                // 添加边框效果
                // strokeRoundedRect(x坐标, y坐标, 宽度, 高度, 圆角半径)
                graphics.lineStyle(2, this.hexToNumber(this.getCSSVariable('--wall-border-color', '#3E2723'))); // 线条宽度2，颜色
                graphics.strokeRoundedRect(tankBodyOffsetX, tankBodyOffsetY, tankBodyWidth, tankBodyHeight, tankBodyRadius); // 描边

                // 绘制履带
                graphics.fillStyle(this.hexToNumber('#111111')); // 履带颜色固定为深色
                graphics.fillRect(topTrackOffsetX, topTrackOffsetY, trackWidth, trackHeight); // 上履带
                graphics.fillRect(bottomTrackOffsetX, bottomTrackOffsetY, trackWidth, trackHeight); // 下履带

                // 绘制炮塔 - 精确居中
                graphics.fillStyle(playerTurretColor);
                graphics.fillCircle(turretCenterX, turretCenterY, turretRadius); // 炮塔

                // 添加炮塔边框效果
                graphics.lineStyle(1, this.hexToNumber(this.getCSSVariable('--wall-border-color', '#3E2723'))); // 边框线条宽度1，颜色
                graphics.strokeCircle(turretCenterX, turretCenterY, turretRadius); // 炮塔边框

                // 绘制炮管 - 从炮塔中心向右延伸
                graphics.fillStyle(playerBarrelColor);
                graphics.fillRect(turretCenterX, turretCenterY - barrelWidth / 2, barrelLength, barrelWidth); // 炮管，从炮塔中心向右延伸

                graphics.generateTexture('tank-texture', 32, 32); // 生成32x32像素的纹理
                graphics.clear();
                graphics.destroy();
            }
        }

        if (!this.textures.exists('enemy-texture')) {
            if (this.textures.exists('custom-enemy-texture')) {
                this.textures.renameTexture('custom-enemy-texture', 'enemy-texture');
            } else {
                // 使用CSS变量生成敌人坦克纹理
                const enemyColor = this.hexToNumber(this.getCSSVariable('--enemy-color', '#8B4513'));
                const enemyTurretColor = this.hexToNumber(this.getCSSVariable('--enemy-turret-color', '#A52A2A'));
                const enemyBarrelColor = this.hexToNumber(this.getCSSVariable('--enemy-barrel-color', '#2F1B14'));

                // 从CSS变量获取坦克参数
                const tankBodyWidth = this.getCSSVariableAsNumber('--tank-body-width', 30);
                const tankBodyHeight = this.getCSSVariableAsNumber('--tank-body-height', 28);
                const tankBodyOffsetX = this.getCSSVariableAsNumber('--tank-body-offset-x', 2);
                const tankBodyOffsetY = this.getCSSVariableAsNumber('--tank-body-offset-y', 2);
                const tankBodyRadius = this.getCSSVariableAsNumber('--tank-body-radius', 4);
                
                const turretCenterX = this.getCSSVariableAsNumber('--turret-center-x', 16);
                const turretCenterY = this.getCSSVariableAsNumber('--turret-center-y', 16);
                const turretRadius = this.getCSSVariableAsNumber('--turret-radius', 10);
                
                const barrelLength = this.getCSSVariableAsNumber('--barrel-length', 32);
                const barrelWidth = this.getCSSVariableAsNumber('--barrel-width', 6);
                
                const trackWidth = this.getCSSVariableAsNumber('--track-width', 38);
                const trackHeight = this.getCSSVariableAsNumber('--track-height', 6);
                const topTrackOffsetX = this.getCSSVariableAsNumber('--top-track-offset-x', 0);
                const topTrackOffsetY = this.getCSSVariableAsNumber('--top-track-offset-y', 0);
                const bottomTrackOffsetX = this.getCSSVariableAsNumber('--bottom-track-offset-x', 0);
                const bottomTrackOffsetY = this.getCSSVariableAsNumber('--bottom-track-offset-y', 24);

                const graphics = this.make.graphics({ x: 0, y: 0 });

                // 绘制敌方坦克车身 - 旋转90度以使坦克朝右
                // fillRoundedRect(x坐标, y坐标, 宽度, 高度, 圆角半径)
                graphics.fillStyle(enemyColor);
                graphics.fillRoundedRect(tankBodyOffsetX, tankBodyOffsetY, tankBodyWidth, tankBodyHeight, tankBodyRadius); // 主体

                // 添加边框效果
                // strokeRoundedRect(x坐标, y坐标, 宽度, 高度, 圆角半径)
                graphics.lineStyle(2, this.hexToNumber(this.getCSSVariable('--wall-border-color', '#3E2723'))); // 线条宽度2，颜色
                graphics.strokeRoundedRect(tankBodyOffsetX, tankBodyOffsetY, tankBodyWidth, tankBodyHeight, tankBodyRadius); // 描边

                // 绘制履带
                graphics.fillStyle(this.hexToNumber('#111111')); // 履带颜色固定为深色
                graphics.fillRect(topTrackOffsetX, topTrackOffsetY, trackWidth, trackHeight); // 上履带
                graphics.fillRect(bottomTrackOffsetX, bottomTrackOffsetY, trackWidth, trackHeight); // 下履带

                // 绘制敌方炮塔 - 精确居中
                graphics.fillStyle(enemyTurretColor);
                graphics.fillCircle(turretCenterX, turretCenterY, turretRadius); // 炮塔

                // 添加炮塔边框效果
                graphics.lineStyle(1, this.hexToNumber(this.getCSSVariable('--wall-border-color', '#3E2723'))); // 边框线条宽度1，颜色
                graphics.strokeCircle(turretCenterX, turretCenterY, turretRadius); // 炮塔边框

                // 绘制敌方炮管 - 从炮塔中心向右延伸
                graphics.fillStyle(enemyBarrelColor);
                graphics.fillRect(turretCenterX, turretCenterY - barrelWidth / 2, barrelLength, barrelWidth); // 炮管，从炮塔中心向右延伸

                graphics.generateTexture('enemy-texture', 32, 32); // 生成32x32像素的纹理
                graphics.clear();
                graphics.destroy();
            }
        }

        if (!this.textures.exists('wall-texture')) {
            if (this.textures.exists('custom-wall-texture')) {
                this.textures.renameTexture('custom-wall-texture', 'wall-texture');
            } else {
                // 使用CSS变量生成墙壁纹理
                const wallColor = this.hexToNumber(this.getCSSVariable('--wall-color', '#5D4037'));
                const wallBorderColor = this.hexToNumber(this.getCSSVariable('--wall-border-color', '#3E2723'));

                const graphics = this.make.graphics({ x: 0, y: 0 });
                graphics.fillStyle(wallColor);
                graphics.fillRect(0, 0, 32, 32);
                graphics.lineStyle(2, wallBorderColor);
                graphics.strokeRect(0, 0, 32, 32);
                graphics.generateTexture('wall-texture', 32, 32);
                graphics.clear();
                graphics.destroy();
            }
        }

        if (!this.textures.exists('bullet-texture')) {
            if (this.textures.exists('custom-bullet-texture')) {
                this.textures.renameTexture('custom-bullet-texture', 'bullet-texture');
            } else {
                // 使用CSS变量生成子弹纹理
                const bulletColor = this.hexToNumber(this.getCSSVariable('--bullet-color', '#ffff00'));

                const graphics = this.make.graphics({ x: 0, y: 0 });
                graphics.fillStyle(bulletColor);
                graphics.fillCircle(4, 4, 4);
                graphics.generateTexture('bullet-texture', 8, 8);
                graphics.destroy();
            }
        }
    }

    create() {
        // 使用CSS变量设置背景颜色
        const bgColor = this.getCSSVariable('--background-color', '#e0c213');
        this.add.rectangle(400, 300, 800, 600, this.hexToNumber(bgColor));
        this.physics.world.setFPS(120);
        
        // 设置物理世界的边界
        this.physics.world.setBounds(0, 0, 800, 600);
        this.physics.world.setBoundsCollision(true, true, true, true);

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
            () => this.entityManager.getBullets(), // 添加获取子弹组的函数
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
        /*
        this.debugManager.draw(
            this.mapManager.getGrid(),
            this.mapManager['gridWidth'],
            this.mapManager['gridHeight'],
            this.mapManager.getTileSize(),
            this.entityManager.getEnemies()
        );
        */

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
        if (this.stateManager.getState() === 'ENDED' || this.stateManager.getState() === 'WIN') {
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
            this.stateManager.setState('WIN');
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

        // 定期刷新调试绘制 - 已禁用
        /*
        if (this.debugTick % 10 === 0) {
            this.debugManager.draw(
                this.mapManager.getGrid(),
                this.mapManager['gridWidth'],
                this.mapManager['gridHeight'],
                this.mapManager.getTileSize(),
                this.entityManager.getEnemies()
            );
        }
        */
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