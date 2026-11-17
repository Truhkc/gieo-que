import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bát tự Tứ trụ · Lá số tử bình · Luận giải AI',
  description:
    'Lập lá số Bát tự (Tứ trụ) theo ngày giờ sinh: thiên can địa chi, thập thần, tàng can, nạp âm, trường sinh, ngũ hành, đại vận và lưu niên. Có AI luận giải nhật chủ vượng suy, dụng thần, sự nghiệp, tình cảm.',
  keywords: 'bát tự, tứ trụ, tử bình, lá số bát tự, thập thần, dụng thần, đại vận, 八字, 四柱',
  alternates: { canonical: '/bat-tu' },
};

export default function BatTuLayout({ children }: { children: React.ReactNode }) {
  return children;
}
