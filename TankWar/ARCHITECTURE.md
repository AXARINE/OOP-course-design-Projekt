# 坦克大战游戏 - 重构架构说明

## 架构概览

本项目已经过重构，采用了更加解耦和模块化的架构设计。主要目标是将原本臃肿的 GameScene 拆分成多个职责单一的管理器，提高代码的可维护性和可扩展性。

## 核心设计原则

1. **单一职责原则 (SRP)**: 每个管理器只负责一个特定的功能领域
2. **依赖倒置原则 (DIP)**: 通过接口和上下文对象解耦具体实现
3. **开闭原则 (OCP)**: 易于扩展新功能，无需修改现有代码
4. **关注点分离**: 游戏逻辑、渲染、输入、UI 等相互独立

## 架构层次

```
┌─────────────────────────────────────────┐
│            GameScene (协调层)            │
│  - 初始化各个管理器                      │
│  - 监听状态变化                          │
│  - 协调各管理器工作                      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          管理器层 (Managers)             │
├─────────────────────────────────────────┤
│  GameStateManager   - 游戏状态管理       │
│  MapManager         - 地图和寻路         │
│  EntityManager      - 实体生命周期       │
│  CollisionManager   - 碰撞检测           │
│  InputManager       - 输入处理           │
│  UIManager          - 界面显示           │
│  DebugManager       - 调试绘制           │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          核心层 (Core)                   │
├─────────────────────────────────────────┤
│  GameContext        - 游戏上下文接口     │
│  - 为实体提供访问游戏服务的统一接口      │
│  - 解耦实体类与场景的直接依赖            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          实体层 (Entities)               │
├─────────────────────────────────────────┤
│  Tank               - 坦克基类           │
│  Player             - 玩家坦克           │
│  EnemyAI            - 敌人坦克(带AI)     │
│  Bullet             - 子弹               │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│          工具层 (Utils)                  │
├─────────────────────────────────────────┤
│  Pathfinder         - A*寻路算法         │
└─────────────────────────────────────────┘
```

## 各模块详细说明

### 1. GameStateManager (游戏状态管理器)

**职责:**
- 管理游戏状态 (`START`, `PLAYING`, `ENDED`)
- 提供状态查询接口
- 通知监听器状态变化

**优点:**
- 集中管理状态逻辑
- 使用观察者模式通知变化
- 易于添加新状态

### 2. MapManager (地图管理器)

**职责:**
- 地图生成（墙体布局）
- 网格系统维护
- 寻路服务 (A* 算法)
- 视线检测
- 坐标转换（世界 ↔ 网格）

**优点:**
- 将地图相关逻辑完全独立
- 提供清晰的寻路 API
- 易于替换地图生成算法

### 3. EntityManager (实体管理器)

**职责:**
- 创建和管理游戏实体（玩家、敌人、子弹）
- 实体生命周期管理
- AI 控制（暂停/恢复）
- 死亡事件处理

**优点:**
- 统一的实体创建入口
- 集中处理实体间关系
- 易于扩展新实体类型

### 4. CollisionManager (碰撞管理器)

**职责:**
- 设置各种碰撞关系
- 处理碰撞回调
- 友军检测（防止误伤）

**优点:**
- 碰撞逻辑集中管理
- 易于调整碰撞规则
- 清晰的碰撞层次

### 5. InputManager (输入管理器)

**职责:**
- 键盘输入监听
- 游戏控制事件（开始、重启）
- Canvas 焦点管理

**优点:**
- 输入逻辑与游戏逻辑分离
- 易于添加新的输入方式
- 支持输入重映射

### 6. UIManager (UI管理器)

**职责:**
- 创建和更新 UI 元素
- 血量显示
- 状态提示文本

**优点:**
- UI 逻辑独立
- 易于主题化和国际化
- 支持动态 UI 更新

### 7. DebugManager (调试管理器)

**职责:**
- 绘制调试信息（网格、路径）
- 可视化 AI 状态

**优点:**
- 调试代码与游戏逻辑分离
- 易于开关调试功能
- 不影响生产代码

### 8. GameContext (游戏上下文)

**职责:**
- 为实体类提供统一的服务访问接口
- 解耦实体与场景的直接依赖

**关键接口:**
```typescript
interface IGameContext {
    findPathWorld(startX, startY, endX, endY): Path | null;
    hasLineOfSight(x1, y1, x2, y2): boolean;
    isCellBlockedWorldSpace(x, y): boolean;
    isPlaying(): boolean;
    getPlayer(): Player;
    getEnemies(): Enemy[];
    hasFriendlyBetween(shooter, tx, ty, margin?): boolean;
}
```

**优点:**
- 实体类不再直接依赖 Scene
- 易于测试（可 mock 上下文）
- 清晰的依赖边界

