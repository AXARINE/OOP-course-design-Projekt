import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function inline() {
    const distDir = resolve(process.cwd(), 'dist');
    const indexPath = resolve(distDir, 'index.html');
    let html = await readFile(indexPath, 'utf8');

    // Inline stylesheet links
    html = await replaceAsync(html, /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, async (m, href) => {
        const cssPath = resolve(distDir, href.replace(/^\//, ''));
        const css = await readFile(cssPath, 'utf8');
        return `<style>${css}</style>`;
    });

    // Remove modulepreload links
    html = html.replace(/<link[^>]*rel=["']modulepreload["'][^>]*>/gi, '');

    // Inline script src (type module or not)
    html = await replaceAsync(html, /<script([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi, async (m, pre, src, post) => {
        const jsPath = resolve(distDir, src.replace(/^\//, ''));
        const js = await readFile(jsPath, 'utf8');
        const typeAttr = /type=/.test(pre + post) ? '' : ' type="module"';
        return `<script${typeAttr}${pre}${post}>\n${js}\n<\/script>`;
    });

    // Output file name: default to tankwar.html, allow override via --out or OUT_NAME env
    const argOut = process.argv.find((a) => a.startsWith('--out='));
    const outName = (argOut ? argOut.split('=')[1] : (process.env.OUT_NAME || 'tankwar.html')).trim();

    // Output directory for the final single-file HTML. Default to dist if no --outdir/OUT_DIR provided.
    const argOutDir = process.argv.find((a) => a.startsWith('--outdir='));
    const outDir = (argOutDir ? argOutDir.split('=')[1] : process.env.OUT_DIR || '').trim();

    let finalOutPath;
    if (outDir) {
        const resolvedOutDir = resolve(process.cwd(), outDir);
        // ensure directory exists
        await import('node:fs/promises').then(({ mkdir }) => mkdir(resolvedOutDir, { recursive: true }));
        finalOutPath = resolve(resolvedOutDir, outName);
    } else {
        finalOutPath = resolve(distDir, outName);
    }

    await writeFile(finalOutPath, html, 'utf8');
    console.log('Generated', finalOutPath);
}

async function replaceAsync(str, regex, asyncFn) {
    const matches = [];
    str.replace(regex, (match, ...args) => {
        const offset = args[args.length - 2];
        matches.push({ match, args: args.slice(0, -2), offset });
        return match;
    });

    // Build result by walking the string and replacing matches
    let cursor = 0;
    let result = '';
    for (const m of matches) {
        const start = str.indexOf(m.match, cursor);
        const end = start + m.match.length;
        result += str.slice(cursor, start);
        const replacement = await asyncFn(m.match, ...m.args);
        result += replacement;
        cursor = end;
    }
    result += str.slice(cursor);
    return result;
}

inline().catch((e) => {
    console.error(e);
    process.exit(1);
});
