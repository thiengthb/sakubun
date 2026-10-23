import type { MetadataRoute } from 'next';

// Installable on a phone home screen (roadmap 2.4). It opens on quick review, the page meant for a
// few minutes on the phone; everything still needs a network, there is no offline mode.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'sakubun · Luyện tiếng Nhật',
    short_name: 'sakubun',
    description: 'Ôn ngữ pháp và từ vựng tiếng Nhật theo lịch FSRS',
    lang: 'vi',
    start_url: '/review',
    scope: '/',
    display: 'standalone',
    background_color: '#faf9f5',
    theme_color: '#faf9f5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
