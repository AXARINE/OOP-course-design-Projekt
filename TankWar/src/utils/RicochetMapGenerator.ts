/**
 * 地图生成器 - 种子约束随机反弹地图
 * "先乱来，再检查，再微调"算法
 */
import { SeededRandom } from './SeededRandom';

export interface WallSegment {
    x: number;
    y: number;
    length: number;
    orientation: 'h' | 'v'; // h=horizontal, v=vertical
}

export interface MapConfig {
    width: number;
    height: number;
    tileSize: number;
    seed?: number;
    targetWallDensity: number; // 0.08 ~ 0.15
    minWallsPerRegion: number;
    maxWallsPerRegion: number;
    spawnPoints: Array<{ x: number; y: number }>;
}

export class RicochetMapGenerator {
    private config: MapConfig;
    private random: SeededRandom;
    private walls: WallSegment[] = [];
    private gridWidth: number;
    private gridHeight: number;
    private regionSize: number = 64; // 每个区块 64x64 像素
    private regionsH: number;
    private regionsV: number;

    constructor(config: MapConfig) {
        this.config = config;
        this.random = new SeededRandom(config.seed);
        this.gridWidth = Math.ceil(config.width / config.tileSize);
        this.gridHeight = Math.ceil(config.height / config.tileSize);
        this.regionsH = Math.ceil(config.width / this.regionSize);
        this.regionsV = Math.ceil(config.height / this.regionSize);
    }

    /**
     * 生成地图
     */
    generate(): WallSegment[] {
        console.log(`🗺️  Generating ricochet map with seed: ${this.random.getSeed()}`);

        // ① 生成初始短墙
        this._generateWallModules();

        // ② 应用局部密度限制
        this._applyRegionDensityConstraint();

        // ③ 反弹覆盖检测
        const coverage = this._validateRicochetCoverage();
        console.log(`📊 Coverage report:`, coverage);

        // ④ 自动移除直线秒杀
        this._eliminateStraightShotLines();

        console.log(`✅ Map generated with ${this.walls.length} wall segments`);
        return this.walls;
    }

    /**
     * ① 随机生成短墙模块
     */
    private _generateWallModules(): void {
        const targetCells = Math.floor(
            this.gridWidth * this.gridHeight * this.config.targetWallDensity
        );
        let placedCells = 0;

        // 尝试生成短墙
        let attempts = 0;
        const maxAttempts = 300;

        while (placedCells < targetCells && attempts < maxAttempts) {
            attempts++;

            // 随机选择方向
            const orientation = this.random.choice(['h', 'v']) as 'h' | 'v';
            // 2~5 格长
            const length = this.random.nextInt(2, 6);
            // 随机位置
            const maxGx = this.gridWidth - (orientation === 'h' ? length : 1) - 2;
            const maxGy = this.gridHeight - (orientation === 'v' ? length : 1) - 2;

            if (maxGx <= 0 || maxGy <= 0) continue;

            const gx = this.random.nextInt(1, maxGx);
            const gy = this.random.nextInt(1, maxGy);

            // 检查与出生点距离和碰撞
            if (
                this._isTooCloseToSpawn(gx, gy, length, orientation) ||
                this._hasCollision(gx, gy, length, orientation)
            ) {
                continue;
            }

            // 加入墙体
            this.walls.push({ x: gx, y: gy, length, orientation });
            placedCells += length;
        }

        console.log(`  Generated ${this.walls.length} wall modules (${placedCells} cells)`);
    }

    /**
     * ② 局部密度限制
     */
    private _applyRegionDensityConstraint(): void {
        const regionWalls = Array(this.regionsV)
            .fill(null)
            .map(() => Array(this.regionsH).fill(0));

        // 统计每个区块的墙数
        this.walls.forEach(wall => {
            const regX = Math.floor((wall.x * this.config.tileSize) / this.regionSize);
            const regY = Math.floor((wall.y * this.config.tileSize) / this.regionSize);
            if (regX < this.regionsH && regY < this.regionsV) {
                regionWalls[regY][regX] += wall.length;
            }
        });

        // 移除超标区块的墙
        const removed: number[] = [];
        this.walls = this.walls.filter((wall, idx) => {
            const regX = Math.floor((wall.x * this.config.tileSize) / this.regionSize);
            const regY = Math.floor((wall.y * this.config.tileSize) / this.regionSize);
            const count = regionWalls[regY]?.[regX] ?? 0;

            if (count > this.config.maxWallsPerRegion) {
                removed.push(idx);
                regionWalls[regY][regX] -= wall.length;
                return false;
            }
            return true;
        });

        console.log(`  Applied density constraint, removed ${removed.length} segments`);
    }

