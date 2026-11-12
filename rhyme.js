// Rhyme engine: loads the word list, finds and ranks rhymes for one word.
// Works in the browser (window.Rhyme) and in Node (module.exports) for tests.
(function (root) {
  'use strict';

  const VOWELS = 'AEOQiuyaeIoY@1234';
  const SCHWA = VOWELS.indexOf('@');
  const MAX_SYL = 4; // how many syllables from the end we compare

  // Readable names for the sound codes (used to show the rhyme part).
  const SHOW = {
    A: 'aa', E: 'ee', O: 'oo', Q: 'eu', i: 'ie', u: 'oe', y: 'uu', a: 'a', e: 'e',
    I: 'i', o: 'o', Y: 'u', '@': 'ə', 1: 'ei', 2: 'ui', 3: 'au', 4: 'è',
  };

  const CONS = { G: 'g', x: 'ch', N: 'ng', Z: 'zj', S: 'sj', w: 'w' };

  // Vowels that sound close enough for a slant rhyme, with a closeness 0..1.
  const CLOSE = [
    ['i', 'I', 0.7], ['A', 'a', 0.6], ['E', 'e', 0.6], ['O', 'o', 0.6], ['Q', 'Y', 0.6],
    ['y', 'Y', 0.55], ['i', 'y', 0.55], ['u', 'o', 0.45], ['u', 'O', 0.45], ['u', 'y', 0.45],
    ['E', 'I', 0.45], ['E', '1', 0.5], ['e', '1', 0.5], ['e', 'I', 0.45], ['Q', '2', 0.55],
    ['1', '2', 0.45], ['3', 'o', 0.5], ['3', 'O', 0.45], ['2', '3', 0.4], ['Q', 'E', 0.4],
    ['4', 'e', 0.7], ['4', 'E', 0.6], ['4', '1', 0.45], ['Y', '@', 0.4], ['I', '@', 0.35],
  ];
  const NV = VOWELS.length;
  const VSIM = new Float32Array(NV * NV);
  for (let a = 0; a < NV; a++) VSIM[a * NV + a] = 1;
  for (const [x, y, s] of CLOSE) {
    const a = VOWELS.indexOf(x), b = VOWELS.indexOf(y);
    VSIM[a * NV + b] = VSIM[b * NV + a] = s;
  }

  // Consonants: voicing is ignored (d=t, b=p, ...), and similar sounds count partly.
  const DEVOICE = { b: 'p', d: 't', g: 'k', v: 'f', z: 's', G: 'x', Z: 'S' };
  const CLASS = {
    p: 'P', t: 'P', k: 'P', f: 'F', s: 'F', x: 'F', S: 'F', h: 'F',
    m: 'N', n: 'N', N: 'N', l: 'L', r: 'L', w: 'W', j: 'W',
  };
  const devoice = (s) => s.replace(/[bdgvzGZ]/g, (c) => DEVOICE[c]);

  // Similarity of two consonant clusters, 0..1.
  function clusterSim(a, b) {
    if (a === b) return 1;
    const x = devoice(a), y = devoice(b);
    if (x === y) return 0.95;
    if (!x.length || !y.length) return 0;
    // Weighted edit distance: same sound class costs 0.5, otherwise 1.
    const n = x.length, m = y.length;
    let prev = new Array(m + 1), cur = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      cur[0] = i;
      for (let j = 1; j <= m; j++) {
        const sub = x[i - 1] === y[j - 1] ? 0 : CLASS[x[i - 1]] === CLASS[y[j - 1]] ? 0.5 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + sub);
      }
      [prev, cur] = [cur, prev];
    }
    const sim = 1 - prev[m] / Math.max(n, m);
    // Matching the last sound of the cluster matters most.
    const endBonus = x[n - 1] === y[m - 1] ? 0.15 : 0;
    return Math.max(0, Math.min(0.85, sim * 0.75 + endBonus));
  }

  // Split a phone code into vowels and the consonant clusters after each vowel,
  // counted from the end of the word.
  function analyse(code) {
    const vowels = [], codas = [];
    let cluster = '';
    for (let i = code.length - 1; i >= 0; i--) {
      const c = code[i];
      const v = VOWELS.indexOf(c);
      if (v >= 0) {
        vowels.push(v);
        codas.push(cluster);
        cluster = '';
      } else {
        cluster = c + cluster;
      }
    }
    return { vowels, codas, onset: cluster };
  }

  class Dictionary {
    constructor(text) {
      const lines = text.split('\n');
      const n = lines.length;
      this.words = [];
      this.codes = [];
      this.nVow = new Uint8Array(n);
      this.vow = new Uint8Array(n * MAX_SYL);
      this.coda = new Uint16Array(n * MAX_SYL);
      this.clusters = [];
      const clusterId = new Map();
      this.index = new Map();
      let w = 0;
      for (const line of lines) {
        const tab = line.indexOf('\t');
        if (tab < 0) continue;
        const word = line.slice(0, tab), code = line.slice(tab + 1);
        this.words.push(word);
        this.codes.push(code);
        this.index.set(word.toLowerCase(), w);
        const a = analyse(code);
        const k = Math.min(MAX_SYL, a.vowels.length);
        this.nVow[w] = k;
        for (let s = 0; s < k; s++) {
          this.vow[w * MAX_SYL + s] = a.vowels[s];
          let id = clusterId.get(a.codas[s]);
          if (id === undefined) {
            id = this.clusters.length;
            this.clusters.push(a.codas[s]);
            clusterId.set(a.codas[s], id);
          }
          this.coda[w * MAX_SYL + s] = id;
        }
        w++;
      }
      this.size = w;
      // Capitalised words (mostly names) go below normal words with the same score.
      this.isName = new Uint8Array(w);
      for (let i = 0; i < w; i++) {
        const c = this.words[i][0];
        this.isName[i] = c !== c.toLowerCase() ? 1 : 0;
      }
    }

    lookup(word) {
      const i = this.index.get(word.toLowerCase());
      return i === undefined ? null : { word: this.words[i], code: this.codes[i] };
    }

    // Find rhymes for a phone code. Returns results sorted best first.
    rhymes(code, queryWord) {
      const q = analyse(code);
      const qn = Math.min(MAX_SYL, q.vowels.length);
      const qWord = (queryWord || '').toLowerCase();
      // Similarity of each query cluster against every cluster in the dictionary.
      const nc = this.clusters.length;
      const csim = [];
      for (let s = 0; s < qn; s++) {
        const row = new Float32Array(nc);
        for (let c = 0; c < nc; c++) row[c] = clusterSim(q.codas[s], this.clusters[c]);
        csim.push(row);
      }
      const qv = q.vowels;
      const out = [];
      const { vow, coda, nVow } = this;
      for (let w = 0; w < this.size; w++) {
        const base = w * MAX_SYL;
        const wn = nVow[w];
        const n = Math.min(qn, wn);
        let syl = 0, score = 0, exactV = 0, fullMatched = 0, perfect = true, consonant = false;
        for (let s = 0; s < n; s++) {
          const a = qv[s], b = vow[base + s];
          const vs = VSIM[a * NV + b];
          const cs = csim[s][coda[base + s]];
          if (vs === 0) {
            // Consonant rhyme: the vowel differs but the consonants after it match.
            if (fullMatched === 0 && a !== SCHWA && b !== SCHWA && q.codas[s] && cs >= 0.95) {
              consonant = true;
              score += 3 * cs;
            }
            break;
          }
          const isSchwa = a === SCHWA || b === SCHWA;
          if (!isSchwa) fullMatched++;
          if (vs === 1) exactV++;
          if (vs < 1 || cs < 0.95) perfect = false;
          syl++;
          score += (isSchwa ? 4 * vs : 10 * vs) + (isSchwa ? 2 : 3) * cs;
        }
        if (fullMatched === 0 && !consonant) continue;
        if (consonant && fullMatched > 0) consonant = false;
        if (this.words[w].toLowerCase() === qWord) continue;
        // Same sound all the way through (e.g. spelling variants): not a rhyme.
        if (syl === qn && syl === wn && this.codes[w] === code) continue;
        // Perfect rhyme means identical from the rhyme vowel to the end, and the
        // rhyme must cover the query's stressed part: at least its last full vowel.
        const full = syl > 0 && perfect;
        if (full) score += 5;
        const lw = this.words[w].toLowerCase();
        const sameEnd = qWord.length > 2 && (lw.endsWith(qWord) || qWord.endsWith(lw));
        out.push({ w, syl: consonant ? 0 : syl, score, perfect: full, exactV, sameEnd });
      }
      out.sort((a, b) =>
        b.syl - a.syl ||
        (a.sameEnd - b.sameEnd) ||
        b.score - a.score ||
        this.isName[a.w] - this.isName[b.w] ||
        this.codes[a.w].length - this.codes[b.w].length ||
        this.words[a.w].localeCompare(this.words[b.w], 'nl'));
      return out.map((r) => ({
        word: this.words[r.w],
        syllables: r.syl,
        type: r.syl === 0 ? 'medeklinker' : r.perfect ? 'perfect' : r.exactV === r.syl ? 'klinker' : 'bijna',
        score: Math.round(r.score * 10) / 10,
        sameEnd: r.sameEnd,
      }));
    }
  }

  // Show the rhyme part of a code readably, e.g. "bOt" -> "oo-t".
  function rhymePart(code, syllables) {
    const a = analyse(code);
    const parts = [];
    for (let s = Math.min(syllables, a.vowels.length) - 1; s >= 0; s--) {
      parts.push(SHOW[VOWELS[a.vowels[s]]] + a.codas[s].replace(/[GxNZSw]/g, (c) => CONS[c]));
    }
    return parts.join('·');
  }

  const api = { Dictionary, analyse, clusterSim, rhymePart, VOWELS, MAX_SYL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Rhyme = api;
})(typeof self !== 'undefined' ? self : this);