## 数据流

### 游戏启动流程
```
main.ts
  → GameScene.create()
    → initManagers() - 初始化所有管理器
    → createGameContext() - 创建游戏上下文
    → entityManager.createPlayer()
    → mapManager.createMap()
    → entityManager.spawnEnemies()
    → setupCollisions()
    → uiManager.create()
    → inputManager.setup()
    → stateManager.setState('START')
```

### 状态变化流程
```
InputManager (用户按 Enter)
  → GameScene.handleStartGame()
    → GameStateManager.setState('PLAYING')
      → 通知所有监听器
        → GameScene.onStateChange()
          → EntityManager.resumeEnemies()
          → UIManager.updateStateText()
```

### 敌人 AI 决策流程
```
EnemyAI.update()
  → gameContext.isPlaying() - 检查游戏状态
  → gameContext.getPlayer() - 获取玩家位置
  → gameContext.hasLineOfSight() - 视线检测
  → gameContext.findPathWorld() - 寻路
  → gameContext.hasFriendlyBetween() - 友军检测
  → shoot() - 射击
```

## 扩展性示例

### 添加新的游戏状态
```typescript
// 1. 在 GameStateManager 中添加新状态
type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'ENDED';

// 2. 在 GameScene.onStateChange() 中处理
case 'PAUSED':
    this.entityManager.pauseEnemies();
    this.uiManager.showPauseMenu();
    break;
```

### 添加新的实体类型
```typescript
// 1. 创建新实体类
export class PowerUp extends Phaser.Physics.Arcade.Sprite {
    // ...
}

// 2. 在 EntityManager 中添加管理方法
spawnPowerUp(x: number, y: number): PowerUp {
    const powerup = new PowerUp(this.scene, x, y);
    this.powerups.add(powerup);
    return powerup;
}

// 3. 在 CollisionManager 中设置碰撞
setupPlayerPowerUpOverlap(player, powerups, onCollect);
```

### 添加新的 UI 元素
```typescript
// 在 UIManager 中添加
showMiniMap(): void {
    this.miniMap = this.scene.add.renderTexture(650, 450, 140, 140);
    // ...
}
```

## 性能优化点

1. **对象池**: 子弹使用对象池（maxSize: 30）
2. **更新频率控制**: 调试绘制每 10 帧更新一次
3. **物理引擎优化**: FPS 设为 120，减少穿透
4. **事件驱动**: 使用观察者模式而非轮询
5. **延迟计算**: 只在需要时进行寻路

## 测试友好性

重构后的架构更易于测试：

```typescript
// 测试地图管理器
const mapManager = new MapManager(mockScene);
mapManager.createMap(100, 100);
expect(mapManager.isCellBlockedWorldSpace(10, 10)).toBe(false);

// 测试状态管理器
const stateManager = new GameStateManager();
const mockListener = { onStateChange: jest.fn() };
stateManager.addListener(mockListener);
stateManager.setState('PLAYING');
expect(mockListener.onStateChange).toHaveBeenCalledWith('PLAYING', 'START');

// 测试实体（使用 mock 上下文）
const mockContext: IGameContext = {
    isPlaying: () => true,
    getPlayer: () => mockPlayer,
    // ...
};
const enemy = new EnemyAI(mockScene, 100, 100);
enemy.setContext(mockContext);
```

## 向后兼容性

为了确保平滑过渡，GameScene 保留了一些向后兼容的访问器：

```typescript
// 供旧代码使用
public get walls() { return this.mapManager.getWalls(); }
public get tileSize() { return this.mapManager.getTileSize(); }
public get gameState() { return this.stateManager.getState(); }
public get player() { return this.entityManager.getPlayer(); }
```

这些可以在后续版本中逐步移除。

## 未来改进方向

1. **事件总线**: 引入全局事件总线，进一步解耦模块间通信
2. **配置系统**: 将硬编码的游戏参数提取到配置文件
3. **存档系统**: 添加 SaveManager 处理游戏存档
4. **音效系统**: 添加 AudioManager 管理音效和音乐
5. **粒子特效**: 添加 EffectManager 管理爆炸、烟雾等特效
6. **关卡系统**: 添加 LevelManager 支持多关卡
7. **网络多人**: 添加 NetworkManager 支持联机对战

## 总结

通过这次重构，我们实现了：

✅ **高内聚低耦合**: 每个模块职责明确，相互独立  
✅ **易于维护**: 清晰的代码组织，便于定位和修改  
✅ **易于扩展**: 符合 SOLID 原则，便于添加新功能  
✅ **易于测试**: 模块化设计，支持单元测试  
✅ **代码复用**: 管理器可在其他项目中复用  

这种架构适合中大型游戏项目，能够有效应对需求变化和团队协作。
