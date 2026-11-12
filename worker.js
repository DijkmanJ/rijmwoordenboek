// Loads the word lists and answers rhyme queries off the main thread.
importScripts('rhyme.js');

let dict = null, extra = null;
const ready = fetch('data/words.txt')
  .then((r) => { if (!r.ok) throw new Error('words.txt: ' + r.status); return r.text(); })
  .then((t) => { dict = new Rhyme.Dictionary(t); postMessage({ type: 'ready', size: dict.size }); })
  .catch((e) => postMessage({ type: 'error', message: String(e) }));

async function loadExtra() {
  if (!extra) {
    const t = await fetch('data/extra.txt').then((r) => r.text());
    extra = new Map();
    for (const line of t.split('\n')) {
      const i = line.indexOf('\t');
      if (i > 0) extra.set(line.slice(0, i).toLowerCase(), { word: line.slice(0, i), code: line.slice(i + 1) });
    }
  }
  return extra;
}

// Find how to pronounce a word: the main list, then the lower-confidence list,
// then the longest known word it ends with (works well for compounds).
async function pronounce(word) {
  const hit = dict.lookup(word);
  if (hit) return { ...hit, via: 'main' };
  const ex = (await loadExtra()).get(word.toLowerCase());
  if (ex) return { ...ex, via: 'extra' };
  const lw = word.toLowerCase();
  for (let i = 1; i <= lw.length - 3; i++) {
    const tail = dict.lookup(lw.slice(i));
    if (tail) return { word, code: tail.code, via: 'tail', tail: tail.word };
  }
  return null;
}

onmessage = async (e) => {
  const { id, word } = e.data;
  await ready;
  if (!dict) return;
  const p = await pronounce(word);
  if (!p) { postMessage({ type: 'result', id, word, notFound: true }); return; }
  const t0 = performance.now();
  const results = dict.rhymes(p.code, word);
  const ms = Math.round(performance.now() - t0);
  // Split into groups and add the readable rhyme part per group.
  const groups = new Map();
  for (const r of results) {
    if (!groups.has(r.syllables)) {
      groups.set(r.syllables, { syllables: r.syllables, part: Rhyme.rhymePart(p.code, r.syllables || 1), items: [] });
    }
    groups.get(r.syllables).items.push([r.word, r.type, r.sameEnd ? 1 : 0]);
  }
  postMessage({
    type: 'result', id, word, ms, via: p.via, tail: p.tail, found: p.word,
    total: results.length, groups: [...groups.values()],
  });
};
