/**
 * ネイティブ（Capacitor）とブラウザの差を吸収する層。
 * - 触覚: iOS は navigator.vibrate 非対応のため、ネイティブでは Haptics プラグインを使う
 * - 共有: ネイティブでは画像をキャッシュに書き出して OS の共有シートへ渡す
 */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();

export type HapticKind = 'light' | 'success' | 'heavy';

export async function haptic(kind: HapticKind) {
  try {
    if (isNative) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (kind === 'light') await Haptics.impact({ style: ImpactStyle.Light });
      else if (kind === 'success') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: ImpactStyle.Heavy });
      return;
    }
    navigator.vibrate?.(kind === 'light' ? 8 : kind === 'success' ? 30 : [60, 40, 120]);
  } catch { /* 非対応端末 */ }
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
}

/** 画像を共有。戻り値: 'shared' | 'cancelled' | 'unsupported' */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<'shared' | 'cancelled' | 'unsupported'> {
  if (isNative) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: filename, data: await blobToBase64(blob), directory: Directory.Cache });
    try {
      await Share.share({ files: [uri], text });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  const file = new File([blob], filename, { type: 'image/png' });
  if (!navigator.canShare?.({ files: [file] })) return 'unsupported';
  try {
    await navigator.share({ files: [file], text });
    return 'shared';
  } catch {
    return 'cancelled';
  }
}

/** 起動時のネイティブ設定（ステータスバー・戻るボタン） */
export async function initNative(onBack: () => boolean) {
  if (!isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (Capacitor.getPlatform() === 'android') await StatusBar.setBackgroundColor({ color: '#151311' });
  } catch { /* noop */ }
  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('backButton', () => {
      // 開いているシートを閉じられたらそれで終わり。何もなければアプリを閉じる
      if (!onBack()) void App.exitApp();
    });
  } catch { /* noop */ }
}
