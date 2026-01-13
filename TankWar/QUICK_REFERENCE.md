# 重构后项目结构快速参考

## 📁 项目结构

```
TankWar/
├── src/
│   ├── core/                    # 核心接口层
│   │   └── GameContext.ts       # 游戏上下文接口
│   │
│   ├── managers/                # 管理器层
│   │   ├── GameStateManager.ts  # 游戏状态管理
│   │   ├── MapManager.ts        # 地图与寻路
│   │   ├── EntityManager.ts     # 实体管理
│   │   ├── CollisionManager.ts  # 碰撞管理
│   │   ├── InputManager.ts      # 输入管理
│   │   ├── UIManager.ts         # UI管理
│   │   └── DebugManager.ts      # 调试管理
│   │
│   ├── entities/                # 实体层
│   │   ├── Tank.ts              # 坦克基类
│   │   ├── Player.ts            # 玩家坦克
│   │   ├── Enemy.ts             # 原敌人类(已废弃)
│   │   ├── EnemyAI.ts           # 新敌人类(解耦)
│   │   └── Bullet.ts            # 子弹
│   │
│   ├── scenes/                  # 场景层
│   │   ├── Gamescene.ts         # 旧场景(已废弃)
│   │   └── GameScene_new.ts     # 新场景(已启用)
│   │
│   ├── utils/                   # 工具层
│   │   └── Pathfinder.ts        # A*寻路算法
│   │
│   ├── main.ts                  # 入口文件
│   └── style.css                # 样式
│
├── ARCHITECTURE.md              # 架构说明文档
├── REFACTORING_SUMMARY.md       # 重构总结
└── README.md                    # 项目说明
```

## 🔧 核心管理器速查

### GameStateManager
```typescript
const stateManager = new GameStateManager();
stateManager.setState('PLAYING');          // 设置状态
stateManager.isPlaying();                  // 检查是否游戏中
stateManager.addListener(listener);        // 添加监听器
```

### MapManager
```typescript
const mapManager = new MapManager(scene);
mapManager.createMap(playerX, playerY);    // 生成地图
mapManager.buildGridFromWalls();           // 构建网格
mapManager.findPathWorld(x1, y1, x2, y2);  // 寻路
mapManager.hasLineOfSight(x1, y1, x2, y2); // 视线检测
```

### EntityManager
```typescript
const entityManager = new EntityManager(scene);
entityManager.init({ onPlayerDeath, onAllEnemiesDead });
entityManager.createPlayer(x, y);          // 创建玩家
entityManager.spawnEnemy(x, y);            // 生成敌人
entityManager.pauseEnemies();              // 暂停敌人AI
entityManager.resumeEnemies();             // 恢复敌人AI
```

### CollisionManager
```typescript
const collisionManager = new CollisionManager(scene);
collisionManager.setupTankWallCollision(player, enemies, walls);
collisionManager.setupBulletEnemyOverlap(bullets, enemies);
collisionManager.hasFriendlyBetween(shooter, tx, ty, enemies);
```

### UIManager
```typescript
const uiManager = new UIManager(scene);
uiManager.create();                        // 创建UI
uiManager.updateHP(hp);                    // 更新血量
uiManager.updateStateText(state);          // 更新状态文本
```

### InputManager
```typescript
const inputManager = new InputManager(scene);
inputManager.setup(
    () => handleStartGame(),               // 开始游戏回调
    () => handleRestartGame()              // 重启游戏回调
);
```

## 🎮 使用示例

### 添加新的游戏状态
```typescript
// 1. 修改 GameStateManager.ts
export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'ENDED';

// 2. 在 GameScene 的 onStateChange 中处理
onStateChange(newState: GameState, oldState: GameState): void {
    switch (newState) {
        case 'PAUSED':
            this.entityManager.pauseEnemies();
            this.uiManager.showPauseMenu();
            break;
    }
}
```

