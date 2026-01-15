# TankWar — OOP 课程设计（坦克大战）

本仓库是一个基于 TypeScript + Phaser 的教学示例，展示面向对象设计、游戏实体管理、寻路与弹道反射地图生成算法（Ricochet）。

## 项目简介

这是一个坦克战斗游戏，玩家控制坦克与AI敌人进行战斗。游戏特色包括：
- AI坦克具有寻路和智能追踪能力
- 弹道反射机制，子弹可以反弹
- 可配置的主题样式，支持通过CSS变量自定义外观
- 完整的碰撞检测和物理系统

## 技术栈
- 语言：TypeScript
- 渲染 / 物理：Phaser 3（Arcade Physics）
- 构建：Vite
- 设计模式：面向对象编程、管理器模式、上下文模式

## 项目结构
- `src/`：源代码
	- `core/`
		- `GameContext.ts`：游戏上下文接口与实现，向实体暴露寻路、视线、游戏状态与查询玩家/敌人等服务。
	- `entities/`
		- `Tank.ts`：坦克基类，封装移动、转向、射击（shoot）、受伤（takeDamage）等通用逻辑。
		- `Player.ts`：玩家控制的坦克，处理输入绑定与每帧更新（update）。
		- `EnemyAI.ts`：敌方 AI 坦克，包含周期性决策（aiLogic）、每帧行为（update）、射击判定（getAimAngle）。
		- `Bullet.ts`：子弹实体，负责发射（fire）、反弹检测与速度反射（update）、回收（deactivate）。
	- `managers/`
		- `MapManager.ts`：地图与网格管理，负责生成地图（createMap）、构建网格（buildGridFromWalls）、寻路（findPathWorld）、视线检测（hasLineOfSight）等。
		- `EntityManager.ts`：实体工厂与容器，创建玩家/敌人/子弹，管理敌人生成、暂停/恢复、子弹清理（init、createPlayer、spawnEnemy、updatePlayer 等）。
		- `CollisionManager.ts`：设置各种碰撞/重叠回调（坦克-墙、坦克-坦克、子弹-敌人、子弹-玩家），并提供 hasFriendlyBetween 用于射线友军过滤。
		- `GameStateManager.ts`：游戏状态机（`START|PLAYING|ENDED`），管理状态监听器与查询（setState、isPlaying）。
		- `InputManager.ts`：输入绑定与全局按键（Enter/R）处理。
		- `UIManager.ts`：UI 元素创建与状态更新（血量、种子、开始/结束覆盖层）。
		- `DebugManager.ts`：调试绘制（用于可视化网格/路径）。
	- `scenes/`
		- `GameScene_new.ts`：主场景，负责资源预生成、初始化所有管理器、创建玩家/敌人、设置碰撞与游戏循环，并将 GameContext 提供给实体。
	- `utils/`
		- `Pathfinder.ts`：简单 A* 实现（8 邻域），用于网格寻路。
		- `RicochetMapGenerator.ts`：基于种子的随机反弹地图生成器，实现射线反弹覆盖检测与局部密度控制。
		- `SeededRandom.ts`：可复现的伪随机数生成器（Mulberry32 风格封装）。

## 主要类与方法（简要）
- GameContext：桥接器，方法包括 findPathWorld、hasLineOfSight、isCellBlockedWorldSpace、isPlaying、getPlayer、getEnemies、hasFriendlyBetween。
- Tank：基类，关键方法 setBullets、shoot(aim?)、takeDamage；属性有 hp、team、moveSpeed 等。
- Player：覆盖 update，处理键盘输入、旋转与发射。
- EnemyAI：包含 aiLogic（周期决策）、update（每帧行为）、pauseAI / resumeAI、getAimAngle；使用 GameContext 做寻路与视线/友军检测。
- Bullet：fire 初始化速度与碰撞体，update 做射线-矩形相交检测并处理速度反射，deactivate 回收。
- MapManager：createMap（生成墙体）、buildGridFromWalls（建立寻路网格）、findPathWorld（调用 Pathfinder）、hasLineOfSight、ensureNotInWall。
- EntityManager：init、createPlayer、spawnEnemy、spawnEnemies、updatePlayer、clearBullets 等管理实体生命周期的函数。
- CollisionManager：setupTankWallCollision、setupTankTankCollision、setupBulletEnemyOverlap、setupBulletPlayerOverlap、hasFriendlyBetween。

## 功能特性

### 游戏玩法
- 玩家控制坦克移动和射击
- AI敌人会自动追踪玩家
- 子弹具有反弹特性，可以在墙壁上反射
- 多种游戏状态（开始、游戏中、结束）

### 可定制化
- 支持通过CSS变量自定义游戏外观
- 坦克颜色、子弹颜色、背景颜色等都可以通过 `public/assets/styles/game-theme.css` 修改
- 支持自定义纹理替换

### AI行为
- 寻路算法：AI能够找到到达玩家的路径
- 视线检测：AI可以检测是否能看到玩家
- 智能射击：AI会瞄准玩家并射击

## 如何运行（本地）
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

---
最后更新时间：2026-01-15