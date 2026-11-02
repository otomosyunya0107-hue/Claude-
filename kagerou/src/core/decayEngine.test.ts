import { describe, expect, it } from 'vitest';
import {
  charState, decayText, erodedGlyph, getCharThreshold, linearDecay, seededRandom, visualDecay,
} from './decayEngine';
import { DAY_MS } from './constants';

describe('seededRandom', () => {
  it('is deterministic and in [0,1)', () => {
    for (let i = 0; i < 1000; i++) {
      const a = seededRandom(12345, i);
      expect(a).toBe(seededRandom(12345, i));
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
    expect(seededRandom(1, 0)).not.toBe(seededRandom(2, 0));
  });
});

describe('getCharThreshold', () => {
  const ranges: [string, number, number][] = [
    ['あ', 0.15, 0.75], ['。', 0.15, 0.75],
    ['カ', 0.3, 0.9], ['A', 0.3, 0.9], ['７', 0.3, 0.9],
    ['言', 0.48, 0.98], ['😀', 0.48, 0.98],
  ];
  it.each(ranges)('%s stays within [%f, %f]', (c, lo, hi) => {
    for (let i = 0; i < 500; i++) {
      const h = getCharThreshold(c, -987654, i);
      expect(h).toBeGreaterThanOrEqual(lo);
      expect(h).toBeLessThanOrEqual(hi);
    }
  });
});

describe('decay ratios', () => {
  it('linear is clamped, visual is pow 1.6', () => {
    expect(linearDecay(0, -5)).toBe(0);
    expect(linearDecay(0, 15 * DAY_MS)).toBeCloseTo(0.5);
    expect(linearDecay(0, 99 * DAY_MS)).toBe(1);
    expect(visualDecay(0.5)).toBeCloseTo(Math.pow(0.5, 1.6));
  });
});

describe('charState table', () => {
  it('maps boundaries per spec §4.3', () => {
    const h = 0.6;
    expect(charState(0.39, h)).toBe('INTACT');
    expect(charState(0.4, h)).toBe('BLURRED');
    expect(charState(0.52, h)).toBe('FADING');
    expect(charState(0.6, h)).toBe('ERODED');
  });
  it('never blurs at 0% even for the weakest chars (H=0.15)', () => {
    expect(charState(0, 0.15)).toBe('INTACT');
    expect(charState(0.019, 0.15)).toBe('INTACT');
    expect(charState(0.02, 0.15)).toBe('BLURRED');
    expect(charState(0.07, 0.15)).toBe('FADING');
  });
});

describe('decayText', () => {
  const text = '大事な言葉も、読み返さなければ\nやがて砂に還ります。ABC';
  it('is reproducible (reload-stable)', () => {
    expect(decayText(text, 42, 0.5)).toEqual(decayText(text, 42, 0.5));
  });
  it('never leaks original chars when ERODED; keeps newlines', () => {
    const g = decayText(text, 42, 1);
    const chars = Array.from(text);
    g.forEach((x, i) => {
      if (chars[i] === '\n') expect(x.display).toBe('\n');
      else {
        expect(x.state).toBe('ERODED');
        expect(['＿', '░', '·', '　']).toContain(x.display);
      }
    });
  });
  it('erodes hiragana before kanji on average', () => {
    const hira = 'あいうえおかきくけこさしすせそ'.repeat(10);
    const kanji = '言葉思考記憶時間風化石碑墓標砂'.repeat(10);
    const frac = (s: string) => decayText(s, 7, 0.45).filter((x) => x.state === 'ERODED').length / Array.from(s).length;
    expect(frac(hira)).toBeGreaterThan(frac(kanji));
    expect(frac(kanji)).toBe(0); // 漢字の最小耐久値は 0.48
  });
  it('fully intact at 0', () => {
    expect(decayText(text, 1, 0).every((x) => x.state === 'INTACT')).toBe(true);
  });
  it('glyph distribution roughly matches 35/20/25/20', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) counts[erodedGlyph(99, i)] = (counts[erodedGlyph(99, i)] ?? 0) + 1;
    expect(counts['＿'] / 20000).toBeCloseTo(0.35, 1);
    expect(counts['░'] / 20000).toBeCloseTo(0.2, 1);
    expect(counts['·'] / 20000).toBeCloseTo(0.25, 1);
    expect(counts['　'] / 20000).toBeCloseTo(0.2, 1);
  });
});
