/**
 * Bảng dịch tiếng Việt cho các chuyên danh lịch pháp mà lunar-javascript trả về
 * (việc nên/kiêng, thần sát, trực, nhị thập bát tú, nạp âm, tiết khí, thập thần, trường sinh).
 *
 * - Việc nên/kiêng (宜忌) dịch theo nghĩa, vì người xem cần hiểu việc gì chứ không cần âm Hán Việt.
 * - Các tên riêng (thần sát, sao, trực, nạp âm…) giữ âm Hán Việt — cách lịch vạn niên tiếng Việt vẫn gọi.
 *
 * scripts/regression/almanac.test.ts quét 10 năm để chắc mọi tên thư viện có thể trả ra đều có trong bảng;
 * tra không thấy thì hàm `viAlmanac` trả nguyên chữ Hán (giao diện không vỡ, nhưng test sẽ đỏ).
 */
import type { Locale } from '@/lib/i18n/terms';

/** 宜忌 — dịch nghĩa */
export const VI_YI_JI: Record<string, string> = {
  平治道涂: 'Sửa đường sá', 馀事勿取: 'Ngoài ra không nên làm việc khác', 诸事不宜: 'Mọi việc đều không nên',
  订婚: 'Đính hôn', 嫁娶: 'Cưới hỏi', 出行: 'Xuất hành, đi xa', 求财: 'Cầu tài', 开市: 'Khai trương',
  交易: 'Giao dịch, mua bán', 安床: 'Kê giường', 祈福: 'Cầu phúc', 求嗣: 'Cầu con', 修造: 'Sửa chữa, xây dựng',
  安葬: 'An táng', 造船: 'Đóng thuyền', 乘船: 'Đi thuyền', 动土: 'Động thổ', 作灶: 'Làm bếp', 祭祀: 'Cúng tế',
  斋醮: 'Lập đàn cúng chay', 酬神: 'Lễ tạ thần', 见贵: 'Gặp quý nhân, cấp trên', 进人口: 'Thêm người (nhận nuôi, tuyển người)',
  移徙: 'Chuyển chỗ ở', 入宅: 'Nhập trạch (về nhà mới)', 开光: 'Khai quang (tượng, đồ thờ)', 赴任: 'Nhậm chức',
  盖屋: 'Lợp nhà', 上梁: 'Cất nóc, gác đòn dông', 入殓: 'Nhập liệm', 塑绘: 'Đắp, vẽ tượng', 订盟: 'Kết ước, giao kết',
  纳采: 'Dạm ngõ (nạp thái)', 出火: 'Dời bàn thờ (xuất hoả)', 拆卸: 'Tháo dỡ nhà cửa', 造桥: 'Làm cầu',
  安机械: 'Lắp đặt máy móc', 栽种: 'Trồng trọt', 纳畜: 'Mua gia súc', 牧养: 'Chăn nuôi', 除服: 'Xả tang',
  成服: 'Phát tang (mặc tang phục)', 移柩: 'Di quan (dời linh cữu)', 破土: 'Phá thổ (đào huyệt)', 词讼: 'Kiện tụng',
  治病: 'Chữa bệnh', 破屋: 'Phá dỡ nhà', 坏垣: 'Phá tường', 入学: 'Nhập học', 冠笄: 'Lễ trưởng thành',
  伐木: 'Chặt cây', 起基: 'Đổ móng', 放水: 'Tháo nước', 开池: 'Đào ao', 安门: 'Lắp cửa', 理发: 'Cắt tóc',
  造庙: 'Xây đền miếu', 沐浴: 'Tắm gội, tẩy uế', 开仓: 'Mở kho', 出货财: 'Xuất hàng, chi tiền', 立券: 'Ký hợp đồng, lập khế ước',
  纳财: 'Thu tiền, nhập hàng', 畋猎: 'Săn bắn', 补垣: 'Sửa tường', 塞穴: 'Lấp hang lỗ', 断蚁: 'Diệt mối kiến',
  解除: 'Giải trừ, dọn dẹp tẩy uế', 行丧: 'Đưa tang', 问名: 'Ăn hỏi (vấn danh)', 裁衣: 'Cắt may quần áo',
  会亲友: 'Gặp gỡ bạn bè, họ hàng', 捕捉: 'Bắt bớ, diệt sâu bọ', 修坟: 'Sửa mộ', 竖柱: 'Dựng cột', 作梁: 'Làm xà',
  开柱眼: 'Đục lỗ cột', 架马: 'Dựng giàn giáo', 造畜稠: 'Làm chuồng gia súc', 掘井: 'Đào giếng', 谢土: 'Lễ tạ đất',
  启钻: 'Bốc mộ, cải táng', 立碑: 'Dựng bia', 教牛马: 'Luyện trâu ngựa', 求医: 'Tìm thầy chữa bệnh',
  安香: 'An vị bàn thờ', 扫舍: 'Quét dọn nhà cửa', 挂匾: 'Treo biển hiệu', 开生坟: 'Xây sinh phần',
  合寿木: 'Đóng thọ mộc', 探病: 'Thăm người ốm', 习艺: 'Học nghề', 经络: 'Dệt, quay tơ', 结网: 'Đan lưới',
  安碓磑: 'Đặt cối giã, cối xay', 造仓: 'Xây kho', 合帐: 'May màn trướng', 修饰垣墙: 'Trang trí tường',
  纳婿: 'Đón rể', 造车器: 'Đóng xe cộ', 合脊: 'Lợp nóc', 置产: 'Mua nhà đất', 取渔: 'Đánh cá', 针灸: 'Châm cứu',
  开渠: 'Khơi mương', 分居: 'Ra ở riêng', 定磉: 'Đặt chân tảng cột', 雕刻: 'Chạm khắc', 开厕: 'Làm nhà vệ sinh',
  整手足甲: 'Cắt móng tay chân', 筑堤: 'Đắp đê', 普渡: 'Cúng thí thực (phổ độ)', 归岫: 'Quy tụ (an táng)',
  雇佣: 'Thuê người', 割蜜: 'Lấy mật ong', 归宁: 'Về thăm nhà mẹ đẻ', 修门: 'Sửa cửa', 无: '—',
};

