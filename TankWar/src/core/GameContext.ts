/**
 * 游戏上下文
 * 提供给实体类访问游戏服务的接口，避免直接依赖场景
 */
import { MapManager } from '../managers/MapManager';
import { GameStateManager } from '../managers/GameStateManager';

export interface IGameContext {
    // 地图相关
    findPathWorld(startX: number, startY: number, endX: number, endY: number): Array<{ x: number; y: number }> | null;
    hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean;
    isCellBlockedWorldSpace(x: number, y: number): boolean;

    // 游戏状态
    isPlaying(): boolean;

    // 实体查询
    getPlayer(): any;
    getEnemies(): any[];
    getBullets(): any; // 添加获取子弹组的方法

    // 友军检测
    hasFriendlyBetween(shooter: any, tx: number, ty: number, margin?: number): boolean;
}

export class GameContext implements IGameContext {
    private mapManager: MapManager;
    private stateManager: GameStateManager;
    private getPlayerFn: () => any;
    private getEnemiesFn: () => any[];
    private getBulletsFn: () => any; // 添加子弹获取函数
    private hasFriendlyBetweenFn: (shooter: any, tx: number, ty: number, margin?: number) => boolean;

    constructor(
        mapManager: MapManager,
        stateManager: GameStateManager,
        getPlayerFn: () => any,
        getEnemiesFn: () => any[],
        getBulletsFn: () => any, // 添加子弹获取函数
        hasFriendlyBetweenFn: (shooter: any, tx: number, ty: number, margin?: number) => boolean
    ) {
        this.mapManager = mapManager;
        this.stateManager = stateManager;
        this.getPlayerFn = getPlayerFn;
        this.getEnemiesFn = getEnemiesFn;
        this.getBulletsFn = getBulletsFn; // 保存子弹获取函数
        this.hasFriendlyBetweenFn = hasFriendlyBetweenFn;
    }

    findPathWorld(startX: number, startY: number, endX: number, endY: number): Array<{ x: number; y: number }> | null {
        return this.mapManager.findPathWorld(startX, startY, endX, endY);
    }

    hasLineOfSight(x1: number, y1: number, x2: number, y2: number): boolean {
        return this.mapManager.hasLineOfSight(x1, y1, x2, y2);
    }

    isCellBlockedWorldSpace(x: number, y: number): boolean {
        return this.mapManager.isCellBlockedWorldSpace(x, y);
    }

    isPlaying(): boolean {
        return this.stateManager.isPlaying();
    }

    getPlayer(): any {
        return this.getPlayerFn();
    }

    getEnemies(): any[] {
        return this.getEnemiesFn();
    }

    getBullets(): any { // 实现获取子弹的方法
        return this.getBulletsFn();
    }

    hasFriendlyBetween(shooter: any, tx: number, ty: number, margin?: number): boolean {
        return this.hasFriendlyBetweenFn(shooter, tx, ty, margin);
    }
}