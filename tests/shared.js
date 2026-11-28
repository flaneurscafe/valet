/* SPDX-FileCopyrightText: 2026 Budgie Perruche <https://flaneurs.cafe/contact/>
   SPDX-License-Identifier: GPL-3.0-or-later */
/* Valet — the Dresser's shared names, checked without a browser. The Dresser is five files
   (js/ui/dresser.js and dresser-saved, -editor, -acc, -card.js) that share helpers and a few values
   through window.VDRCORE, written DR.x. A DR.x that no file defines is undefined in the page and
   fails only when that code runs; this finds it from the text:
   - every DR.x used is defined somewhere: exported with Object.assign(DR, { x: x }) by one file, or
     set with DR.x = … (the values more than one file changes);
   - each exported name is declared in the file that exports it, and exported by one file only;
   - dresser.js creates DR and index.html loads it before the other four, all five present. */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const FILES = ['dresser.js', 'dresser-saved.js', 'dresser-editor.js', 'dresser-acc.js', 'dresser-card.js'];
let n = 0, failed = 0;
function check(name, ok, info) { n++; if (!ok) { failed++; console.log('FAIL ' + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); } }
// comments say DR.x in prose: take them out first (block comments, and // comments after a space or at a line's start)
const code = f => fs.readFileSync(path.join(ROOT, 'js', 'ui', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
const src = {}; FILES.forEach(f => { src[f] = code(f); });

const exportedBy = {}, setBy = {}, used = {};
FILES.forEach(f => {
  const s = src[f];
  (s.match(/Object\.assign\(DR, \{([^}]*)\}\)/g) || []).forEach(m => {
    m.replace(/Object\.assign\(DR, \{|\}\)/g, '').split(',').map(x => x.split(':')[0].trim()).filter(Boolean).forEach(k => { (exportedBy[k] = exportedBy[k] || []).push(f); });
  });
  (s.match(/\bDR\.[A-Za-z_$][\w$]*\s*=(?!=)/g) || []).forEach(m => { const k = m.slice(3).replace(/\s*=$/, ''); (setBy[k] = setBy[k] || new Set()).add(f); });
  (s.match(/\bDR\.[A-Za-z_$][\w$]*/g) || []).forEach(m => { const k = m.slice(3); (used[k] = used[k] || new Set()).add(f); });
});

const undef = Object.keys(used).filter(k => !exportedBy[k] && !setBy[k]);
check('every DR.x used in the Dresser\'s files is defined by one of them', !undef.length, undef.map(k => k + ' (used in ' + [...used[k]].join(', ') + ')'));
const twice = Object.keys(exportedBy).filter(k => exportedBy[k].length > 1);
check('no name is exported by two files', !twice.length, twice.map(k => k + ': ' + exportedBy[k].join(', ')));
const both = Object.keys(exportedBy).filter(k => setBy[k]);
check('a name is either exported or a shared value, not both', !both.length, both);
const decl = (s, k) => new RegExp('function\\s+' + k.replace(/\$/g, '\\$') + '\\b|(?:const|let|var)\\s+' + k.replace(/\$/g, '\\$') + '\\b|,\\s*' + k.replace(/\$/g, '\\$') + '\\s*=(?!=)').test(s);
const notDeclared = Object.keys(exportedBy).filter(k => !decl(src[exportedBy[k][0]], k));
check('each exported name is declared in the file that exports it', !notDeclared.length, notDeclared.map(k => k + ' (' + exportedBy[k][0] + ')'));
const unusedExports = Object.keys(exportedBy).filter(k => !used[k] || [...used[k]].every(f => f === exportedBy[k][0]));
check('each exported name is used by another of the files (else it need not be shared)', !unusedExports.length, unusedExports);
const creators = FILES.filter(f => /window\.VDRCORE\s*=/.test(src[f]));
check('only dresser.js creates DR', creators.length === 1 && creators[0] === 'dresser.js', creators);
check('the other four take DR from it', FILES.slice(1).every(f => /const DR = window\.VDRCORE;/.test(src[f])), FILES.slice(1).filter(f => !/const DR = window\.VDRCORE;/.test(src[f])));
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const at = FILES.map(f => html.indexOf('src="js/ui/' + f));
check('index.html loads all five', at.every(i => i >= 0), FILES.filter((f, i) => at[i] < 0));
check('index.html loads dresser.js before the other four', at.slice(1).every(i => i > at[0]));

console.log(failed ? failed + ' of ' + n + ' shared-name checks failed' : 'shared: the Dresser\'s ' + Object.keys(used).length + ' shared names are all defined, each by one file, loaded in order (' + n + ' checks)');
process.exit(failed ? 1 : 0);
