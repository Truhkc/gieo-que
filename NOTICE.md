# NOTICE — Nguồn và giấy phép của bên thứ ba / 第三方来源与许可

Repo này (Truhkc/gieo-que, bản tiếng Việt) dùng mã nguồn, dữ liệu và văn bản của các bên dưới đây.
Mỗi mục ghi rõ: lấy từ đâu, giấy phép gì, nằm ở đâu trong repo, và đã thay đổi gì.

本仓库使用了以下第三方的代码、数据与文本。每一项写明来源、许可、在仓库中的位置，以及做过的改动。

---

## 1. Mã nguồn gốc / 上游代码 — Renhuai123/ziwei-doushu

- **Nguồn**: https://github.com/Renhuai123/ziwei-doushu
- **Giấy phép**: MIT License — Copyright (c) 2026 紫微研究. Toàn văn: [LICENSE](./LICENSE)
- **Phạm vi**: phần lớn `lib/`, `app/`, `components/` (engine lập lá số, an sao, tứ hoá, cách cục, giao diện).
- **Thay đổi**: Việt hoá giao diện (`lib/i18n/`), thêm giờ mặt trời thật cho Việt Nam, thêm backend AI
  (`app/api/interpret`, `app/api/heming`, `lib/ai/`), gộp trang Kinh Dịch, và tích hợp bộ dữ liệu giải đoán (mục 2).

## 2. 紫微斗数开源解读数据集 v4.0 (bộ dữ liệu giải đoán 13 chiều)

- **Nguồn**: https://github.com/Renhuai123/ziwei-doushu/releases/tag/v4.0-13d
- **Tác giả / 作者**: 王多鱼AI
- **Giấy phép**: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) — được dùng cả cho mục đích thương mại,
  yêu cầu duy nhất là ghi nguồn. Điều khoản đầy đủ: [DATASET-LICENSE](./DATASET-LICENSE)
- **Câu trích dẫn theo yêu cầu của tác giả** (hiển thị dưới mỗi phần giải đoán dựa trên bộ dữ liệu, trong `components/InsightPanel.tsx`):

  > 本项目使用了 紫微斗数开源解读数据集 v4.0（674,976 张命盘 × 13 维）
  > 来源：https://github.com/Renhuai123/ziwei-doushu
  > 作者：王多鱼AI

- **Cách dùng**: dữ liệu **không** nằm trong repo. Server đọc trực tiếp file `year-YYYY.jsonl.zst` từ GitHub release
  lúc chạy (hoặc từ bản đóng gói lại trên Cloudflare R2 / thư mục local, xem [docs/INTERP-DATASET.md](./docs/INTERP-DATASET.md)).
- **Thay đổi** (CC BY 4.0 yêu cầu ghi rõ): văn bản gốc tiếng Trung được AI chuyển ngữ sang tiếng Việt và sắp xếp lại
  theo các mục của từng chủ đề; người dùng có thể mở nguyên văn tiếng Trung ngay dưới phần giải đoán.
  Script `scripts/dataset/pack-interp-v4.ts` có thể đóng gói lại dữ liệu thành mỗi ngày một file brotli (không đổi nội dung).
- **Ngoại lệ**: lời thầy Nghê Hải Hạ được trích trong bộ dữ liệu **không** thuộc phạm vi CC BY 4.0 — xem mục 3.

## 3. 倪海厦《天纪》紫微斗数原话库 (kho trích dẫn lời thầy Nghê Hải Hạ)

