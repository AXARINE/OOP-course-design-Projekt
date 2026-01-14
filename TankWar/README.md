# TankWar — OOP 课程设计（坦克大战）

本仓库是一个基于 TypeScript + Phaser 的教学示例，展示面向对象设计、游戏实体管理、寻路与弹道反射地图生成算法（Ricochet）。

**快速概览**
- 语言：TypeScript
- 渲染 / 物理：Phaser 3（Arcade Physics）
- 构建：Vite

**项目结构**
- `src/`：源代码
	- `core/`
		- `GameContext.ts`：游戏上下文接口与实现，向实体暴露寻路、视线、游戏状态与查询玩家/敌人等服务。
	- `entities/`
		- `Tank.ts`：坦克基类，封装移动、转向、射击（`shoot()`）、受伤（`takeDamage()`）等通用逻辑。
		- `Player.ts`：玩家控制的坦克，处理输入绑定与每帧更新（`update()`）。
		- `EnemyAI.ts`：敌方 AI 坦克，包含周期性决策（`aiLogic()`）、寻路与追逐行为、射击判定（`update()`、`getAimAngle()`）。
		- `Bullet.ts`：子弹实体，负责发射（`fire()`）、反弹检测与速度反射（`update()`）、回收（`deactivate()`）。
	- `managers/`
		- `MapManager.ts`：地图与网格管理，负责生成地图（`createMap()`）、构建网格（`buildGridFromWalls()`）、寻路（`findPathWorld()`）、视线检测（`hasLineOfSight()`）等。
		- `EntityManager.ts`：实体工厂与容器，创建玩家/敌人/子弹，管理敌人生成、暂停/恢复、子弹清理（`init()`、`createPlayer()`、`spawnEnemy()`、`updatePlayer()` 等）。
		- `CollisionManager.ts`：设置各种碰撞/重叠回调（坦克-墙、坦克-坦克、子弹-敌人、子弹-玩家），并提供 `hasFriendlyBetween()` 用于射线友军过滤。
		- `GameStateManager.ts`：游戏状态机（`START|PLAYING|ENDED`），管理状态监听器与查询（`setState()`、`isPlaying()`）。
		- `InputManager.ts`：输入绑定与全局按键（Enter/R）处理。
		- `UIManager.ts`：UI 元素创建与状态更新（血量、种子、开始/结束覆盖层）。
		- `DebugManager.ts`：调试绘制（用于可视化网格/路径）。
	- `scenes/`
		- `GameScene_new.ts`：主场景，负责资源预生成、初始化所有管理器、创建玩家/敌人、设置碰撞与游戏循环，并将 `GameContext` 提供给实体。
	- `utils/`
		- `Pathfinder.ts`：简单 A* 实现（8 邻域），用于网格寻路。
		- `RicochetMapGenerator.ts`：基于种子的随机反弹地图生成器，实现射线反弹覆盖检测与局部密度控制。
		- `SeededRandom.ts`：可复现的伪随机数生成器（Mulberry32 风格封装）。

**主要类与方法（简要）**
- `GameContext`：桥接器，方法包括 `findPathWorld()`、`hasLineOfSight()`、`isCellBlockedWorldSpace()`、`isPlaying()`、`getPlayer()`、`getEnemies()`、`hasFriendlyBetween()`。
- `Tank`：基类，关键方法 `setBullets()`、`shoot(aim?)`、`takeDamage()`；属性有 `hp`、`team`、`moveSpeed` 等。
- `Player`：覆盖 `update()`，处理键盘输入、旋转与发射。
- `EnemyAI`：包含 `aiLogic()`（周期决策）、`update()`（每帧行为）、`pauseAI()` / `resumeAI()`、`getAimAngle()`；使用 `GameContext` 做寻路与视线/友军检测。
- `Bullet`：`fire()` 初始化速度与碰撞体，`update()` 做射线-矩形相交检测并处理速度反射，`deactivate()` 回收。
- `MapManager`：`createMap()`（生成墙体）、`buildGridFromWalls()`（建立寻路网格）、`findPathWorld()`（调用 `Pathfinder`）、`hasLineOfSight()`、`ensureNotInWall()`。
- `EntityManager`：`init()`、`createPlayer()`、`spawnEnemy()`、`spawnEnemies()`、`updatePlayer()`、`clearBullets()` 等管理实体生命周期的函数。
- `CollisionManager`：`setupTankWallCollision()`、`setupTankTankCollision()`、`setupBulletEnemyOverlap()`、`setupBulletPlayerOverlap()`、`hasFriendlyBetween()`。

**如何运行（本地）**
1. 安装依赖：

```bash
npm install
```

2. 本地开发：

```bash
npm run dev
```

3. 打包：

```bash
npm run build
```

如果你希望我只删除特定的 `.md` 文件而不是全部（我已删除仓库根目录下的部分辅助文档），或希望我把 README 调整为英文/更简洁版，请告诉我具体偏好。

---
最后更新时间：2026-01-14