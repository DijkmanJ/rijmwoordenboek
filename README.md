# Rijmwoordenboek

A Dutch rhyme dictionary for raps, poems and Sinterklaas rhymes. Plain HTML and JavaScript, no build step, no server: it runs as a static site (GitHub Pages).

Type one word and get every single-word rhyme, ranked by closeness:

- **More syllables first.** A 3-syllable vowel match beats a 1-syllable perfect rhyme.
- Within each syllable group: **volrijm** (perfect: same sounds from the vowel on), then **klinkerrijm** (same vowels, other consonants), then **bijna-rijm** (close vowels such as ie/i, aa/a, ei/e).
- **Medeklinkerrijm** (different vowel, same ending consonants) comes last.
- Stress doesn't have to line up. Voicing is ignored (d = t, z = s, v = f). Words that end in the search word itself (boot → zeilboot) go to the back of their group.

## How it works

`data/words.txt` holds 373k words with a compact pronunciation (one character per sound). The browser downloads it once (about 2.6 MB gzipped, then cached), and a Web Worker compares the last four syllables of every word against the search word. A search takes roughly 50–200 ms.

`data/extra.txt` has 64k lower-confidence pronunciations (eSpeak guesses, mostly names and loanwords). They are never shown as results, only used to pronounce a search word that is missing from the main list. If a word is in neither, the site rhymes on the longest known word it ends with (sinterklaasgedichtje → gedichtje).

| file | what |
|---|---|
| `index.html`, `style.css`, `app.js` | the page |
| `worker.js` | loads the data, answers searches |
| `rhyme.js` | the rhyme engine (scoring and ranking) |
| `tools/build_data.py` | builds `data/*.txt` from the lexicon TSV |

Sound codes: vowels `A E O Q i u y a e I o Y @ 1 2 3 4` = aa ee oo eu ie oe uu a e i o u ə ei ui au è; consonants are mostly themselves, with `G` = g (ɣ), `x` = ch, `N` = ng, `w` = w (ʋ).

## Run locally

```
python3 -m http.server
```

then open http://localhost:8000.

## Data

Pronunciations come from ipa-dict (MIT), Wiktionary via WikiPron (CC BY-SA), the OpenTaal word list (BSD / CC BY 3.0) and eSpeak-ng, merged and extended with compounds and inflections built from curated parts.
