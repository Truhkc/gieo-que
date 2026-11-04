/**
 * scripts/lib/server-only-stub —— 让 Node 脚本能 import 带 `server-only` 的模块
 *
 * `server-only` 不是装在 node_modules 里的包，是 Next 在编译期处理掉的标记。
 * 直接用 tsx 跑任何 import 了 patterns.ts / chart-input.ts 的脚本都会
 * MODULE_NOT_FOUND，所以先把它解析成空模块。
 *
 * 用法 —— 必须是第一条静态 import，之后用动态 import 取真正的模块：
 *
 *   import './server-only-stub';
 *   const { detectPatterns } = await import('../../lib/ziwei/patterns');
 *
 * 静态 import 会被提升，所以带 server-only 的模块不能写成静态 import，
 * 否则它会在这个钩子注册之前就被解析。
 *
 * （scripts/regression/patterns-sihua-bonus.test.ts 里有一份同样的内联实现；
 *   那是上游既有的回归测试，这里不去动它。）
 */
import * as nodeModule from 'node:module';

type HookResult = { url?: string; format?: string; source?: string; shortCircuit?: boolean };

// module.registerHooks：Node 22.15+ / 23.5+；@types/node 20 还没有它的声明
const { registerHooks } = nodeModule as unknown as {
  registerHooks(hooks: {
    resolve(specifier: string, context: unknown, next: (s: string, c: unknown) => HookResult): HookResult;
    load(url: string, context: unknown, next: (u: string, c: unknown) => HookResult): HookResult;
  }): void;
};

const STUB = 'data:text/javascript,';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: STUB, shortCircuit: true };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === STUB) return { format: 'commonjs', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
