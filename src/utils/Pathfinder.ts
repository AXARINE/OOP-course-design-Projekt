export type Grid = number[][]; // 0 = free, 1 = blocked

export interface Node { x: number; y: number; g: number; f: number; parent?: Node }

// 简单的 A*，使用 8 邻域
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
