import path from 'node:path';
import kuromoji, { type IpadicFeatures, type Tokenizer } from 'kuromoji';
import { toHiragana, type KaiwaToken, type Tokenize } from '@/lib/kaiwa/furigana';

// The kuromoji tokenizer behind automatic furigana (phase 8, K4). Its dictionary takes about a second
// and some 350 MB to load, and scripts are saved rarely, so it loads on the first save and is let go
// after a few idle minutes for the garbage collector to take back.

const DICT = path.join(process.cwd(), 'node_modules', 'kuromoji', 'dict');
const IDLE_MS = 5 * 60_000;

let loading: Promise<Tokenizer<IpadicFeatures>> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;

function load(): Promise<Tokenizer<IpadicFeatures>> {
  loading ??= new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
    kuromoji.builder({ dicPath: DICT }).build((error, tokenizer) => {
      if (error) reject(error);
      else resolve(tokenizer);
    });
  }).catch((error: unknown) => {
    loading = null;
    throw error;
  });
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => {
    loading = null;
  }, IDLE_MS);
  idle.unref?.();
  return loading;
}

const known = (value: string | undefined) => (value && value !== '*' ? value : undefined);

function toToken(t: IpadicFeatures): KaiwaToken {
  const reading = known(t.reading);
  const base = known(t.basic_form);
  return {
    surface: t.surface_form,
    ...(reading && /[\p{Script=Han}々〆ヶ]/u.test(t.surface_form)
      ? { reading: toHiragana(reading) }
      : {}),
    ...(base && base !== t.surface_form ? { base } : {}),
    pos: t.pos,
  };
}

export async function japaneseTokenizer(): Promise<Tokenize> {
  const tokenizer = await load();
  return (text) => tokenizer.tokenize(text).map(toToken);
}
