import type { CapacitorConfig } from '@capacitor/cli';

// appId はストア公開時に変更不可。公開前に正式な逆ドメイン名へ置き換えること。
const config: CapacitorConfig = {
  appId: 'app.kagerou.memo',
  appName: 'カゲロウ',
  webDir: 'dist',
  backgroundColor: '#151311',
  android: { backgroundColor: '#151311' },
  ios: { backgroundColor: '#151311', contentInset: 'never' },
};

export default config;
