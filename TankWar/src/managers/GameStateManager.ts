/**
 * 游戏状态管理器
 * 负责管理游戏状态的转换和状态相关的逻辑
 */
export type GameState = 'START' | 'PLAYING' | 'ENDED' | 'WIN';

export interface GameStateListener {
    onStateChange(newState: GameState, oldState: GameState): void;
}

export class GameStateManager {
    private currentState: GameState = 'START';
    private listeners: GameStateListener[] = [];

    getState(): GameState {
        return this.currentState;
    }

    setState(newState: GameState): void {
        if (this.currentState === newState) return;

        const oldState = this.currentState;
        this.currentState = newState;

        // 通知所有监听器
        this.listeners.forEach(listener => {
            listener.onStateChange(newState, oldState);
        });
    }

    isPlaying(): boolean {
        return this.currentState === 'PLAYING';
    }

    isEnded(): boolean {
        return this.currentState === 'ENDED' || this.currentState === 'WIN';
    }

    addListener(listener: GameStateListener): void {
        this.listeners.push(listener);
    }

    removeListener(listener: GameStateListener): void {
        const index = this.listeners.indexOf(listener);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }
}