/** 吉神 / 凶煞 / 十二天神 — âm Hán Việt */
export const VI_SHEN_SHA: Record<string, string> = {
  民日: 'Dân Nhật', 五合: 'Ngũ Hợp', 玉堂: 'Ngọc Đường', 鸣吠对: 'Minh Phệ Đối', 天罡: 'Thiên Cương',
  死神: 'Tử Thần', 月刑: 'Nguyệt Hình', 天吏: 'Thiên Lại', 致死: 'Trí Tử', 天贼: 'Thiên Tặc', 复日: 'Phục Nhật',
  月恩: 'Nguyệt Ân', 四相: 'Tứ Tướng', 三合: 'Tam Hợp', 临日: 'Lâm Nhật', 时阴: 'Thời Âm', 天仓: 'Thiên Thương',
  圣心: 'Thánh Tâm', 死气: 'Tử Khí', 天牢: 'Thiên Lao', 五富: 'Ngũ Phú', 益后: 'Ích Hậu', 劫煞: 'Kiếp Sát',
  小耗: 'Tiểu Hao', 重日: 'Trùng Nhật', 元武: 'Nguyên Vũ', 玄武: 'Huyền Vũ', 月空: 'Nguyệt Không', 阳德: 'Dương Đức',
  六仪: 'Lục Nghi', 续世: 'Tục Thế', 解神: 'Giải Thần', 司命: 'Tư Mệnh', 鸣吠: 'Minh Phệ', 月破: 'Nguyệt Phá',
  大耗: 'Đại Hao', 灾煞: 'Tai Sát', 天火: 'Thiên Hoả', 厌对: 'Yếm Đối', 招摇: 'Chiêu Dao', 四废: 'Tứ Phế',
  五虚: 'Ngũ Hư', 血忌: 'Huyết Kỵ', 阴阳击冲: 'Âm Dương Kích Xung', 月德合: 'Nguyệt Đức Hợp', 要安: 'Yếu An',
  月煞: 'Nguyệt Sát', 月虚: 'Nguyệt Hư', 月害: 'Nguyệt Hại', 四击: 'Tứ Kích', 八专: 'Bát Chuyên', 勾陈: 'Câu Trần',
  母仓: 'Mẫu Thương', 福生: 'Phúc Sinh', 除神: 'Trừ Thần', 游祸: 'Du Hoạ', 五离: 'Ngũ Ly', 天恩: 'Thiên Ân',
  天喜: 'Thiên Hỷ', 天医: 'Thiên Y', 大煞: 'Đại Sát', 天德: 'Thiên Đức', 月德: 'Nguyệt Đức', 青龙: 'Thanh Long',
  阴德: 'Âm Đức', 王日: 'Vương Nhật', 驿马: 'Dịch Mã', 天后: 'Thiên Hậu', 时阳: 'Thời Dương', 生气: 'Sinh Khí',
  明堂: 'Minh Đường', 月厌: 'Nguyệt Yếm', 地火: 'Địa Hoả', 官日: 'Quan Nhật', 六合: 'Lục Hợp', 血支: 'Huyết Chi',
  四忌: 'Tứ Kỵ', 六蛇: 'Lục Xà', 土符: 'Thổ Phù', 归忌: 'Quy Kỵ', 天刑: 'Thiên Hình', 逐阵: 'Trục Trận',
  守日: 'Thủ Nhật', 月建: 'Nguyệt Kiến', 小时: 'Tiểu Thời', 土府: 'Thổ Phủ', 往亡: 'Vãng Vong',
  触水龙: 'Xúc Thuỷ Long', 朱雀: 'Chu Tước', 阳错: 'Dương Thác', 时德: 'Thời Đức', 相日: 'Tướng Nhật',
  吉期: 'Cát Kỳ', 玉宇: 'Ngọc Vũ', 金匮: 'Kim Quỹ', 八风: 'Bát Phong', 天德合: 'Thiên Đức Hợp', 天巫: 'Thiên Vu',
  福德: 'Phúc Đức', 金堂: 'Kim Đường', 宝光: 'Bảo Quang', 地囊: 'Địa Nang', 天马: 'Thiên Mã', 不将: 'Bất Tương',
  河魁: 'Hà Khôi', 白虎: 'Bạch Hổ', 九坎: 'Cửu Khảm', 九焦: 'Cửu Tiêu', 敬安: 'Kính An', 大时: 'Đại Thời',
  大败: 'Đại Bại', 咸池: 'Hàm Trì', 普护: 'Phổ Hộ', 九空: 'Cửu Không', 四耗: 'Tứ Hao', 四穷: 'Tứ Cùng',
  大会: 'Đại Hội', 阴错: 'Âm Thác', 天赦: 'Thiên Xá', 天愿: 'Thiên Nguyện', 五墓: 'Ngũ Mộ',
  阴道冲阳: 'Âm Đạo Xung Dương', 八龙: 'Bát Long', 阴位: 'Âm Vị', 行狠: 'Hành Ngận', 了戾: 'Liễu Lệ',
  岁薄: 'Tuế Bạc', 孤辰: 'Cô Thần', 阴阳交破: 'Âm Dương Giao Phá', 绝阴: 'Tuyệt Âm', 小会: 'Tiểu Hội',
  纯阳: 'Thuần Dương', 七鸟: 'Thất Điểu', 阴阳俱错: 'Âm Dương Câu Thác', 阳错阴冲: 'Dương Thác Âm Xung',
  天狗: 'Thiên Cẩu', 九虎: 'Cửu Hổ', 成日: 'Thành Nhật', 孤阳: 'Cô Dương', 阴神: 'Âm Thần', 四离: 'Tứ Ly',
  三丧: 'Tam Tang', 解除: 'Giải Trừ', 三阴: 'Tam Âm', 七符: 'Thất Phù', 天符: 'Thiên Phù', 绝阳: 'Tuyệt Dương',
  鬼哭: 'Quỷ Khốc', 单阴: 'Đơn Âm', 纯阴: 'Thuần Âm', 大退: 'Đại Thoái', 阳破阴冲: 'Dương Phá Âm Xung', 无: '—',
};

