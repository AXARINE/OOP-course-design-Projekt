import Phaser from 'phaser';

/**
 * 子弹实体：处理发射、反弹与生命周期管理
 */
export class Bullet extends Phaser.Physics.Arcade.Image {
    private speed: number = 250; // 降低子弹速度，从400降到250
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
        // 计算发射位置
        const spawnX = x + Math.cos(rotation) * 18; // 从坦克中心稍微往外一点的位置发射
        const spawnY = y + Math.sin(rotation) * 18;

        // 获取场景中的墙壁信息，确保子弹不在墙内生成
        const sceneAny = this.scene as any;
        const walls = sceneAny?.walls;
        const tileSize: number = sceneAny?.tileSize ?? 32;

        // 检查新位置是否在墙内，如果是，则调整位置
        let safeSpawnX = spawnX;
        let safeSpawnY = spawnY;

        if (walls) {
            const half = tileSize / 2;
            const children = walls.getChildren() as any[];

            for (const w of children) {
                if (!w || !w.active) continue;

                // 检查子弹是否在墙内
                const wallLeft = w.x - half;
                const wallRight = w.x + half;
                const wallTop = w.y - half;
                const wallBottom = w.y + half;

                if (safeSpawnX >= wallLeft && safeSpawnX <= wallRight &&
                    safeSpawnY >= wallTop && safeSpawnY <= wallBottom) {
                    // 如果子弹在墙内，将其移到最近的墙外位置
                    // 计算四个方向到墙边的距离
                    const distToLeft = safeSpawnX - wallLeft;
                    const distToRight = wallRight - safeSpawnX;
                    const distToTop = safeSpawnY - wallTop;
                    const distToBottom = wallBottom - safeSpawnY;

                    // 找到最小距离的方向
                    const minDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

                    if (minDist === distToLeft) {
                        safeSpawnX = wallLeft - this.radius; // 左边
                    } else if (minDist === distToRight) {
                        safeSpawnX = wallRight + this.radius; // 右边
                    } else if (minDist === distToTop) {
                        safeSpawnY = wallTop - this.radius; // 上边
                    } else { // distToBottom
                        safeSpawnY = wallBottom + this.radius; // 下边
                    }
                }
            }
        }

        // 1. 激活子弹
        this.enableBody(true, safeSpawnX, safeSpawnY, true, true);
        this.setActive(true);
        this.setVisible(true);

        // 记录发射者
        this.owner = owner;
        this.prevX = safeSpawnX;
        this.prevY = safeSpawnY;

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
            this.prevX = this.x;
            this.prevY = this.y;
            return;
        }

        const sx = this.prevX, sy = this.prevY;
        const ex = this.x, ey = this.y;
        if (sx === ex && sy === ey) {
            return;
        }

        const moveLine = new Phaser.Geom.Line(sx, sy, ex, ey);
        let closestDistance = Number.POSITIVE_INFINITY;
        let collisionPoint: Phaser.Math.Vector2 | null = null;
        let collisionNormal: Phaser.Math.Vector2 | null = null;

        const halfTile = tileSize / 2;
        const wallChildren = walls.getChildren();

        for (const wall of wallChildren) {
            if (!wall || !wall.active) continue;

            // 创建墙体的矩形区域
            const wallRect = new Phaser.Geom.Rectangle(
                wall.x - halfTile,
                wall.y - halfTile,
                tileSize,
                tileSize
            );

            // 检测移动路径与墙体的交点
            const intersectionPoints = Phaser.Geom.Intersects.GetLineToRectangle(moveLine, wallRect);
            if (!intersectionPoints || !Array.isArray(intersectionPoints)) continue;

            for (const point of intersectionPoints) {
                // 计算从起点到交点的距离
                const distance = Math.hypot(point.x - sx, point.y - sy);

                // 找到最近的碰撞点
                if (distance < closestDistance) {
                    closestDistance = distance;
                    collisionPoint = new Phaser.Math.Vector2(point.x, point.y);

                    // 计算碰撞法线（基于交点所在的边）
                    const eps = 0.5;
                    const isLeftEdge = Math.abs(point.x - wallRect.left) < eps;
                    const isRightEdge = Math.abs(point.x - wallRect.right) < eps;
                    const isTopEdge = Math.abs(point.y - wallRect.top) < eps;
                    const isBottomEdge = Math.abs(point.y - wallRect.bottom) < eps;

                    let normalX = 0, normalY = 0;

                    // 优先考虑水平边（左右）
                    if (isLeftEdge) normalX = -1;
                    else if (isRightEdge) normalX = 1;

                    // 其次考虑垂直边（上下）
                    if (isTopEdge) normalY = -1;
                    else if (isBottomEdge) normalY = 1;

                    // 如果没有明确的边（角落情况），根据相对位置确定法线
                    if (normalX === 0 && normalY === 0) {
                        const dx = collisionPoint.x - wall.x;
                        const dy = collisionPoint.y - wall.y;
                        // 根据最大偏移量决定反弹方向
                        if (Math.abs(dx) > Math.abs(dy)) {
                            normalX = Math.sign(dx);
                        } else {
                            normalY = Math.sign(dy);
                        }
                    }

                    collisionNormal = new Phaser.Math.Vector2(normalX, normalY);
                }
            }
        }

        // 处理碰撞
        if (collisionPoint && collisionNormal) {
            // 将子弹定位到碰撞点外的安全位置
            const safePush = this.radius + 0.5;
            const safeX = collisionPoint.x + collisionNormal.x * safePush;
            const safeY = collisionPoint.y + collisionNormal.y * safePush;

            this.setPosition(safeX, safeY);
            body.x = safeX - (this.width || 0) / 2;
            body.y = safeY - (this.height || 0) / 2;

            // 计算反射速度
            const velocityX = body.velocity.x;
            const velocityY = body.velocity.y;

            // 使用向量反射公式: v' = v - 2(v·n)n
            const dotProduct = velocityX * collisionNormal.x + velocityY * collisionNormal.y;
            const restitution = 0.95; // 能量损失系数

            const reflectedVx = (velocityX - 2 * dotProduct * collisionNormal.x) * restitution;
            const reflectedVy = (velocityY - 2 * dotProduct * collisionNormal.y) * restitution;

            body.setVelocity(reflectedVx, reflectedVy);
        }

        // 更新上一帧位置用于下一次检测
        this.prevX = this.x;
        this.prevY = this.y;
    }
}//物理实现逻辑由ai辅助修改和增添代码实现