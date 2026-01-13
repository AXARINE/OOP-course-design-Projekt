/**
 * 调试绘制管理器
 * 负责绘制调试信息（网格、路径等）
 */
import Phaser from 'phaser';

export class DebugManager {
    private scene: Phaser.Scene;
    private graphics!: Phaser.GameObjects.Graphics;
    private showGrid: boolean = true;
    private showPaths: boolean = true;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
    }

    /**
     * 创建调试图形
     */
    create(): void {
        this.graphics = this.scene.add.graphics();
        this.graphics.setDepth(100);
    }

    /**
     * 绘制调试信息
     */
    draw(
        grid: number[][],
        gridWidth: number,
        gridHeight: number,
        tileSize: number,
        enemies: Phaser.Physics.Arcade.Group
    ): void {
        try {
            if (!this.graphics) return;
            this.graphics.clear();

            // 绘制网格
            if (this.showGrid && Array.isArray(grid) && grid.length) {
                for (let gy = 0; gy < gridHeight; gy++) {
                    const row = grid[gy];
                    if (!row) continue;
                    for (let gx = 0; gx < gridWidth; gx++) {
                        if (row[gx] === 1) {
                            const x = gx * tileSize;
                            const y = gy * tileSize;
                            this.graphics.fillStyle(0x883333, 0.6);
                            this.graphics.fillRect(x, y, tileSize, tileSize);
                        }
                    }
                }
            }

            // 绘制敌人路径
            if (this.showPaths && enemies && typeof enemies.getChildren === 'function') {
                const children = enemies.getChildren();
                if (Array.isArray(children)) {
                    children.forEach((en: any) => {
                        if (en && Array.isArray(en.path) && en.path.length) {
                            const p = en.path as Array<{ x: number; y: number }>;
                            this.graphics.lineStyle(2, 0x00ffff, 0.9);
                            for (let i = 0; i < p.length - 1; i++) {
                                const a = p[i], b = p[i + 1];
                                if (!a || !b) continue;
                                this.graphics.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
                            }
                            p.forEach(n => {
                                if (!n) return;
                                this.graphics.fillStyle(0x00ffff, 1);
                                this.graphics.fillCircle(n.x, n.y, 4);
                            });

                            // 绘制瞄准方向
                            const aim = typeof (en as any).getAimAngle === 'function'
                                ? (en as any).getAimAngle()
                                : (en as any).aimAngle;
                            if (typeof aim === 'number' && !isNaN(aim)) {
                                const sx = en.x, sy = en.y;
                                const ex = sx + Math.cos(aim) * 20;
                                const ey = sy + Math.sin(aim) * 20;
                                this.graphics.lineStyle(2, 0xff00ff, 0.9);
                                this.graphics.strokeLineShape(new Phaser.Geom.Line(sx, sy, ex, ey));
                                this.graphics.fillStyle(0xff00ff, 1);
                                this.graphics.fillCircle(ex, ey, 3);
                            }
                        }
                    });
                }
            }
        } catch (err) {
            console.error('drawDebug encountered error:', err);
        }
    }

    /**
     * 清理
     */
    destroy(): void {
        if (this.graphics) {
            this.graphics.destroy();
        }
    }
}