    /**
     * ③ 反弹覆盖检测
     */
    private _validateRicochetCoverage(): {
        avgCoverage: number;
        coverageBySpawn: number[];
    } {
        const coverageBySpawn: number[] = [];

        // 为每个出生点计算覆盖率
        this.config.spawnPoints.forEach((spawn, idx) => {
            const coverage = this._calcCoverageFromPoint(spawn.x, spawn.y);
            coverageBySpawn.push(coverage);
            console.log(`  Spawn ${idx}: ${(coverage * 100).toFixed(1)}% coverage`);
        });

        const avgCoverage =
            coverageBySpawn.reduce((a, b) => a + b, 0) / coverageBySpawn.length;
        return { avgCoverage, coverageBySpawn };
    }

    /**
     * 从某点发射射线并计算覆盖率
     */
    private _calcCoverageFromPoint(
        worldX: number,
        worldY: number,
        rayCount: number = 24,
        maxBounces: number = 4
    ): number {
        const covered = new Set<string>();
        const gridX = Math.floor(worldX / this.config.tileSize);
        const gridY = Math.floor(worldY / this.config.tileSize);

        for (let i = 0; i < rayCount; i++) {
            const angle = (i / rayCount) * Math.PI * 2;
            this._traceRay(gridX, gridY, angle, maxBounces, covered);
        }

        const totalCells = this.gridWidth * this.gridHeight;
        return covered.size / totalCells;
    }

