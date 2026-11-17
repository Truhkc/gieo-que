/**
 * La bàn vận mệnh — dữ liệu cho đĩa la bàn ở cuối trang chủ (components/FortuneCompass.tsx).
 *
 * Bố cục theo la bàn phong thuỷ: 24 sơn, mỗi sơn 15°, Tý ở chính Bắc (0°), chạy theo chiều kim đồng hồ;
 * 8 quái Hậu Thiên, mỗi quái quản 3 sơn (45°), Khảm ở Bắc. Khi đĩa dừng, sơn nằm dưới kim cho ra
 * một quái và một lời luận; lời luận đối chiếu ngũ hành của quái với ngũ hành can ngày hôm nay.
 *
 * Đây là phần chiêm nghiệm mang tính giải trí — không gọi AI, không lưu gì.
 * Thuộc tính quái theo 《说卦传》 (Thuyết quái truyện) và số Lạc Thư.
 */

export type Element = '金' | '木' | '水' | '火' | '土';
type Text = { vi: string; zh: string };

export interface Trigram {
  han: string;
  vi: string;
  /** ☰ ☱ … */
  symbol: string;
  /** Hào từ dưới lên: true = dương (liền), false = âm (đứt) */
  lines: [boolean, boolean, boolean];
  nature: Text;
  element: Element;
  direction: Text;
  /** Số Lạc Thư (Hậu Thiên) */
  number: number;
  family: Text;
  quality: Text;
  colors: Text;
}

/** Thứ tự theo phương vị, bắt đầu từ Bắc theo chiều kim đồng hồ */
export const TRIGRAMS: Trigram[] = [
  {
    han: '坎', vi: 'Khảm', symbol: '☵', lines: [false, true, false], element: '水', number: 1,
    nature: { vi: 'Thuỷ — nước', zh: '水' }, direction: { vi: 'Bắc', zh: '北' },
    family: { vi: 'Trung nam', zh: '中男' }, quality: { vi: 'Hãm — hiểm, sâu, trí tuệ', zh: '陷 · 险而有智' },
    colors: { vi: 'Đen, xanh dương', zh: '黑、蓝' },
  },
  {
    han: '艮', vi: 'Cấn', symbol: '☶', lines: [false, false, true], element: '土', number: 8,
    nature: { vi: 'Sơn — núi', zh: '山' }, direction: { vi: 'Đông Bắc', zh: '东北' },
    family: { vi: 'Thiếu nam', zh: '少男' }, quality: { vi: 'Chỉ — dừng, vững vàng', zh: '止 · 知止而定' },
    colors: { vi: 'Vàng đất, nâu', zh: '黄、棕' },
  },
  {
    han: '震', vi: 'Chấn', symbol: '☳', lines: [true, false, false], element: '木', number: 3,
    nature: { vi: 'Lôi — sấm', zh: '雷' }, direction: { vi: 'Đông', zh: '东' },
    family: { vi: 'Trưởng nam', zh: '长男' }, quality: { vi: 'Động — khởi phát, hành động', zh: '动 · 奋发' },
    colors: { vi: 'Xanh lá', zh: '青、绿' },
  },
  {
    han: '巽', vi: 'Tốn', symbol: '☴', lines: [false, true, true], element: '木', number: 4,
    nature: { vi: 'Phong — gió', zh: '风' }, direction: { vi: 'Đông Nam', zh: '东南' },
    family: { vi: 'Trưởng nữ', zh: '长女' }, quality: { vi: 'Nhập — thấm sâu, mềm mỏng', zh: '入 · 柔顺渗透' },
    colors: { vi: 'Xanh lục nhạt', zh: '浅绿' },
  },
  {
    han: '离', vi: 'Ly', symbol: '☲', lines: [true, false, true], element: '火', number: 9,
    nature: { vi: 'Hoả — lửa, ánh sáng', zh: '火' }, direction: { vi: 'Nam', zh: '南' },
    family: { vi: 'Trung nữ', zh: '中女' }, quality: { vi: 'Lệ — bám, sáng tỏ', zh: '丽 · 附丽光明' },
    colors: { vi: 'Đỏ, tím', zh: '红、紫' },
  },
  {
    han: '坤', vi: 'Khôn', symbol: '☷', lines: [false, false, false], element: '土', number: 2,
    nature: { vi: 'Địa — đất', zh: '地' }, direction: { vi: 'Tây Nam', zh: '西南' },
    family: { vi: 'Mẹ', zh: '母' }, quality: { vi: 'Thuận — bao dung, nâng đỡ', zh: '顺 · 厚德载物' },
    colors: { vi: 'Vàng, nâu đất', zh: '黄、土色' },
  },
  {
    han: '兑', vi: 'Đoài', symbol: '☱', lines: [true, true, false], element: '金', number: 7,
    nature: { vi: 'Trạch — đầm', zh: '泽' }, direction: { vi: 'Tây', zh: '西' },
    family: { vi: 'Thiếu nữ', zh: '少女' }, quality: { vi: 'Duyệt — vui vẻ, giao hoà', zh: '说 · 喜悦' },
    colors: { vi: 'Trắng, ánh kim', zh: '白、金' },
  },
  {
    han: '乾', vi: 'Càn', symbol: '☰', lines: [true, true, true], element: '金', number: 6,
    nature: { vi: 'Thiên — trời', zh: '天' }, direction: { vi: 'Tây Bắc', zh: '西北' },
    family: { vi: 'Cha', zh: '父' }, quality: { vi: 'Kiện — mạnh mẽ, không ngừng', zh: '健 · 自强不息' },
    colors: { vi: 'Trắng, vàng kim', zh: '白、金' },
  },
];