/** 建除十二值星 (Thập nhị trực) */
export const VI_ZHI_XING: Record<string, string> = {
  建: 'Kiến', 除: 'Trừ', 满: 'Mãn', 平: 'Bình', 定: 'Định', 执: 'Chấp',
  破: 'Phá', 危: 'Nguy', 成: 'Thành', 收: 'Thu', 开: 'Khai', 闭: 'Bế',
};

/** 二十八宿 */
export const VI_XIU: Record<string, string> = {
  角: 'Giác', 亢: 'Cang', 氐: 'Đê', 房: 'Phòng', 心: 'Tâm', 尾: 'Vĩ', 箕: 'Cơ',
  斗: 'Đẩu', 牛: 'Ngưu', 女: 'Nữ', 虚: 'Hư', 危: 'Nguy', 室: 'Thất', 壁: 'Bích',
  奎: 'Khuê', 娄: 'Lâu', 胃: 'Vị', 昴: 'Mão', 毕: 'Tất', 觜: 'Chuỷ', 参: 'Sâm',
  井: 'Tỉnh', 鬼: 'Quỷ', 柳: 'Liễu', 星: 'Tinh', 张: 'Trương', 翼: 'Dực', 轸: 'Chẩn',
};

/** 六十甲子纳音 */
export const VI_NAYIN: Record<string, string> = {
  海中金: 'Hải Trung Kim', 炉中火: 'Lư Trung Hoả', 大林木: 'Đại Lâm Mộc', 路旁土: 'Lộ Bàng Thổ',
  剑锋金: 'Kiếm Phong Kim', 山头火: 'Sơn Đầu Hoả', 涧下水: 'Giản Hạ Thuỷ', 城头土: 'Thành Đầu Thổ',
  白蜡金: 'Bạch Lạp Kim', 杨柳木: 'Dương Liễu Mộc', 泉中水: 'Tuyền Trung Thuỷ', 屋上土: 'Ốc Thượng Thổ',
  霹雳火: 'Tích Lịch Hoả', 松柏木: 'Tùng Bách Mộc', 长流水: 'Trường Lưu Thuỷ', 沙中金: 'Sa Trung Kim',
  山下火: 'Sơn Hạ Hoả', 平地木: 'Bình Địa Mộc', 壁上土: 'Bích Thượng Thổ', 金箔金: 'Kim Bạch Kim',
  覆灯火: 'Phúc Đăng Hoả', 天河水: 'Thiên Hà Thuỷ', 大驿土: 'Đại Dịch Thổ', 钗钏金: 'Thoa Xuyến Kim',
  桑柘木: 'Tang Đố Mộc', 大溪水: 'Đại Khê Thuỷ', 沙中土: 'Sa Trung Thổ', 天上火: 'Thiên Thượng Hoả',
  石榴木: 'Thạch Lựu Mộc', 大海水: 'Đại Hải Thuỷ',
};