    /**
     * 追踪一条射线及其反弹
     */
    private _traceRay(
        startX: number,
        startY: number,
        angle: number,
        maxBounces: number,
        covered: Set<string>
    ): void {
        let x = startX;
        let y = startY;
        let currentAngle = angle;
        let bounces = 0;

        while (bounces < maxBounces) {
            // 向前推进
            const vx = Math.cos(currentAngle);
            const vy = Math.sin(currentAngle);

            for (let step = 0; step < 20; step++) {
                x += vx * 0.5;
                y += vy * 0.5;

                const gx = Math.floor(x);
                const gy = Math.floor(y);

                if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
                    return;
                }

                covered.add(`${gx},${gy}`);

                // 检查碰撞
                if (this._isCellBlocked(gx, gy)) {
                    // 反弹
                    const normal = this._getNormalAt(gx, gy);
                    currentAngle = this._reflectAngle(currentAngle, normal);
                    bounces++;
                    break;
                }
            }
        }
    }

    /**
     * ④ 自动移除直线秒杀路径
     */
    private _eliminateStraightShotLines(): void {
        const spawnCount = this.config.spawnPoints.length;
        let wallsAdded = 0;

        for (let i = 0; i < spawnCount; i++) {
            for (let j = i + 1; j < spawnCount; j++) {
                const p1 = this.config.spawnPoints[i];
                const p2 = this.config.spawnPoints[j];

                // 检查直线射击
                if (this._hasDirectLine(p1.x, p1.y, p2.x, p2.y)) {
                    // 在中间插入遮挡墙
                    this._insertBlockingWall(p1.x, p1.y, p2.x, p2.y);
                    wallsAdded++;
                }
            }
        }

        console.log(`  Eliminated ${wallsAdded} direct shot lines`);
    }

    /**
     * 检测两点间是否有直线射击路径（无阻挡）
     */
    private _hasDirectLine(x1: number, y1: number, x2: number, y2: number): boolean {
        const g1x = Math.floor(x1 / this.config.tileSize);
        const g1y = Math.floor(y1 / this.config.tileSize);
        const g2x = Math.floor(x2 / this.config.tileSize);
        const g2y = Math.floor(y2 / this.config.tileSize);

        const dx = g2x - g1x;
        const dy = g2y - g1y;
        const steps = Math.max(Math.abs(dx), Math.abs(dy));

        for (let i = 0; i <= steps; i++) {
            const t = steps === 0 ? 0 : i / steps;
            const gx = Math.round(g1x + dx * t);
            const gy = Math.round(g1y + dy * t);

            if (this._isCellBlocked(gx, gy)) {
                return false; // 有阻挡
            }
        }

        return true; // 直线通畅
    }

    /**
     * 在两点间插入遮挡墙
     */
    private _insertBlockingWall(x1: number, y1: number, x2: number, y2: number): void {
        const g1x = Math.floor(x1 / this.config.tileSize);
        const g1y = Math.floor(y1 / this.config.tileSize);
        const g2x = Math.floor(x2 / this.config.tileSize);
        const g2y = Math.floor(y2 / this.config.tileSize);

        // 在中点附近放置短墙
        const midX = Math.floor((g1x + g2x) / 2);
        const midY = Math.floor((g1y + g2y) / 2);

        // 随机偏移
        const offsetX = this.random.nextInt(-2, 3);
        const offsetY = this.random.nextInt(-2, 3);
        const wx = midX + offsetX;
        const wy = midY + offsetY;

        // 随机方向和长度
        const orientation = this.random.choice(['h', 'v']) as 'h' | 'v';
        const length = this.random.nextInt(2, 4);

        // 检查有效性
        if (wx >= 0 && wx < this.gridWidth && wy >= 0 && wy < this.gridHeight) {
            if (!this._hasCollision(wx, wy, length, orientation)) {
                this.walls.push({ x: wx, y: wy, length, orientation });
            }
        }
    }

    /**
     * 检查位置是否靠近出生点
     */
    private _isTooCloseToSpawn(
        gx: number,
        gy: number,
        _length: number,
        _orientation: 'h' | 'v'
    ): boolean {
        const margin = 3; // 至少 3 格距离
        return this.config.spawnPoints.some(spawn => {
            const sgx = Math.floor(spawn.x / this.config.tileSize);
            const sgy = Math.floor(spawn.y / this.config.tileSize);
            const dist = Math.hypot(gx - sgx, gy - sgy);
            return dist < margin;
        });
    }

    /**
     * 检查墙体是否碰撞
     */
    private _hasCollision(
        gx: number,
        gy: number,
        length: number,
        orientation: 'h' | 'v'
    ): boolean {
        for (let i = 0; i < length; i++) {
            const cx = orientation === 'h' ? gx + i : gx;
            const cy = orientation === 'v' ? gy + i : gy;
            if (this._isCellBlocked(cx, cy)) {
                return true;
            }
        }
        return false;
    }

    /**
     * 检查网格单元是否被墙占据
     */
    private _isCellBlocked(gx: number, gy: number): boolean {
        if (gx < 0 || gx >= this.gridWidth || gy < 0 || gy >= this.gridHeight) {
            return true;
        }

        return this.walls.some(wall => {
            if (wall.orientation === 'h') {
                return gy === wall.y && gx >= wall.x && gx < wall.x + wall.length;
            } else {
                return gx === wall.x && gy >= wall.y && gy < wall.y + wall.length;
            }
        });
    }

    /**
     * 获取单元的法向量（用于反弹计算）
     */
    private _getNormalAt(gx: number, gy: number): { nx: number; ny: number } {
        // 简化版：根据周围单元判断
        const above = this._isCellBlocked(gx, gy - 1);
        const below = this._isCellBlocked(gx, gy + 1);
        const left = this._isCellBlocked(gx - 1, gy);
        const right = this._isCellBlocked(gx + 1, gy);

        if (above && !below) return { nx: 0, ny: 1 };
        if (below && !above) return { nx: 0, ny: -1 };
        if (left && !right) return { nx: 1, ny: 0 };
        if (right && !left) return { nx: -1, ny: 0 };

        return { nx: 0, ny: 1 }; // default up
    }

    /**
     * 反射角度
     */
    private _reflectAngle(angle: number, normal: { nx: number; ny: number }): number {
        const vx = Math.cos(angle);
        const vy = Math.sin(angle);
        const dot = vx * normal.nx + vy * normal.ny;
        const rx = vx - 2 * dot * normal.nx;
        const ry = vy - 2 * dot * normal.ny;
        return Math.atan2(ry, rx);
    }

    /**
     * 获取随机种子
     */
    getSeed(): number {
        return this.random.getSeed();
    }
}
