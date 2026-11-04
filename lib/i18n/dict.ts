/**
 * lib/i18n/dict —— từ điển chuỗi giao diện (tiếng Việt / tiếng Trung)
 *
 * Chỉ chứa chữ của giao diện. Chuyên danh mệnh lý (tên sao, tên cung, tứ hoá,
 * can chi, cách cục) nằm ở terms.ts và đi qua term() — chúng là dữ liệu engine
 * sinh ra lúc chạy, không phải chuỗi tĩnh.
 *
 * Bản tiếng Trung là nguyên văn của dự án thượng nguồn, giữ nguyên để người
 * dùng gạt công tắc về 中文 là thấy đúng giao diện gốc.
 *
 * Chỗ nào cần chèn giá trị thì dùng {tên}; t() thay bằng vars tương ứng.
 */

export interface Entry {
  vi: string;
  zh: string;
}

export const UI = {
  // ── Công tắc chung ───────────────────────────────────────
  'common.lang.toggleLabel': { vi: 'Chuyển sang tiếng Trung', zh: '切换到越南语' },
  'common.lang.short': { vi: 'VI', zh: '中' },
  'common.theme.dark': { vi: 'Tối', zh: '暗色' },
  'common.theme.light': { vi: 'Sáng', zh: '亮色' },
  'common.theme.toLight': { vi: 'Chuyển giao diện sáng', zh: '切换亮色主题' },
  'common.theme.toDark': { vi: 'Chuyển giao diện tối', zh: '切换暗色主题' },

  // ── Trang lập lá số ──────────────────────────────────────
  'chart.title': { vi: 'Lập lá số Tử Vi Đẩu Số', zh: '紫微斗数排盘' },
  'chart.subtitle': {
    vi: 'Nhập ngày giờ sinh, engine mã nguồn mở lập lá số ngay lập tức.',
    zh: '输入出生年月日时，开源排盘引擎即时生成命盘。',
  },
  'chart.demoNote': {
    vi: '(Trang này là bản Demo của engine. Nhân lõi lập lá số — an sao, tứ hoá, cách cục, thư viện cổ tịch — mở hoàn toàn.)',
    zh: '（本页为引擎 Demo，完整商业版界面不在开源范围；排盘内核完全开放。）',
  },
  'chart.back': { vi: '← Lập lá số khác', zh: '← 重新起盘' },

  // ── Biểu mẫu ngày sinh ───────────────────────────────────
  'form.heading': { vi: '── Nhập ngày giờ sinh ──', zh: '── 输入生辰八字 ──' },
  'form.name.label': { vi: 'Họ tên (tuỳ chọn)', zh: '姓名（可选）' },
  'form.name.placeholder': { vi: 'Nhập họ tên', zh: '请输入姓名' },
  'form.date.label': { vi: 'Ngày sinh (dương lịch)', zh: '出生日期（公历）' },
  'form.year': { vi: 'Năm', zh: '年份' },
  'form.month': { vi: 'Tháng', zh: '月份' },
  'form.day': { vi: 'Ngày', zh: '日期' },
  'form.monthOption': { vi: 'Tháng {n}', zh: '{n} 月' },
  'form.dayOption': { vi: 'Ngày {n}', zh: '{n} 日' },
  'form.place.label': {
    vi: 'Nơi sinh (để hiệu chỉnh chân thái dương thời)',
    zh: '出生地点（用于真太阳时校正）',
  },
  'form.province': { vi: 'Tỉnh / Thành phố', zh: '省份 / 直辖市' },
  'form.city': { vi: 'Thành phố', zh: '城市' },
  'form.cityPickProvince': { vi: 'Chọn tỉnh trước', zh: '先选省份' },
  'form.cityNone': { vi: '(chưa chọn thành phố)', zh: '（请选择城市）' },
  'form.longitude': { vi: 'Kinh độ', zh: '经度' },
  'form.offset': { vi: 'lệch', zh: '时差' },
  'form.minutes': { vi: 'phút', zh: '分钟' },
  'form.trueSolarHint': {
    vi: '* Nghê Hải Hạ luận mệnh theo chân thái dương thời — nên điền nơi sinh để tự hiệu chỉnh giờ',
    zh: '* 倪海厦批命用真太阳时，建议填写出生地以自动校正时辰',
  },
  'form.time.label': { vi: 'Giờ sinh (giờ đồng hồ)', zh: '出生时间（北京时间）' },
  'form.hourOption': { vi: '{n} giờ', zh: '{n} 时' },
  'form.minuteOption': { vi: '{n} phút', zh: '{n} 分' },
  'form.trueSolarArrow': { vi: 'Chân thái dương thời → ', zh: '真太阳时 → ' },
  'form.shichen': { vi: 'giờ {x}', zh: '{x}时' },
  'form.unknownTime': {
    vi: 'Không biết giờ sinh, lập theo giờ Tý (23:00–01:00)',
    zh: '不知道出生时间，以子时（23:00–01:00）起盘',
  },
  'form.gender': { vi: 'Giới tính', zh: '性别' },
  'form.male': { vi: '♂ Nam', zh: '♂ 男' },
  'form.female': { vi: '♀ Nữ', zh: '♀ 女' },
  'form.genderMaleShort': { vi: 'Nam', zh: '男' },
  'form.genderFemaleShort': { vi: 'Nữ', zh: '女' },
  'form.summaryDate': { vi: '{d}/{m}/{y}', zh: '{y}年{m}月{d}日' },
  'form.summaryUnknownTime': { vi: 'Không rõ giờ', zh: '时辰不详' },
  'form.submitting': { vi: 'Đang lập lá số…', zh: '紫微起盘中…' },
  'form.submit': { vi: 'Lập lá số ngay', zh: '立即起盘 · 解命运密码' },
  'form.err.year': { vi: 'Vui lòng chọn năm sinh', zh: '请选择出生年份' },
  'form.err.yearRange': { vi: 'Năm hợp lệ: 1900–2026', zh: '年份范围：1900–2026' },
  'form.err.month': { vi: 'Vui lòng chọn tháng', zh: '请选择月份' },
  'form.err.day': { vi: 'Vui lòng chọn ngày', zh: '请选择日期' },
  'form.err.dayInvalid': { vi: 'Tháng {m} không có ngày {d}', zh: '{m}月没有{d}日' },

  // ── Bàn lá số ────────────────────────────────────────────
  'board.title': { vi: 'Lá số Tử Vi', zh: '紫微斗数命盘' },
  'board.brand': { vi: 'TỬ VI ĐẨU SỐ', zh: '紫微斗数' },
  'board.ming': { vi: 'Mệnh', zh: '命宫' },
  'board.shen': { vi: 'Thân', zh: '身宫' },
  'board.currentDaxian': { vi: 'Đại hạn hiện tại', zh: '当前大限' },
  'board.ageSuffix': { vi: ' tuổi', zh: '岁' },
  'board.lunarPrefix': { vi: 'ÂL ', zh: '' },
  'board.leapMark': { vi: 'N', zh: '闰' },
  'board.hint': { vi: 'Bấm vào cung để xem tam phương tứ chính', zh: '点击宫位看三方四正' },

  // ── Ô cung ───────────────────────────────────────────────
  'cell.empty': { vi: 'Cung trống', zh: '空宫' },
  'cell.mingBadge': { vi: 'Mệnh', zh: '命' },
  'cell.shenBadge': { vi: 'Thân', zh: '身' },

  // ── Thanh vận hạn ────────────────────────────────────────
  'nav.natal': { vi: 'Bản mệnh', zh: '本命' },
  'nav.daxian': { vi: 'Đại hạn', zh: '大限' },
  'nav.daxianRange': { vi: 'Đại hạn {a}–{b}', zh: '大限 {a}–{b}' },
  'nav.liunian': { vi: 'Lưu niên', zh: '流年' },
  'nav.overlayDaxian': { vi: 'Tứ hoá đại hạn · can {stem}:', zh: '大限·{stem}年四化：' },
  'nav.overlayYear': { vi: 'Tứ hoá năm {year} · can {stem}:', zh: '{year}·{stem}年四化：' },
  'nav.badgeDaxian': { vi: 'ĐH', zh: '限' },
  'nav.badgeYear': { vi: 'LN', zh: '年' },

  // ── Khung giải đoán ──────────────────────────────────────
  'insight.header': { vi: 'Giải đoán', zh: '命理解读' },
  'insight.placeholder': {
    vi: 'Hỏi tiếp, ví dụ: năm nay có nên đổi việc không?',
    zh: '继续追问，如：今年适合换工作吗？',
  },
  'insight.send': { vi: 'Hỏi', zh: '追问' },
  'insight.topic.overview': { vi: 'Mệnh cục', zh: '命格' },
  'insight.topic.love': { vi: 'Tình cảm', zh: '感情' },
  'insight.topic.career': { vi: 'Sự nghiệp', zh: '事业' },
  'insight.topic.wealth': { vi: 'Tài vận', zh: '财运' },
  'insight.topic.health': { vi: 'Sức khoẻ', zh: '健康' },
  'insight.topic.personality': { vi: 'Tính cách', zh: '性格' },
  'insight.err.apiMissing': {
    vi: 'Không tìm thấy /api/interpret — repo này đã có sẵn route đó, hãy kiểm tra app/api/interpret/route.ts và khởi động lại dev server. Việc lập lá số không cần API Key.',
    zh: '找不到 /api/interpret —— 本仓库已内置该接口，请确认 app/api/interpret/route.ts 存在并重启开发服务器。排盘本身不需要任何 API Key。',
  },
  'insight.err.failed': { vi: 'Giải đoán thất bại, vui lòng thử lại sau.', zh: '解读失败，请稍后重试。' },
} as const satisfies Record<string, Entry>;

export type UiKey = keyof typeof UI;

/** Thay {tên} bằng giá trị tương ứng; thiếu biến thì giữ nguyên placeholder. */
export function fill(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, k: string) =>
    k in vars ? String(vars[k]) : whole,
  );
}