/** 二十四节气 */
export const VI_JIEQI: Record<string, string> = {
  立春: 'Lập Xuân', 雨水: 'Vũ Thuỷ', 惊蛰: 'Kinh Trập', 春分: 'Xuân Phân', 清明: 'Thanh Minh', 谷雨: 'Cốc Vũ',
  立夏: 'Lập Hạ', 小满: 'Tiểu Mãn', 芒种: 'Mang Chủng', 夏至: 'Hạ Chí', 小暑: 'Tiểu Thử', 大暑: 'Đại Thử',
  立秋: 'Lập Thu', 处暑: 'Xử Thử', 白露: 'Bạch Lộ', 秋分: 'Thu Phân', 寒露: 'Hàn Lộ', 霜降: 'Sương Giáng',
  立冬: 'Lập Đông', 小雪: 'Tiểu Tuyết', 大雪: 'Đại Tuyết', 冬至: 'Đông Chí', 小寒: 'Tiểu Hàn', 大寒: 'Đại Hàn',
};

/** 十神 */
export const VI_SHI_SHEN: Record<string, string> = {
  比肩: 'Tỷ Kiên', 劫财: 'Kiếp Tài', 食神: 'Thực Thần', 伤官: 'Thương Quan', 偏财: 'Thiên Tài',
  正财: 'Chính Tài', 七杀: 'Thất Sát', 正官: 'Chính Quan', 偏印: 'Thiên Ấn', 正印: 'Chính Ấn', 日主: 'Nhật Chủ',
};

