import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve } from 'path';

// 读取CSS文件内容
function readCssFiles(dirPath) {
    const cssFiles = [];
    const files = readdirSync(dirPath);

    for (const file of files) {
        const filePath = `${dirPath}/${file}`;
        const stat = statSync(filePath);

        if (stat.isDirectory()) {
            cssFiles.push(...readCssFiles(filePath));
        } else if (file.endsWith('.css')) {
            cssFiles.push({
                name: file,
                content: readFileSync(filePath, 'utf-8')
            });
        }
    }

    return cssFiles;
}

// 内联资源到HTML
export async function inlineAssets(inputHtmlPath, outputHtmlPath, options = {}) {
    // 读取打包后的HTML内容
    let html = readFileSync(inputHtmlPath, 'utf8');

    // 提取body内容
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/);
    if (!bodyMatch) {
        throw new Error('找不到HTML body标签');
    }
    const bodyContent = bodyMatch[1];

    // 提取head中的样式内容
    const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
    let headContent = '';
    if (headMatch) {
        headContent = headMatch[1]
            .replace(/<title>.*<\/title>/, '')  // 移除title标签
            .replace(/<meta[^>]*charset="[^"]*"[^>]*>/, '')  // 移除charset meta标签
            .replace(/<meta[^>]*name="viewport"[^>]*>/, '')  // 移除viewport meta标签
            .replace(/<link[^>]*rel="icon"[^>]*>/, '')  // 移除favicon链接
            .replace(/<style>[\s\S]*?<\/style>/, (match) => {
                // 保留非CSS变量的样式
                return match.replace(/:root\s*{[\s\S]*?}/g, '');
            })
            .replace(/<script[^>]*src="[^"]*"><\/script>/g, '') // 移除外部脚本引用
            .replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["'][^"']*["'][^>]*>/g, '') // 移除外部CSS引用
            .trim();
    }

    // 读取CSS文件
    const cssFolderPath = options.cssFolder || './public/assets/styles';
    let cssCode = '';
    
    try {
        const cssFiles = readCssFiles(cssFolderPath);
        for (const cssFile of cssFiles) {
            cssCode += `\n/* ${cssFile.name} */\n${cssFile.content}\n`;
        }
    } catch (error) {
        console.log(`无法读取CSS文件夹: ${error.message}`);
    }

    // 直接从dist/assets目录读取所有JS文件
    let jsCode = '';
    try {
        const assetsPath = './dist/assets/';
        const assetsFiles = readdirSync(assetsPath);
        
        // 找到唯一的JS文件
        const jsFiles = assetsFiles.filter(file => file.endsWith('.js'));
        if (jsFiles.length > 0) {
            const jsFile = jsFiles[0]; // 取第一个JS文件
            const scriptPath = `${assetsPath}${jsFile}`;
            console.log(`正在读取JS文件: ${scriptPath}`);
            
            const scriptContent = readFileSync(scriptPath, 'utf8');
            console.log(`JS文件大小: ${scriptContent.length} 字符`);
            
            // 包装JS代码以避免重复初始化
            jsCode = `
                // 防止重复初始化
                if (!window.gameInstance) {
                    window.gameInstance = true;
                    
                    // 确保CSS变量在游戏初始化前加载
                    if (document.querySelector('#game-theme-css')) {
                        // CSS已通过style标签注入，等待DOM和样式加载完成
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', () => {
                                // 延迟一小段时间确保CSS变量已解析
                                setTimeout(() => {
                                    try {
                                        ${scriptContent}
                                    } catch (e) {
                                        console.error('执行游戏代码时出错:', e);
                                    }
                                }, 10);
                            });
                        } else {
                            // DOM已完成加载，直接执行
                            setTimeout(() => {
                                try {
                                    ${scriptContent}
                                } catch (e) {
                                    console.error('执行游戏代码时出错:', e);
                                }
                            }, 10);
                        }
                    } else {
                        // 没有找到CSS，直接执行
                        try {
                            ${scriptContent}
                        } catch (e) {
                            console.error('执行游戏代码时出错:', e);
                        }
                    }
                }
            `;
        } else {
            console.warn('未找到JS文件');
        }
    } catch (err) {
        console.error(`无法读取JS文件: ${err.message}`);
        console.error(`错误堆栈: ${err.stack}`);
    }

    // 生成最终的HTML
    const finalHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tank War</title>
    ${headContent ? headContent + '\n    ' : ''}
    <style id="game-theme-css">
${cssCode}
    </style>
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #000;
        }
        #app {
            display: block;
            margin: 0 auto;
            position: relative;
            /* 确保canvas居中且不会被拉伸变形 */
        }
        #app canvas {
            display: block;
            margin: 0 auto;
            /* 使用max-width防止画布超出容器 */
            max-width: 100%;
        }
    </style>
</head>
<body>
    <div id="app"></div>
    <script>
        // 在这里注入处理后的JavaScript代码
        ${jsCode}
    </script>
</body>
</html>`;

    // 写入输出文件
    writeFileSync(outputHtmlPath, finalHtml);
    console.log(`单文件已生成: ${outputHtmlPath}`);
}

// 导出函数
export default inlineAssets;

// 添加命令行处理
async function inline() {
    const args = process.argv.slice(2);
    const outMatch = args.find(arg => arg.startsWith('--out='));
    const dirMatch = args.find(arg => arg.startsWith('--outdir='));

    const outFile = outMatch ? outMatch.split('=')[1] : 'index.html';
    const outDir = dirMatch ? dirMatch.split('=')[1] : 'dist';  // 修复之前的错误

    const indexPath = resolve('dist', 'index.html');
    const outputPath = resolve(outDir, outFile);

    // 确保输出目录存在
    try {
        const fs = await import('fs');
        fs.mkdirSync(outDir, { recursive: true });
    } catch (e) {
        // 忽略mkdir错误，如果目录已存在
    }

    await inlineAssets(indexPath, outputPath);
}

// 如果直接运行此脚本，则执行内联
if (process.argv[1] && process.argv[1].endsWith('inline-single-html.mjs')) {
    inline().catch(err => {
        console.error(err);
        process.exit(1);
    });
}