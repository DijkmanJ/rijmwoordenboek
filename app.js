'use strict';
const worker = new Worker('worker.js');
const $ = (id) => document.getElementById(id);
const status = $('status'), results = $('results'), input = $('q');
let ready = false, lastId = 0;
const FIRST = 60, STEP = 300;

const GROUP_NAME = (n) => n === 0 ? 'Medeklinkerrijm' : n === 1 ? '1 lettergreep' : `${n} lettergrepen`;
const SUBS = [
  ['perfect', 'Volrijm'],
  ['klinker', 'Klinkerrijm'],
  ['bijna', 'Bijna-rijm'],
  ['medeklinker', ''],
];

worker.onmessage = (e) => {
  const m = e.data;
  if (m.type === 'ready') {
    ready = true;
    status.textContent = `${m.size.toLocaleString('nl')} woorden geladen.`;
    const w = new URLSearchParams(location.hash.slice(1)).get('w');
    if (w) { input.value = w; search(w); }
  } else if (m.type === 'error') {
    status.textContent = 'Kon de woordenlijst niet laden: ' + m.message;
  } else if (m.type === 'result' && m.id === lastId) {
    render(m);
  }
};

function search(word) {
  word = word.trim().split(/\s+/).pop() || '';
  if (!word) return;
  history.replaceState(null, '', '#w=' + encodeURIComponent(word));
  if (!ready) { status.textContent = 'Nog even, de woordenlijst laadt…'; }
  else status.textContent = 'Zoeken…';
  worker.postMessage({ id: ++lastId, word });
}

function chip(item) {
  const [word, type, same] = item;
  const a = document.createElement('a');
  a.href = '#w=' + encodeURIComponent(word);
  a.textContent = word;
  a.className = type + (same ? ' same' : '');
  a.onclick = (ev) => { ev.preventDefault(); input.value = word; search(word); window.scrollTo(0, 0); };
  return a;
}

// Show a list of chips, with a button that reveals more.
function chipList(items) {
  const box = document.createElement('div');
  const words = document.createElement('div');
  words.className = 'words';
  box.appendChild(words);
  let shown = 0;
  const btn = document.createElement('button');
  btn.className = 'more';
  const more = (n) => {
    const frag = document.createDocumentFragment();
    for (const it of items.slice(shown, shown + n)) frag.appendChild(chip(it));
    words.appendChild(frag);
    shown = Math.min(items.length, shown + n);
    const left = items.length - shown;
    btn.textContent = `Toon meer (${left.toLocaleString('nl')})`;
    btn.hidden = left === 0;
  };
  btn.onclick = () => more(STEP);
  more(FIRST);
  box.appendChild(btn);
  return box;
}

function render(m) {
  results.innerHTML = '';
  if (m.notFound) {
    status.textContent = `"${m.word}" ken ik niet, en ik herken ook geen woord waar het op eindigt.`;
    return;
  }
  let note = `${m.total.toLocaleString('nl')} rijmwoorden voor “${m.found}” (${m.ms} ms).`;
  if (m.via === 'extra') note += ' Uitspraak is gegokt, dus controleer even.';
  if (m.via === 'tail') note = `“${m.word}” staat niet in de lijst; ik rijm op “${m.tail}”. ` + note;
  status.textContent = note;
  for (const g of m.groups) {
    const sec = document.createElement('div');
    sec.className = 'group';
    const h = document.createElement('h2');
    h.textContent = GROUP_NAME(g.syllables) + ' ';
    if (g.syllables > 0) {
      const p = document.createElement('span');
      p.className = 'part';
      p.textContent = '· -' + g.part;
      h.appendChild(p);
    }
    sec.appendChild(h);
    for (const [type, label] of SUBS) {
      const items = g.items.filter((it) => it[1] === type);
      if (!items.length) continue;
      if (label) {
        const h3 = document.createElement('h3');
        h3.textContent = `${label} (${items.length.toLocaleString('nl')})`;
        sec.appendChild(h3);
      }
      sec.appendChild(chipList(items));
    }
    results.appendChild(sec);
  }
}

$('form').onsubmit = (e) => { e.preventDefault(); search(input.value); };
window.addEventListener('hashchange', () => {
  const w = new URLSearchParams(location.hash.slice(1)).get('w');
  if (w && w !== input.value) { input.value = w; search(w); }
});