export interface Mountain {
  han: string;
  vi: string;
  /** Góc tâm của sơn, độ, Bắc = 0, theo chiều kim đồng hồ */
  angle: number;
  /** Chỉ số trong TRIGRAMS */
  trigram: number;
  message: Text;
}

const M = (han: string, vi: string, msgVi: string, msgZh: string) => ({ han, vi, message: { vi: msgVi, zh: msgZh } });

/** 24 sơn bắt đầu từ Tý (chính Bắc), theo chiều kim đồng hồ */
const RAW = [
  M('子', 'Tý', 'Nửa đêm là lúc dương khí bắt đầu sinh. Việc tưởng bế tắc đang có lối ra — kiên trì thêm một bước, đừng bỏ ngang.', '子夜一阳初生。看似僵住的事已有出路，再坚持一步，切莫半途而废。'),
  M('癸', 'Quý', 'Mưa nhỏ thấm lâu. Tích luỹ từng chút — tiền bạc, kiến thức, quan hệ — rồi sẽ thành sức mạnh; tránh mạo hiểm lớn.', '细雨润物。点滴积累钱财、学识与人脉，终成大力；忌孤注一掷。'),
  M('丑', 'Sửu', 'Đất mùa đông giữ hạt giống. Hợp hoàn tất việc dở dang, sắp xếp lại; chưa phải lúc mở rộng.', '冬土藏种。宜收尾、整理旧事，尚非扩张之时。'),
  M('艮', 'Cấn', 'Núi đứng yên mà vững. Biết dừng đúng lúc là trí tuệ: từ chối một lời mời không cần thiết sẽ giữ được sức.', '山止而稳。知止是智慧，推掉一件不必要的应酬，可保元气。'),
  M('寅', 'Dần', 'Bình minh ló sau núi. Một khởi đầu nhỏ đang chờ — bắt tay vào việc đã trì hoãn, vận sẽ mở dần.', '山后破晓。小小的开端正等着你，动手做拖延已久的事，运势渐开。'),
  M('甲', 'Giáp', 'Cây lớn vươn thẳng. Hợp chủ động đề xuất, nhận trách nhiệm; người quyết đoán được quý nhân để ý.', '大木参天。宜主动提议、担当责任，果断之人易得贵人青睐。'),
  M('卯', 'Mão', 'Sấm xuân đánh thức muôn vật. Năng lượng dồi dào — vận động, gặp gỡ, khởi sự đều thuận; chỉ cần lời nói ôn hoà.', '春雷惊蛰，万物苏醒。精力充沛，运动、会友、起事皆顺，唯言语宜温和。'),
  M('乙', 'Ất', 'Dây leo mềm mà bền. Đi đường vòng khéo léo sẽ tới đích nhanh hơn đối đầu trực diện.', '藤萝柔韧。迂回巧行，反比正面硬碰更快到达。'),
  M('辰', 'Thìn', 'Gió mang mây về. Tin tức, cơ hội đến qua người quen; giữ liên lạc, lắng nghe nhiều hơn nói.', '风送云来。消息与机会经由熟人而至，多联络，多听少说。'),
  M('巽', 'Tốn', 'Gió thổi thì cỏ rạp — sức mạnh của sự mềm mỏng. Thương lượng, thuyết phục hôm nay dễ thành.', '风行草偃，柔能胜刚。今日谈判、说服易成。'),
  M('巳', 'Tỵ', 'Gió gặp lửa thì lửa bùng. Ý tưởng đang chín — ghi lại, chia sẻ với đúng người, đừng để nguội.', '风助火势。想法正当成熟，记下来，与对的人分享，莫让它冷掉。'),
  M('丙', 'Bính', 'Mặt trời đứng bóng. Tài năng dễ được nhìn thấy; hợp trình bày, ra mắt — nhớ chia công cho người cùng làm.', '日正当中。才华易被看见，宜展示、发布，记得与同伴分享功劳。'),
  M('午', 'Ngọ', 'Lửa chính Nam rực rỡ nhất cũng là lúc dễ quá đà. Giữ nhịp, tránh nóng giận và chi tiêu bốc đồng.', '正南之火最盛，亦最易过头。稳住节奏，忌动怒与冲动消费。'),
  M('丁', 'Đinh', 'Ngọn đèn nhỏ soi đường đêm. Một lời khuyên chân thành hay một cuốn sách sẽ gỡ điều bạn đang băn khoăn.', '一灯照夜路。一句真诚的建议或一本书，会解开你心中的疑团。'),
  M('未', 'Mùi', 'Ruộng chín chờ gặt. Thành quả tới từ công sức trước đây; hợp chốt việc, thu hồi nợ, cảm ơn người đã giúp.', '田熟待收。成果来自往日耕耘，宜结案、收账、答谢相助之人。'),
  M('坤', 'Khôn', 'Đất dày chở muôn vật. Bao dung và nâng đỡ người khác hôm nay sẽ quay về thành phúc cho chính bạn.', '地势坤，厚德载物。今日包容扶持他人，福报终归自身。'),
  M('申', 'Thân', 'Đất sinh kim — từ nền móng vững mà ra của cải. Chăm lo sức khoẻ, gia đình trước, việc lớn sẽ thuận sau.', '土生金，根基稳则财自来。先顾好身体与家庭，大事随后顺遂。'),
  M('庚', 'Canh', 'Kim cứng dễ gãy. Quyết đoán là tốt nhưng tránh lời nói sắc; một câu mềm mỏng giữ được mối quan hệ.', '刚金易折。果断固好，言语忌锋利，一句软话可保住关系。'),
  M('酉', 'Dậu', 'Đầm nước phản chiếu trăng thu. Niềm vui đến từ sẻ chia — hẹn bạn cũ, nói lời cảm ơn, tình cảm ấm lên.', '泽映秋月。喜乐来自分享，约旧友、道声谢，情谊升温。'),
  M('辛', 'Tân', 'Ngọc cần mài. Hoàn thiện chi tiết, sửa lại sản phẩm, học thêm một kỹ năng — giá trị của bạn sẽ tăng.', '玉不琢不成器。打磨细节、修订作品、多学一技，身价自升。'),
  M('戌', 'Tuất', 'Trời cuối thu cao rộng. Nhìn lại chặng đường, buông điều không còn hợp để lòng nhẹ hơn.', '秋末天高。回望来路，放下已不合适的，心自轻盈。'),
  M('乾', 'Càn', 'Trời vận hành không ngừng — người quân tử tự cường. Đặt mục tiêu rõ và bắt đầu ngay; ý chí mạnh thì vận theo.', '天行健，君子以自强不息。定下清晰目标，即刻启程，志坚则运随。'),
  M('亥', 'Hợi', 'Trời gặp nước, khí lạnh mà trong. Hợp tĩnh tâm, nghỉ ngơi, tích sức trước một chặng mới.', '天水相接，气清而寒。宜静心休养，为下一程蓄力。'),
  M('壬', 'Nhâm', 'Dòng nước sâu chảy lặng. Hợp suy ngẫm, lên kế hoạch hơn là ra tay vội; điều chưa rõ hãy để thêm một ngày.', '深水静流。宜思虑筹划，勿急于出手；未明之事，不妨再等一日。'),
];

