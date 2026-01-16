export type Grid = number[][]; // 0 = free, 1 = blocked

export interface Node { x: number; y: number; g: number; f: number; parent?: Node }

// 简单的 A*，使用 8 邻域,使用ai辅助完成，解决敌方坦克太笨的问题
export function findPath(grid: Grid, start: { x: number, y: number }, goal: { x: number, y: number }): Array<{ x: number, y: number }> | null {
    const h = (a: { x: number, y: number }, b: { x: number, y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

    const inBounds = (p: { x: number, y: number }) => p.x >= 0 && p.x < grid[0].length && p.y >= 0 && p.y < grid.length;
    const passable = (p: { x: number, y: number }) => inBounds(p) && grid[p.y][p.x] === 0;

    const key = (p: { x: number, y: number }) => `${p.x},${p.y}`;

    const open: Map<string, Node> = new Map();
    const closed: Set<string> = new Set();

    const startNode: Node = { x: start.x, y: start.y, g: 0, f: h(start, goal) };
    open.set(key(start), startNode);

    const neighbors = [
        { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
        { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }
    ];

    while (open.size > 0) {
        // get node with lowest f
        let currentKey = '';
        let currentNode: Node | null = null;
        for (const [k, n] of open.entries()) {
            if (!currentNode || n.f < currentNode.f) {
                currentNode = n;
                currentKey = k;
            }
        }

        if (!currentNode) break;

        open.delete(currentKey);
        closed.add(currentKey);

        if (currentNode.x === goal.x && currentNode.y === goal.y) {
            // reconstruct path
            const path: Array<{ x: number, y: number }> = [];
            let cur: Node | undefined = currentNode;
            while (cur) {
                path.push({ x: cur.x, y: cur.y });
                cur = cur.parent;
            }
            path.reverse();
            return path;
        }

        for (const n of neighbors) {
            const nx = currentNode.x + n.x;
            const ny = currentNode.y + n.y;
            const np = { x: nx, y: ny };
            const nk = key(np);
            if (closed.has(nk)) continue;
            if (!passable(np)) continue;

            const tentativeG = currentNode.g + h(currentNode, np);

            const existing = open.get(nk);
            if (!existing || tentativeG < existing.g) {
                const neighborNode: Node = { x: nx, y: ny, g: tentativeG, f: tentativeG + h(np, goal), parent: currentNode };
                open.set(nk, neighborNode);
            }
        }
    }

    return null;
}

// 新的真实世界坐标系寻路算法
export interface Obstacle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Point {
    x: number;
    y: number;
}

/**
 * 检查点是否在障碍物内部
 */
function isPointInObstacle(point: Point, obstacle: Obstacle): boolean {
    const halfWidth = obstacle.width / 2;
    const halfHeight = obstacle.height / 2;
    
    return (
        point.x >= obstacle.x - halfWidth &&
        point.x <= obstacle.x + halfWidth &&
        point.y >= obstacle.y - halfHeight &&
        point.y <= obstacle.y + halfHeight
    );
}

/**
 * 检查线段是否与障碍物相交
 */
function lineIntersectsObstacle(start: Point, end: Point, obstacle: Obstacle): boolean {
    const halfWidth = obstacle.width / 2;
    const halfHeight = obstacle.height / 2;
    
    const rectX1 = obstacle.x - halfWidth;
    const rectY1 = obstacle.y - halfHeight;
    const rectX2 = obstacle.x + halfWidth;
    const rectY2 = obstacle.y + halfHeight;
    
    // 检查线段是否与矩形的四条边相交
    // 左边
    if (linesIntersect(start.x, start.y, end.x, end.y, rectX1, rectY1, rectX1, rectY2)) {
        return true;
    }
    // 右边
    if (linesIntersect(start.x, start.y, end.x, end.y, rectX2, rectY1, rectX2, rectY2)) {
        return true;
    }
    // 上边
    if (linesIntersect(start.x, start.y, end.x, end.y, rectX1, rectY1, rectX2, rectY1)) {
        return true;
    }
    // 下边
    if (linesIntersect(start.x, start.y, end.x, end.y, rectX1, rectY2, rectX2, rectY2)) {
        return true;
    }
    
    // 检查线段是否完全在矩形内部
    if (isPointInObstacle(start, obstacle) || isPointInObstacle(end, obstacle)) {
        return true;
    }
    
    return false;
}

/**
 * 判断两条线段是否相交
 */
function linesIntersect(
    x1: number, y1: number, 
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number
): boolean {
    // 计算线段的方向
    const ccw = (a: [number, number], b: [number, number], c: [number, number]): boolean => {
        return (c[1] - a[1]) * (b[0] - a[0]) > (b[1] - a[1]) * (c[0] - a[0]);
    };
    
    const a: [number, number] = [x1, y1];
    const b: [number, number] = [x2, y2];
    const c: [number, number] = [x3, y3];
    const d: [number, number] = [x4, y4];
    
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

/**
 * 使用可见点图算法的真实世界寻路
 */
export function findPathWorld(
    startX: number, 
    startY: number, 
    endX: number, 
    endY: number, 
    getWalls: () => Phaser.Types.Physics.Arcade.GameObjectWithBody[]
): Point[] | null {
    // 将墙壁转换为障碍物
    const obstacles: Obstacle[] = [];
    const walls = getWalls();
    
    walls.forEach(wall => {
        // 检查wall是否有效，并且拥有x和y属性
        if (wall && wall.active && typeof wall.body !== 'undefined' && 
            typeof (wall.body as Phaser.Physics.Arcade.Body).x === 'number' && 
            typeof (wall.body as Phaser.Physics.Arcade.Body).y === 'number') {
            obstacles.push({
                x: (wall.body as Phaser.Physics.Arcade.Body).x,
                y: (wall.body as Phaser.Physics.Arcade.Body).y,
                width: 32, // 假设墙壁是32x32的方块
                height: 32
            });
        }
    });
    
    // 检查起点和终点是否在障碍物内部
    for (const obstacle of obstacles) {
        if (isPointInObstacle({ x: startX, y: startY }, obstacle) || 
            isPointInObstacle({ x: endX, y: endY }, obstacle)) {
            return null; // 起点或终点在障碍物内部，无法寻路
        }
    }
    
    // 如果起点到终点之间无障碍，则直接返回路径
    let hasObstacle = false;
    for (const obstacle of obstacles) {
        if (lineIntersectsObstacle({ x: startX, y: startY }, { x: endX, y: endY }, obstacle)) {
            hasObstacle = true;
            break;
        }
    }
    
    if (!hasObstacle) {
        return [{ x: startX, y: startY }, { x: endX, y: endY }];
    }
    
    // 生成可见点图的节点（障碍物的顶点）
    const nodes: Point[] = [
        { x: startX, y: startY },
        { x: endX, y: endY }
    ];
    
    for (const obstacle of obstacles) {
        const halfWidth = obstacle.width / 2;
        const halfHeight = obstacle.height / 2;
        
        // 添加障碍物的四个顶点
        nodes.push({ x: obstacle.x - halfWidth, y: obstacle.y - halfHeight }); // 左上
        nodes.push({ x: obstacle.x + halfWidth, y: obstacle.y - halfHeight }); // 右上
        nodes.push({ x: obstacle.x - halfWidth, y: obstacle.y + halfHeight }); // 左下
        nodes.push({ x: obstacle.x + halfWidth, y: obstacle.y + halfHeight }); // 右下
    }
    
    // 使用A*算法在可见点图中寻路
    const openSet: { point: Point, g: number, f: number, parent: number | null }[] = [];
    const closedSet = new Set<number>();
    
    // 启发式函数（欧几里得距离）
    const heuristic = (a: Point, b: Point): number => {
        return Math.hypot(a.x - b.x, a.y - b.y);
    };
    
    // 检查两个点之间是否有障碍物
    const isClearPath = (a: Point, b: Point): boolean => {
        for (const obstacle of obstacles) {
            if (lineIntersectsObstacle(a, b, obstacle)) {
                return false;
            }
        }
        return true;
    };
    
    // 将起点加入开放集合
    openSet.push({
        point: { x: startX, y: startY },
        g: 0,
        f: heuristic({ x: startX, y: startY }, { x: endX, y: endY }),
        parent: null
    });
    
    while (openSet.length > 0) {
        // 找到f值最小的节点
        let currentIdx = 0;
        for (let i = 1; i < openSet.length; i++) {
            if (openSet[i].f < openSet[currentIdx].f) {
                currentIdx = i;
            }
        }
        
        const current = openSet[currentIdx];
        const currentPoint = current.point;
        const currentIndex = nodes.findIndex(n => n.x === currentPoint.x && n.y === currentPoint.y);
        
        // 检查是否到达终点
        if (currentIndex === 1 || (currentPoint.x === endX && currentPoint.y === endY)) { // currentIndex === 1 表示终点
            // 重构路径
            const path: Point[] = [];
            let curr: typeof current | null = current;
            const visited = new Set<string>(); // 防止无限循环
            
            while (curr !== null) {
                const key = `${curr.point.x},${curr.point.y}`;
                if (visited.has(key)) break; // 防止无限循环
                visited.add(key);
                
                path.unshift({ x: curr.point.x, y: curr.point.y });
                
                if (curr.parent !== null) {
                    const parentNode = nodes[curr.parent];
                    if (parentNode) {
                        const parentIdx = openSet.findIndex(item => 
                            item.point.x === parentNode.x && 
                            item.point.y === parentNode.y
                        );
                        
                        if (parentIdx !== -1) {
                            curr = openSet[parentIdx];
                        } else {
                            // 如果在openSet中找不到父节点，尝试直接在nodes中找
                            curr = null;
                        }
                    } else {
                        curr = null;
                    }
                } else {
                    curr = null;
                }
            }
            
            return path;
        }
        
        // 从开放集合中移除当前节点
        openSet.splice(currentIdx, 1);
        closedSet.add(currentIndex);
        
        // 遍历所有可见的邻居节点
        for (let i = 0; i < nodes.length; i++) {
            if (i === currentIndex || closedSet.has(i)) continue;
            
            const neighbor = nodes[i];
            
            // 检查是否可以通过直线到达邻居节点
            if (isClearPath(currentPoint, neighbor)) {
                const tentativeG = current.g + heuristic(currentPoint, neighbor);
                
                // 检查邻居是否已经在开放集合中
                const existingIdx = openSet.findIndex(item => 
                    item.point.x === neighbor.x && item.point.y === neighbor.y
                );
                
                if (existingIdx === -1) {
                    // 邻居不在开放集合中，添加它
                    openSet.push({
                        point: neighbor,
                        g: tentativeG,
                        f: tentativeG + heuristic(neighbor, { x: endX, y: endY }),
                        parent: i  // 记录节点索引而不是当前索引
                    });
                } else {
                    // 邻居已在开放集合中，检查新路径是否更好
                    if (tentativeG < openSet[existingIdx].g) {
                        openSet[existingIdx].g = tentativeG;
                        openSet[existingIdx].f = tentativeG + heuristic(neighbor, { x: endX, y: endY });
                        openSet[existingIdx].parent = i;  // 更新父节点索引
                    }
                }
            }
        }
    }
    
    // 没有找到路径
    return null;
}