- **Nguồn**: https://github.com/Renhuai123/nihai-tianji-corpus (commit `462faa4`), qua bản phân giảng trong repo gốc
- **Giấy phép**: [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — được trích dẫn và đăng lại khi ghi nguồn;
  **không dùng cho mục đích thương mại**; tác phẩm phái sinh phải dùng cùng giấy phép. Toàn văn: [docs/tianji-ziwei/LICENSE.md](./docs/tianji-ziwei/LICENSE.md)
- **Bản quyền nội dung gốc**: thuộc ông Nghê Hải Hạ (倪海厦) và người thừa kế quyền. Mỗi trích dẫn kèm số buổi giảng và mốc thời gian,
  liên kết về video gốc trên Bilibili.
- **Phạm vi**: `docs/tianji-ziwei/` (1.848 trích dẫn), `lib/ai/tianji-corpus.generated.ts` (sinh từ `entries.jsonl`
  bằng `scripts/build-tianji-corpus.ts`), được `lib/ai/knowledge.ts` truy xuất làm căn cứ cho phần giải đoán AI.
- **Thay đổi**: không sửa nội dung trích dẫn; chỉ chuyển sang module TypeScript để đóng gói. Khi trả lời bằng tiếng Việt,
  AI dịch/diễn giải các trích dẫn và giữ nguyên nguồn (số buổi, mốc thời gian).
- **Lưu ý**: điều khoản phi thương mại (NC) áp dụng cho phần này. Nếu trang web có hoạt động thương mại,
  cần xem lại việc dùng kho trích dẫn này. Giao diện ghi nguồn kho này ở chân khung giải đoán.

## 4. Cổ tịch / 古籍原文 — 骨髓赋、紫微斗数全集、紫微斗数全书

- **Nguồn**: văn bản cổ thời Minh – Thanh, được repo gốc chỉnh lý (mục 1)
- **Giấy phép**: Public Domain (phạm vi công cộng) theo repo gốc, xem mục 九「协议」trong [README.md](./README.md)
- **Phạm vi**: `lib/classics/data/gusuifu.ts`, `quanji.ts`, `quanshu.ts`; trang `/library`
- **Lưu ý**: phần chú giải của thầy Nghê gắn với một số đoạn (`lib/classics/types.ts`) thuộc mục 3, không phải public domain.

## 5. Google Dịch (dịch máy khi chưa cấu hình AI)

- **Dịch vụ**: endpoint công khai của Google Dịch bản web, `translate.googleapis.com/translate_a/single?client=gtx`
  (không cần API key; nhiều thư viện trên GitHub dùng cách này).
- **Phạm vi**: `lib/ai/translate.ts`, `lib/ai/dataset-fallback.ts`. Chỉ dùng khi trang **chưa cấu hình AI**:
  nội dung tiếng Trung của bộ dữ liệu (mục 2) được dịch máy sang tiếng Việt, tên sao / tên cung được giữ theo
  âm Hán-Việt bằng bảng `lib/i18n/terms.ts`.
- **Lưu ý**: đây **không** phải API chính thức của Google và việc gọi tự động trái điều khoản dịch vụ của Google;
  Google có thể giới hạn hoặc chặn bất cứ lúc nào. Khi đó trang tự hiển thị nguyên văn tiếng Trung.
  Muốn ổn định lâu dài, chuyển sang Google Cloud Translation / Azure Translator (có key) hoặc cấu hình AI.
- Phần dịch máy được ghi rõ là "bản dịch máy (Google Dịch)" ngay đầu nội dung hiển thị.

## 6. Thư viện npm chính / 主要依赖

| Gói | Giấy phép | Tác giả / nguồn |
|-----|-----------|-----------------|
| [iztro](https://github.com/SylarLong/iztro) | MIT | SylarLong — engine an sao Tử Vi |
| [lunar-javascript](https://github.com/6tail/lunar-javascript) | MIT | 6tail — lịch âm, can chi, tiết khí |
| [next](https://github.com/vercel/next.js) | MIT | Vercel |
| [react](https://github.com/facebook/react), react-dom | MIT | Meta |
| [framer-motion](https://github.com/motiondivision/motion) | MIT | Matt Perry |
| [html2canvas](https://github.com/niklasvh/html2canvas) | MIT | Niklas von Hertzen |
| [@anthropic-ai/sdk](https://github.com/anthropics/anthropic-sdk-typescript) | MIT | Anthropic |
| [ioredis](https://github.com/luin/ioredis) | MIT | Zihua Li |
| [pg](https://github.com/brianc/node-postgres) | MIT | Brian Carlson |
| [clsx](https://github.com/lukeed/clsx) | MIT | Luke Edwards |

Danh sách đầy đủ và giấy phép của từng gói nằm trong `package-lock.json` và thư mục `node_modules/<gói>/LICENSE`.

## 7. Trang Kinh Dịch / 易经页面

`public/kinh-dich.html` (từ dự án gieo-que của chủ repo) — phần diễn giải 64 quẻ bằng tiếng Việt hiện chưa ghi nguồn.
Nếu các diễn giải này lấy từ sách hoặc trang khác, bổ sung nguồn và giấy phép vào đây.
