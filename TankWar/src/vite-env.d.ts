/// <reference types="vite/client" />

// 声明 CSS 模块，允许 TypeScript 识别 .css 文件导入
declare module '*.css' {
    const content: string;
    export default content;
}
