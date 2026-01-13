import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene_new';
import './style.css'; // 确保你目录下有 style.css，如果没有可以删掉这行

const config: Phaser.Types.Core.GameConfig = {
  // 自动选择渲染模式 (WebGL 或 Canvas)
  type: Phaser.AUTO,

  // 游戏画布尺寸
  width: 800,
  height: 600,

  // 挂载到 index.html 中的 <div id="app">
  parent: 'app',

  // 背景颜色 (纯黑)
  backgroundColor: '#000000',

  // === 关键：物理引擎配置 ===
  // 如果没有这一段，坦克绝对动不了！
  physics: {
    default: 'arcade', // 使用 Arcade 物理引擎
    arcade: {
      gravity: { x: 0, y: 0 }, // 俯视视角不需要重力
      debug: true // 【调试模式】开启后，你会看到坦克外面有个紫色/绿色的框
    }
  },

  // 加载场景
  scene: [GameScene]
};

// 启动游戏
new Phaser.Game(config);