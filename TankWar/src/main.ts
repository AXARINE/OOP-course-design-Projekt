import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene_new';
import './style.css';

/**
 * 游戏入口：创建并启动 Phaser 游戏实例
 */
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#FFFFFF',
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false }
  },
  scene: [GameScene]
};

new Phaser.Game(config);