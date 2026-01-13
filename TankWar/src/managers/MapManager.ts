/**
 * 地图管理器
 * 负责地图生成、网格管理和寻路相关功能
 */
import Phaser from 'phaser';
import { findPath as astarFindPath } from '../utils/Pathfinder';
import { RicochetMapGenerator } from '../utils/RicochetMapGenerator';

export class MapManager {
    private scene: Phaser.Scene;
    private walls!: Phaser.Physics.Arcade.StaticGroup;
    private tileSize: number = 32;
    private gridWidth: number = 0;
    private gridHeight: number = 0;
    private grid: number[][] = [];
    private lastSeed: number = 0;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.walls = scene.physics.add.staticGroup();
    }

    getWalls(): Phaser.Physics.Arcade.StaticGroup {
        return this.walls;
    }

    getTileSize(): number {
        return this.tileSize;
    }

    getGrid(): number[][] {
        return this.grid;
    }

    /**
     * 世界坐标映射到网格坐标
     */
    worldToGrid(x: number, y: number): { gx: number; gy: number } {
        return {
            gx: Math.floor(x / this.tileSize),
            gy: Math.floor(y / this.tileSize)
        };
    }

    /**
     * 网格坐标映射到世界坐标（格子中心）
     */
    gridToWorld(gx: number, gy: number): { x: number; y: number } {
        return {
            x: gx * this.tileSize + this.tileSize / 2,
            y: gy * this.tileSize + this.tileSize / 2
        };
    }

    /**
     * 从墙壁生成网格数据
     */
    buildGridFromWalls(): void {
        const width = this.scene.game.config.width as number;
        const height = this.scene.game.config.height as number;
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

    /**
     * 检查世界坐标点是否被墙阻挡
     */
    isCellBlockedWorldSpace(x: number, y: number): boolean {
        const c = this.worldToGrid(x, y);

        if (!this.grid || !this.grid.length) {
            return this.walls.getChildren().some((w: any) => {
                const wc = this.worldToGrid(w.x, w.y);
                return wc.gx === c.gx && wc.gy === c.gy;
            });
        }

        if (c.gx < 0 || c.gx >= this.gridWidth || c.gy < 0 || c.gy >= this.gridHeight) return true;
        return this.grid[c.gy][c.gx] === 1;
    }

    /**
     * 寻路（世界坐标）
     */
    findPathWorld(
        startX: number,
        startY: number,
        endX: number,
        endY: number
    ): Array<{ x: number; y: number }> | null {
        const s = this.worldToGrid(startX, startY);
        const e = this.worldToGrid(endX, endY);

        if (s.gx < 0 || s.gx >= this.gridWidth || s.gy < 0 || s.gy >= this.gridHeight) return null;
        if (e.gx < 0 || e.gx >= this.gridWidth || e.gy < 0 || e.gy >= this.gridHeight) return null;
        if (this.grid[e.gy][e.gx] === 1) return null;

        const raw = astarFindPath(this.grid, { x: s.gx, y: s.gy }, { x: e.gx, y: e.gy });
        if (!raw) return null;

        return raw.map(n => this.gridToWorld(n.x, n.y));
    }

    /**
     * 检查两点之间是否有直线视野
     */
    hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        const s = this.worldToGrid(x1, y1);
        const e = this.worldToGrid(x2, y2);

        if (!this.grid || !this.grid.length) {
            const line = new Phaser.Geom.Line(x1, y1, x2, y2);
            return !this.walls.getChildren().some((w: any) => {
                const rect = new Phaser.Geom.Rectangle(
                    w.x - this.tileSize / 2,
                    w.y - this.tileSize / 2,
                    this.tileSize,
                    this.tileSize
                );
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

    /** - 使用种子约束随机反弹地图算法
     */
    createMap(
        playerX: number,
        playerY: number,
        wallTexture: string = 'wall-texture',
        seed?: number
    ): void {
        this.walls.clear(true, true);

        const worldW = this.scene.game.config.width as number;
        const worldH = this.scene.game.config.height as number;

        // 定义出生点（可扩展为多个出生点）
        const spawnPoints = [
            { x: playerX, y: playerY },
            { x: worldW - playerX, y: playerY },
            { x: playerX, y: worldH - playerY },
            { x: worldW - playerX, y: worldH - playerY }
        ];

        // 使用 Ricochet 地图生成器
        const generator = new RicochetMapGenerator({
            width: worldW,
            height: worldH,
            tileSize: this.tileSize,
            seed,
            targetWallDensity: 0.10,
            minWallsPerRegion: 2,
            maxWallsPerRegion: 8,
            spawnPoints
        });

        const wallSegments = generator.generate();
        this.lastSeed = generator.getSeed();

        // 生成物理对象
        wallSegments.forEach(segment => {
            for (let i = 0; i < segment.length; i++) {
                const gx = segment.orientation === 'h' ? segment.x + i : segment.x;
                const gy = segment.orientation === 'v' ? segment.y + i : segment.y;
                const pos = this.gridToWorld(gx, gy);
                this.walls.create(pos.x, pos.y, wallTexture);
            }
        });

        console.log(
            `🎮 Ricochet map created: seed=${this.lastSeed}, ` +
            `walls=${this.walls.getLength()}, ` +
            `segments=${wallSegments.length} tiles`
        );
    }

    /**
     * 获取最后生成的种子
     */
    getLastSeed(): number {
        return this.lastSeed;
    }

    /**
     * 确保位置不在墙内，返回安全位置
     */
    ensureNotInWall(x: number, y: number): { x: number; y: number } {
        if (!this.isCellBlockedWorldSpace(x, y)) {
            return { x, y };
        }

        const start = this.worldToGrid(x, y);
        const maxR = Math.max(this.gridWidth || 0, this.gridHeight || 0) || 20;

        for (let r = 1; r < maxR; r++) {
            for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const gx = start.gx + dx, gy = start.gy + dy;
                    if (gx < 0 || gy < 0 || gx >= this.gridWidth || gy >= this.gridHeight) continue;
                    const pos = this.gridToWorld(gx, gy);
                    if (!this.isCellBlockedWorldSpace(pos.x, pos.y)) {
                        console.log('ensureNotInWall: found safe cell', gx, gy);
                        return pos;
                    }
                }
            }
        }

        console.warn('ensureNotInWall: unable to find free cell');
        return { x, y };
    }
}
