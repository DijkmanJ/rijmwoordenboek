#!/usr/bin/env python3
"""Build the compact word lists the website loads.

Usage: python3 tools/build_data.py path/to/dutch_lexicon.tsv

Writes data/words.txt (curated + rebuilt words, used for results and lookup)
and data/extra.txt (lower-confidence eSpeak words, only used to look up a
search word that is missing from words.txt; never shown as a result).

Each line is: word<TAB>phones, one character per sound, stress dropped.
"""
import sys, re, os

PHONE = {
    # vowels
    'aː': 'A', 'eː': 'E', 'oː': 'O', 'øː': 'Q', 'œː': 'Q', 'i': 'i', 'u': 'u', 'y': 'y',
    'ɑ': 'a', 'ɛ': 'e', 'ɪ': 'I', 'ɔ': 'o', 'ɒ': 'o', 'Y': 'Y', 'ə': '@', 'e': 'E',
    'EI': '1', 'UI': '2', 'AU': '3', 'ɛː': '4',
    # consonants
    'p': 'p', 'b': 'b', 't': 't', 'd': 'd', 'k': 'k', 'g': 'g', 'f': 'f', 'v': 'v',
    's': 's', 'z': 'z', 'x': 'x', 'ɣ': 'G', 'h': 'h', 'ʒ': 'Z', 'ʃ': 'S', 'm': 'm',
    'n': 'n', 'ŋ': 'N', 'l': 'l', 'r': 'r', 'ʋ': 'w', 'w': 'w', 'j': 'j',
}
VOWELS = set('AEOQiuyaeIoY@1234')
WORD_OK = re.compile(r"^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'\-]*$")


def encode(phones):
    out = []
    for p in phones.split():
        p = p.rstrip('12')
        c = PHONE.get(p)
        if c:
            out.append(c)
    s = ''.join(out)
    return s if any(ch in VOWELS for ch in s) else None


def main(src, outdir):
    main_words, extra_words = {}, {}
    with open(src, encoding='utf-8') as f:
        next(f)
        for line in f:
            cols = line.rstrip('\n').split('\t')
            word, phones, source = cols[0], cols[1], cols[2]
            if not WORD_OK.match(word):
                continue
            code = encode(phones)
            if not code:
                continue
            target = extra_words if source == 'espeak' else main_words
            key = word.lower()
            # Keep one entry per lowercase spelling; prefer the lowercase form.
            if key in target and target[key][0] == key:
                continue
            target[key] = (word, code)
    for k in list(extra_words):
        if k in main_words:
            del extra_words[k]
    os.makedirs(outdir, exist_ok=True)
    for name, d in (('words.txt', main_words), ('extra.txt', extra_words)):
        with open(os.path.join(outdir, name), 'w', encoding='utf-8') as f:
            for k in sorted(d):
                w, c = d[k]
                f.write(f'{w}\t{c}\n')
        print(name, len(d))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'data')
