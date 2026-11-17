import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Xem ngày tốt xấu · Lịch vạn niên · Giờ hoàng đạo',
  description:
    'Xem ngày tốt xấu theo lịch vạn niên: ngày hoàng đạo / hắc đạo, việc nên làm và nên tránh, giờ hoàng đạo, trực, nhị thập bát tú, tuổi xung, hướng xuất hành. Tìm ngày tốt cưới hỏi, khai trương, nhập trạch, động thổ.',
  keywords: 'xem ngày tốt xấu, lịch vạn niên, ngày hoàng đạo, giờ hoàng đạo, chọn ngày cưới, ngày khai trương, 黄历, 择日',
  alternates: { canonical: '/xem-ngay' },
};

export default function XemNgayLayout({ children }: { children: React.ReactNode }) {
  return children;
}