### 添加新的UI元素
```typescript
// 在 UIManager.ts 中添加
private scoreText!: Phaser.GameObjects.Text;

create(): void {
    // ... 现有代码 ...
    this.scoreText = this.scene.add.text(10, 40, 'Score: 0', {
        fontSize: '20px',
        color: '#ffffff'
    });
}

updateScore(score: number): void {
    this.scoreText.setText(`Score: ${score}`);
}
```

### 添加新的实体类型
```typescript
// 1. 创建实体类 entities/PowerUp.ts
export class PowerUp extends Phaser.Physics.Arcade.Sprite {
    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, 'powerup-texture');
        scene.add.existing(this);
        scene.physics.add.existing(this);
    }
}

// 2. 在 EntityManager.ts 中添加
private powerups!: Phaser.Physics.Arcade.Group;

init(): void {
    // ... 现有代码 ...
    this.powerups = this.scene.physics.add.group();
}

spawnPowerUp(x: number, y: number): PowerUp {
    const powerup = new PowerUp(this.scene, x, y);
    this.powerups.add(powerup);
    return powerup;
}

// 3. 在 CollisionManager.ts 中添加碰撞
setupPlayerPowerUpOverlap(
    player: Player,
    powerups: Phaser.Physics.Arcade.Group,
    onCollect: () => void
): void {
    this.scene.physics.add.overlap(player, powerups, (p, powerup) => {
        (powerup as PowerUp).destroy();
        onCollect();
    });
}
```

## 🐛 调试技巧

### 查看游戏状态
```typescript
console.log('Current State:', this.stateManager.getState());
```

### 查看实体数量
```typescript
console.log('Enemies:', this.entityManager.getEnemies().getLength());
console.log('Bullets:', this.entityManager.getBullets().getLength());
```

### 启用/禁用调试绘制
```typescript
// 在 DebugManager.ts 中修改
private showGrid: boolean = true;    // 显示网格
private showPaths: boolean = true;   // 显示路径
```

### 查看寻路结果
```typescript
const path = this.mapManager.findPathWorld(x1, y1, x2, y2);
console.log('Path found:', path ? path.length : 'none');
```

## 📝 常见任务

### 修改敌人数量
```typescript
// 在 GameScene_new.ts 的 create() 中
const enemyCount = Phaser.Math.Between(2, 5); // 改为你想要的数量
```

### 修改地图密度
```typescript
// 在 MapManager.ts 的 createMap() 中
const maxWallCells = Math.floor(colsWorld * rowsWorld * 0.10); // 10%改为其他值
```

### 修改游戏难度
```typescript
// 在 EnemyAI.ts 中
this.moveSpeed = 100;        // 敌人移动速度
this.fireDelay = 2000;       // 射击间隔（毫秒）
this.rotationSpeedDeg = 180; // 转向速度
```

### 修改玩家属性
```typescript
// 在 Player.ts 中
this.hp = 3;              // 初始血量
this.moveSpeed = 150;     // 移动速度
this.rotateSpeed = 200;   // 旋转速度
```

## 🧪 测试检查清单

- [ ] 游戏启动正常
- [ ] 按 Enter 开始游戏
- [ ] 玩家可以移动和射击
- [ ] 敌人AI正常工作
- [ ] 碰撞检测正常
- [ ] 子弹反弹正常
- [ ] 血量显示正确
- [ ] 游戏结束后可以按R重启
- [ ] 无控制台错误

## 🔗 相关文档

- [架构设计详解](./ARCHITECTURE.md)
- [重构总结](./REFACTORING_SUMMARY.md)
- [Phaser 3 文档](https://photonstorm.github.io/phaser3-docs/)

## 💡 最佳实践

1. **添加新功能时**，优先考虑放在哪个管理器
2. **修改现有功能时**，只修改相关管理器
3. **避免跨层访问**，使用 GameContext 接口
4. **保持管理器独立**，减少相互依赖
5. **使用类型安全**，充分利用 TypeScript