export const MOUNTAINS: Mountain[] = RAW.map((m, i) => ({
  ...m,
  angle: i * 15,
  trigram: Math.floor((((i * 15 + 22.5) % 360) + 360) % 360 / 45),
}));

export function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/**
 * Sơn nằm dưới kim (kim cố định ở đỉnh) khi đĩa đã quay `rotation` độ theo chiều kim đồng hồ.
 * Điểm của đĩa đang ở đỉnh là góc −rotation trên đĩa.
 */
export function mountainAt(rotation: number): Mountain {
  const a = normalizeAngle(-rotation);
  return MOUNTAINS[Math.floor(normalizeAngle(a + 7.5) / 15) % 24];
}

// ── Ngũ hành ngày hôm nay ───────────────────────────────────

const STEM_ELEMENT: Element[] = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
export const STEMS = '甲乙丙丁戊己庚辛壬癸';
export const STEMS_VI = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
export const ELEMENT_VI: Record<Element, string> = { 金: 'Kim', 木: 'Mộc', 水: 'Thuỷ', 火: 'Hoả', 土: 'Thổ' };

/**
 * Thiên can của một ngày dương lịch. Can chi ngày chạy liên tục 60 ngày một vòng nên chỉ cần
 * đếm ngày từ mốc — khỏi kéo cả thư viện lịch âm vào trang chủ.
 * Mốc: 2026-11-11 là ngày 己 (Kỷ); scripts/regression/fortune-compass.test.ts đối chiếu với lunar-javascript.
 */
