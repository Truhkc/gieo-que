# 13 维解读数据集接入说明

命盘页「Mệnh cục / Tình cảm / Sự nghiệp / Tài vận / Sức khoẻ / Tính cách」各标签页、
以及点宫位触发的解读，现在先查上游 **紫微斗数开源解读数据集 v4.0**
（[Renhuai123/ziwei-doushu release `v4.0-13d`](https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d)，CC BY 4.0）
里本盘对应维度的确定性解读原文，把它作为提示词的第一依据交给模型转述成越南语（或用户提问的语言），
出处照抄；倪师原话检索（`lib/ai/knowledge.ts`）照旧附在后面补足。
查不到（1950–2026 以外、数据源没配、对象缺失、网络出错）时自动退回原来的纯 AI 流程。

页面上每条依据数据集的解读下方有「Xem nguyên văn bộ dữ liệu」可展开中文原文，
输入框上方常驻 CC BY 4.0 署名。

## 文件

| 文件 | 作用 |
|------|------|
| `lib/ziwei/interp-dataset.ts` | 取键（排盘日 + 时辰 + 性别）、对象路径、对象格式、署名常量 |
| `lib/ai/interp-dataset.ts` | 服务端查询：本地目录或 R2 私有桶，进程内 LRU，所有失败折成 `{ ok:false, reason }` |
| `lib/storage/r2-sigv4.ts` | R2（S3 接口）SigV4 签名，GET/PUT 共用，用 AWS 官方向量测过 |
| `app/api/interp-dataset/route.ts` | `GET ?y&m&d&h&g&topic` → 一张盘一个维度的原文 |
| `app/api/interpret/route.ts` | 请求体新增可选 `topic`；命中情况见响应头 `x-interp-dataset` |
| `lib/ai/prompts.ts` | `buildInterpretSystem(..., dataset)`：原文放在知识库之前，规定转述与出处规则 |
| `components/InsightPanel.tsx` | 发送当前主题、展开原文、署名 |
| `scripts/dataset/pack-interp-v4.ts` | 下载上游按年 zstd 文件 → 每天一个 brotli 对象 |
| `scripts/dataset/upload-r2.ts` | 把打包结果传到 R2，可断点续传 |
| `scripts/regression/interp-dataset.test.ts` | 取键、回退、签名、提示词拼接 |

## 取键口径

上游生成时没做真太阳时校正，键是「排盘日 + 时辰」。`chart.birthInfo` 的 year/month/day
已经是子时换日后的排盘日，`hour` 是 0–11 的时辰序号，正好对得上。
所以用了真太阳时、子时换日的盘，查到的也是与这张盘同一个排盘日与时辰的解读。

## 存储与成本

全量：28,124 天 × 24 张盘 = 674,976 张盘，打包后约 **3.9 GiB**（平均每天 145 KiB，
brotli q9 / 16MB 窗口）。上游原始数据解压后 57 GB，所以没法打进 Vercel 包里。

选 Cloudflare R2 私有桶：

- 存储 3.9 GiB < 免费额度 10 GB-月 → $0
- 上传 28,125 次 PUT（Class A）< 免费 100 万次/月 → $0
- 线上每次查盘 1 次 GET（Class B），免费 1000 万次/月；同一张盘点不同标签页走进程内缓存，
  `/api/interp-dataset` 命中时还允许 CDN 缓存一天
- 出口流量免费
- 超出免费额度后：存储 $0.015/GB-月，Class B $0.36/百万次

Vercel Blob 的 Hobby 档只有 1 GB 存储、每月 2,000 次上传，放不下。

## 部署步骤

1. 打包（约 35 分钟，需要 Node ≥ 22.15，磁盘留 5 GB）：
   ```bash
   npx tsx scripts/dataset/pack-interp-v4.ts --out D:/ziwei-interp --jobs 4
   ```
2. 在 Cloudflare 控制台建 R2 桶（例如 `ziwei-interp`），再建两个 R2 API 令牌，都只授权这个桶：
   - 可写令牌（Object Read & Write）——只在本机上传时用
   - 只读令牌（Object Read only）——放进 Vercel
3. 上传（用可写令牌）：
   ```bash
   R2_ACCOUNT_ID=… R2_BUCKET=ziwei-interp R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… \
     npx tsx scripts/dataset/upload-r2.ts --dir D:/ziwei-interp
   ```
4. Vercel 项目 → Settings → Environment Variables 加四个变量（只读令牌）：
   `R2_ACCOUNT_ID`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`，然后重新部署。

本地开发不必上 R2：在 `.env.local` 里设 `ZIWEI_INTERP_DIR=D:/ziwei-interp` 即可。

## 许可

数据集 CC BY 4.0，可商用，须署名（页面已常驻署名与链接）。正文里引用的倪海厦《天纪》原话
不在这份授权内：属注明集数与时间码的短引用，著作权归原权利人；成批单独使用按上游第五章
CC BY-NC-SA 4.0 处理。数据集只有中文，越南语是模型转述的。