/** 十二长生 */
export const VI_CHANG_SHENG: Record<string, string> = {
  长生: 'Trường Sinh', 沐浴: 'Mộc Dục', 冠带: 'Quan Đới', 临官: 'Lâm Quan', 帝旺: 'Đế Vượng', 衰: 'Suy',
  病: 'Bệnh', 死: 'Tử', 墓: 'Mộ', 绝: 'Tuyệt', 胎: 'Thai', 养: 'Dưỡng',
};

export const VI_WUXING: Record<string, string> = { 金: 'Kim', 木: 'Mộc', 水: 'Thuỷ', 火: 'Hoả', 土: 'Thổ' };

/** 方位 */
export const VI_POSITION: Record<string, string> = {
  正北: 'Chính Bắc', 东北: 'Đông Bắc', 正东: 'Chính Đông', 东南: 'Đông Nam',
  正南: 'Chính Nam', 西南: 'Tây Nam', 正西: 'Chính Tây', 西北: 'Tây Bắc', 中宫: 'Trung cung',
  北: 'Bắc', 东: 'Đông', 南: 'Nam', 西: 'Tây',
};

/** 生肖 — cách gọi Việt (卯 là Mèo, không phải Thỏ) */
export const VI_SHENG_XIAO: Record<string, string> = {
  鼠: 'Chuột', 牛: 'Trâu', 虎: 'Hổ', 兔: 'Mèo', 龙: 'Rồng', 蛇: 'Rắn',
  马: 'Ngựa', 羊: 'Dê', 猴: 'Khỉ', 鸡: 'Gà', 狗: 'Chó', 猪: 'Lợn',
};

export const VI_LUCK: Record<string, string> = { 吉: 'Tốt', 凶: 'Xấu', 黄道: 'Hoàng đạo', 黑道: 'Hắc đạo' };

export const ALMANAC_TABLES = {
  yiji: VI_YI_JI,
  shensha: VI_SHEN_SHA,
  zhixing: VI_ZHI_XING,
  xiu: VI_XIU,
  nayin: VI_NAYIN,
  jieqi: VI_JIEQI,
  shishen: VI_SHI_SHEN,
  changsheng: VI_CHANG_SHENG,
  wuxing: VI_WUXING,
  position: VI_POSITION,
  shengxiao: VI_SHENG_XIAO,
  luck: VI_LUCK,
} as const;

export type AlmanacTable = keyof typeof ALMANAC_TABLES;

/** Dịch một chuyên danh theo ngôn ngữ đang chọn; tra không thấy thì giữ nguyên chữ Hán. */
export function viAlmanac(table: AlmanacTable, name: string, locale: Locale): string {
  if (locale === 'zh') return name;
  return (ALMANAC_TABLES[table] as Record<string, string>)[name] ?? name;
}