export function dayStemIndex(year: number, month: number, day: number): number {
  const days = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return (((days + 7) % 10) + 10) % 10;
}

const GENERATES: Record<Element, Element> = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const CONTROLS: Record<Element, Element> = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

export type Relation = 'same' | 'dayFeeds' | 'feedsDay' | 'dayControls' | 'controlsDay';

export function relation(trigram: Element, day: Element): Relation {
  if (trigram === day) return 'same';
  if (GENERATES[day] === trigram) return 'dayFeeds';
  if (GENERATES[trigram] === day) return 'feedsDay';
  if (CONTROLS[day] === trigram) return 'dayControls';
  return 'controlsDay';
}

export const RELATION_TEXT: Record<Relation, Text & { tone: 'good' | 'ok' | 'care' }> = {
  same: {
    tone: 'good',
    vi: 'Đồng hành với ngày — khí thế vững, hợp theo đuổi việc đã định.',
    zh: '与日同气，势稳，宜按既定方向推进。',
  },
  dayFeeds: {
    tone: 'good',
    vi: 'Ngày sinh quái — được trợ lực, việc dễ thuận, quý nhân dễ gặp.',
    zh: '日生卦，得助力，事易顺，易遇贵人。',
  },
  feedsDay: {
    tone: 'ok',
    vi: 'Quái sinh ngày — sức mình cho đi; hợp giúp người, kém hợp tranh giành.',
    zh: '卦生日，耗己助人；宜付出，不宜争夺。',
  },
  dayControls: {
    tone: 'care',
    vi: 'Ngày khắc quái — dễ gặp cản trở; nên giữ thế thủ, làm chắc từng bước.',
    zh: '日克卦，易遇阻碍；宜守不宜攻，稳扎稳打。',
  },
  controlsDay: {
    tone: 'ok',
    vi: 'Quái khắc ngày — bạn nắm thế chủ động, nhưng tránh quá cứng rắn.',
    zh: '卦克日，主动在我，但忌过刚。',
  },
};
