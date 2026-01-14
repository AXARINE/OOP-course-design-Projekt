import Phaser from 'phaser';

/**
 * 子弹实体：处理发射、反弹与生命周期管理
 */
export class Bullet extends Phaser.Physics.Arcade.Image {
    private speed: number = 400;
    private owner?: any; // 发射者引用，用于避免自伤或友伤
    private lifespanTimer?: Phaser.Time.TimerEvent | null = null;
    private prevX: number = 0;
    private prevY: number = 0;
    private radius: number = 4;

    constructor(scene: Phaser.Scene) {
        super(scene, 0, 0, 'bullet-texture');
    }

    /**
     * 发射子弹并初始化物理属性
     * @param x 世界坐标 x
     * @param y 世界坐标 y
     * @param rotation 朝向（弧度）
     * @param owner 发射者引用（用于碰撞过滤）
     */
    fire(x: number, y: number, rotation: number, owner?: any) {
        // 1. 激活子弹
        this.enableBody(true, x, y, true, true);
        this.setActive(true);
        this.setVisible(true);

        // 记录发射者
        this.owner = owner;
        this.prevX = x;
        this.prevY = y;

        // 2. 设置角度和速度
        this.setRotation(rotation);
        // 这里的 rotation 是弧度，Phaser 会自动计算 X 和 Y 的速度分量
        this.scene.physics.velocityFromRotation(rotation, this.speed, this.body!.velocity);

        // 让子弹在世界边界和墙上弹开；并使用圆形碰撞体减少穿墙
        const body = this.body as Phaser.Physics.Arcade.Body;
        if (body) {
            body.setCircle(this.radius); // 半径4的圆形碰撞体，自动居中
            body.setCollideWorldBounds(true);
            body.setBounce(1);
            body.setDrag(0);
            body.setAllowGravity(false);
        }

        // 生命期：5 秒后销毁（如果还存在的话）
        if (this.lifespanTimer) {
            this.lifespanTimer.remove(false);
            this.lifespanTimer = null;
        }
        this.lifespanTimer = this.scene.time.delayedCall(5000, () => {
            this.deactivate();
        });
    }

    /** 读取发射者（碰撞过滤用） */
    public getOwner() {
        return this.owner;
    }

    /**
     * 回收子弹并清理关联资源
     */
    public deactivate() {
        if (this.lifespanTimer) {
            try { this.lifespanTimer.remove(false); } catch (e) { /* ignore */ }
            this.lifespanTimer = null;
        }
        this.disableBody(true, true);
        this.owner = undefined;
    }

    /** 每帧更新：使用射线检测避免高速穿透墙体 */
    update(_time: number, _delta: number) {
        const sceneAny = this.scene as any;
        const walls = sceneAny?.walls;
        const tileSize: number = sceneAny?.tileSize ?? 32;
        const body = this.body as Phaser.Physics.Arcade.Body | undefined;
        if (!body || !walls) {
            this.prevX = this.x; this.prevY = this.y;
            return;
        }

        const sx = this.prevX, sy = this.prevY;
        const ex = this.x, ey = this.y;
        if (sx === ex && sy === ey) {
            return;
        }

        const moveLine = new Phaser.Geom.Line(sx, sy, ex, ey);
        let earliestDist = Number.POSITIVE_INFINITY;
        let hitPoint: Phaser.Math.Vector2 | null = null;
        let hitNormal: { nx: number; ny: number } | null = null;

        const half = tileSize / 2;
        const children = walls.getChildren() as any[];
        for (const w of children) {
            if (!w || !w.active) continue;
            const rect = new Phaser.Geom.Rectangle(w.x - half, w.y - half, tileSize, tileSize);
            const ips = Phaser.Geom.Intersects.GetLineToRectangle(moveLine, rect) as any[] | false;
            if (ips && ips.length) {
                for (const p of ips) {
                    const dx = p.x - sx;
                    const dy = p.y - sy;
                    const dist = Math.hypot(dx, dy);
                    if (dist < earliestDist) {
                        earliestDist = dist;
                        hitPoint = new Phaser.Math.Vector2(p.x, p.y);

                        const eps = 0.5;
                        const onLeft = Math.abs(p.x - rect.left) < eps;
                        const onRight = Math.abs(p.x - rect.right) < eps;
                        const onTop = Math.abs(p.y - rect.top) < eps;
                        const onBottom = Math.abs(p.y - rect.bottom) < eps;
                        let nx = 0, ny = 0;
                        if (onLeft) nx = -1; else if (onRight) nx = 1;
                        if (onTop) ny = -1; else if (onBottom) ny = 1;
                        if (nx === 0 && ny === 0) {
                            const cx = w.x, cy = w.y;
                            if (Math.abs(p.x - cx) > Math.abs(p.y - cy)) nx = Math.sign(p.x - cx); else ny = Math.sign(p.y - cy);
                        }
                        hitNormal = { nx, ny };
                    }
                }
            }
        }

        if (hitPoint && hitNormal) {
            // 将子弹放到碰撞点外沿法线方向的安全位置
            const push = this.radius + 0.5;
            const newX = hitPoint.x + hitNormal.nx * push;
            const newY = hitPoint.y + hitNormal.ny * push;
            this.setPosition(newX, newY);
            body.x = newX - (this.width || 0) / 2;
            body.y = newY - (this.height || 0) / 2;

            // 反射速度
            const vx = body.velocity.x, vy = body.velocity.y;
            const dot = vx * hitNormal.nx + vy * hitNormal.ny;
            let rvx = vx - 2 * dot * hitNormal.nx;
            let rvy = vy - 2 * dot * hitNormal.ny;
            const restitution = 0.95;
            rvx *= restitution; rvy *= restitution;
            body.setVelocity(rvx, rvy);
        }

        // 记录为下一帧起点
        this.prevX = this.x;
        this.prevY = this.y;
    }
}