/**
 * scripts/dev/print-chart-context —— 打印模型实际看到的那段盘
 *
 * 解读质量首先取决于喂进去的上下文对不对。改了 chart-context.ts 或 prompts.ts
 * 之后，用这个脚本肉眼核一遍，比对着界面猜要快。
 *
 *   npx tsx scripts/dev/print-chart-context.ts 1990 5 9 3 male
 *   npx tsx scripts/dev/print-chart-context.ts --prompt    # 连系统提示词一起打印
 *   npx tsx scripts/dev/print-chart-context.ts --heming    # 合盘上下文
 *
 * 第四个参数是**时辰地支索引 0–11**，不是 0–23 的小时数。
 */
import './../lib/server-only-stub';
import { generateChart } from '../../lib/ziwei/algorithm';
import type { BirthInfo } from '../../lib/ziwei/types';

const argv = process.argv.slice(2);
const withPrompt = argv.includes('--prompt');
const withHeming = argv.includes('--heming');
const nums = argv.filter(a => !a.startsWith('--'));

const info: BirthInfo = {
  year: Number(nums[0] ?? 1990),
  month: Number(nums[1] ?? 5),
  day: Number(nums[2] ?? 9),
  hour: Number(nums[3] ?? 3),
  gender: (nums[4] as 'male' | 'female') ?? 'male',
};

async function main(): Promise<void> {
  // 带 server-only 的模块必须动态 import，见 scripts/lib/server-only-stub.ts
  const { sanitizeChart } = await import('../../lib/ziwei/chart-input');
  const { buildChartContext, buildHemingContext } = await import('../../lib/ziwei/chart-context');
  const { buildInterpretSystem, buildHemingKnowledge } = await import('../../lib/ai/prompts');

  // 过一遍 sanitizeChart，顺带确认引擎产出的盘能原样通过接口校验层
  const roundTrip = (b: BirthInfo) => sanitizeChart(JSON.parse(JSON.stringify(generateChart(b))));
  const chart = roundTrip(info);

  if (withHeming) {
    const other = roundTrip({ ...info, year: info.year + 2, gender: info.gender === 'male' ? 'female' : 'male' });
    console.log(buildHemingContext(chart, other));
    if (withPrompt) {
      console.log('\n\n======== 合盘知识库 ========\n');
      console.log(buildHemingKnowledge(chart, other));
    }
  } else if (withPrompt) {
    console.log(buildInterpretSystem(buildChartContext(chart)));
  } else {
    console.log(buildChartContext(chart));
  }
}

main().catch(err => { console.error(err); process.exit(1); });
