/**
 * 种子随机生成器
 * 提供可复现的随机数
 */
export class SeededRandom {
    private seed: number;

    constructor(seed?: number) {
        this.seed = seed || Math.floor(Math.random() * 0xffffffff);
    }

    /**
     * 获取当前种子
     */
    getSeed(): number {
        return this.seed;
    }

    /**
     * 生成下一个随机数 (0 ~ 1)
     * 使用 Mulberry32 算法
     */
    next(): number {
        let x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    /**
     * 生成指定范围的整数 [min, max)
     */
    nextInt(min: number, max: number): number {
        return min + Math.floor(this.next() * (max - min));
    }

    /**
     * 生成指定范围的浮点数 [min, max)
     */
    nextFloat(min: number, max: number): number {
        return min + this.next() * (max - min);
    }

    /**
     * 从数组中随机选择
     */
    choice<T>(arr: T[]): T {
        return arr[this.nextInt(0, arr.length)];
    }

    /**
     * 创建新的独立随机生成器（给定相同种子）
     */
    static create(seed?: number): SeededRandom {
        return new SeededRandom(seed);
    }
}
