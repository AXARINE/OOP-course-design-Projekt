/**
 * UI管理器
 * 负责管理游戏界面元素
 */
import Phaser from 'phaser';
import type { GameState } from './GameStateManager';

export class UIManager {
    private scene: Phaser.Scene;
    private hpText!: Phaser.GameObjects.Text;
    private seedText!: Phaser.GameObjects.Text;
    private overlayStart!: Phaser.GameObjects.Container;
    private overlayEnd!: Phaser.GameObjects.Container;
    private screenWidth: number;
    private screenHeight: number;

    constructor(scene: Phaser.Scene) {
        this.scene = scene;
        this.screenWidth = this.scene.scale.width;
        this.screenHeight = this.scene.scale.height;
    }

    /**
     * 创建UI元素
     */
    create(): void {
        this.hpText = this.scene.add.text(10, 10, 'HP: 3', {
            fontSize: '24px',
            color: '#00ff00',
            fontStyle: 'bold'
        }).setDepth(1100).setScrollFactor(0);

        this.seedText = this.scene.add.text(10, 40, 'Seed: ---', {
            fontSize: '12px',
            color: '#888888',
            fontStyle: 'italic'
        }).setDepth(1100).setScrollFactor(0);

        // 覆盖式开始界面
        this.overlayStart = this.buildOverlay(
            '坦克大战',
            '按 Enter 开始\n移动: 方向键 / 射击: 空格'
        );
        // 覆盖式结束界面
        this.overlayEnd = this.buildOverlay(
            '游戏结束',
            '按 R 重启'
        );
        this.overlayStart.setVisible(true);
        this.overlayEnd.setVisible(false);
        this.hpText.setVisible(false);
        this.seedText.setVisible(false);
    }

    /**
     * 更新血量显示
     */
    updateHP(hp: number): void {
        this.hpText.setText(`HP: ${hp}`);
        if (hp <= 1) {
            this.hpText.setColor('#ff0000');
        } else {
            this.hpText.setColor('#00ff00');
        }
    }

    /**
     * 显示地图种子
     */
    showSeed(seed: number): void {
        this.seedText.setText(`Seed: ${seed}`);
        this.seedText.setVisible(true);
    }

    /**
     * 更新状态UI
     */
    updateStateUI(state: GameState): void {
        console.log('UIManager updateStateUI:', state);
        switch (state) {
            case 'START':
                this.showOverlay(this.overlayStart);
                this.hideOverlay(this.overlayEnd);
                this.hpText.setVisible(false);
                this.seedText.setVisible(false);
                this.hpText.setText('HP: 3');
                this.hpText.setColor('#00ff00');
                break;
            case 'PLAYING':
                this.hideOverlay(this.overlayStart);
                this.hideOverlay(this.overlayEnd);
                this.hpText.setVisible(true);
                this.seedText.setVisible(true);
                break;
            case 'ENDED':
                this.hideOverlay(this.overlayStart);
                this.showOverlay(this.overlayEnd);
                this.hpText.setVisible(false);
                this.seedText.setVisible(false);
                break;
        }
    }

    private showOverlay(overlay: Phaser.GameObjects.Container): void {
        overlay.setVisible(true);
        overlay.setActive(true);
        overlay.list.forEach((child: any) => {
            child.setActive(true);
        });
    }

    private hideOverlay(overlay: Phaser.GameObjects.Container): void {
        overlay.setVisible(false);
        overlay.setActive(false);
        overlay.list.forEach((child: any) => {
            child.setActive(false);
        });
    }

    /**
     * 清理UI
     */
    destroy(): void {
        if (this.hpText) {
            this.hpText.destroy();
        }
        if (this.seedText) {
            this.seedText.destroy();
        }
        if (this.overlayStart) {
            this.overlayStart.destroy(true);
        }
        if (this.overlayEnd) {
            this.overlayEnd.destroy(true);
        }
    }

    private buildOverlay(title: string, subtitle: string): Phaser.GameObjects.Container {
        const bg = this.scene.add.rectangle(
            this.screenWidth / 2,
            this.screenHeight / 2,
            this.screenWidth,
            this.screenHeight,
            0x000000,
            0.7
        ).setOrigin(0.5);

        const titleText = this.scene.add.text(
            this.screenWidth / 2,
            this.screenHeight / 2 - 30,
            title,
            {
                fontSize: '42px',
                color: '#ffffff',
                fontStyle: 'bold'
            }
        ).setOrigin(0.5);

        const subText = this.scene.add.text(
            this.screenWidth / 2,
            this.screenHeight / 2 + 25,
            subtitle,
            {
                fontSize: '22px',
                color: '#c0c0c0',
                align: 'center'
            }
        ).setOrigin(0.5);

        const container = this.scene.add.container(0, 0, [bg, titleText, subText]);
        container.setDepth(1000);
        container.setScrollFactor(0);
        return container;
    }
}
