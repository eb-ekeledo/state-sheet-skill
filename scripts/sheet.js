#!/usr/bin/env node
/*
 * state-sheet: render every state of a component on one review sheet, and flag what breaks.
 *
 *   node scripts/sheet.js --html path/to/component.html --cases path/to/cases.json --out out/
 *   node scripts/sheet.js --url "http://localhost:5173/__sheet?case={case}&theme={theme}" --cases cases.json --out out/
 *
 * Options: --widths 320,560   --themes light,dark   --title "Pricing card"   --strict (exit 1 on any flag)
 *
 * Writes out/sheet.png, out/report.json and out/report.md.
 */
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright is needed: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

// ---------- args ----------
const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? fallback : argv[i + 1];
};
const flag = (name) => argv.includes('--' + name);

const htmlPath = arg('html');
const urlTemplate = arg('url');
const casesPath = arg('cases');
const outDir = arg('out', 'state-sheet-out');
const widths = arg('widths', '320,560').split(',').map(Number);
const themes = arg('themes', 'light,dark').split(',');
const strict = flag('strict');

if ((!htmlPath && !urlTemplate) || !casesPath) {
  console.error('Usage: node scripts/sheet.js (--html component.html | --url "<template>") --cases cases.json --out dir');
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(casesPath, 'utf8'));
const cases = spec.cases;
const title = arg('title', spec.title || path.basename(path.dirname(path.resolve(casesPath))));
fs.mkdirSync(outDir, { recursive: true });

// ---------- the page that hosts one cell (html mode) ----------
function hostPage(componentHtml, c, theme, width) {
  return `<!doctype html><html data-theme="${theme}" lang="en"><head><meta charset="utf-8">
<style>
  html, body { margin: 0; }
  body { background: ${theme === 'dark' ? '#121212' : '#FFFFFF'}; }
  #sheet-frame { width: ${width}px; padding: 24px; box-sizing: border-box; }
</style></head><body>
<div id="sheet-frame" dir="${c.dir || 'ltr'}"><div data-sheet-root></div></div>
${componentHtml}
<script>
  (function () {
    var props = ${JSON.stringify(c.props || {})};
    var root = document.querySelector('[data-sheet-root]');
    var out = window.renderComponent ? window.renderComponent(props, { theme: '${theme}' }) : '';
    if (typeof out === 'string') root.innerHTML = out; else if (out) root.appendChild(out);
  })();
</script></body></html>`;
}

// ---------- checks, run inside the page ----------
async function inspect(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-sheet-root]');
    const flags = [];
    if (!root) return { flags: [{ kind: 'missing', msg: 'No [data-sheet-root] on the page' }], size: null };
    const comp = root.firstElementChild || root;
    const r = comp.getBoundingClientRect();
    const size = { w: Math.round(r.width), h: Math.round(r.height) };

    const hasContent = root.textContent.trim().length > 0 || root.querySelector('img,svg,canvas,input,button,video');
    if (!hasContent) flags.push({ kind: 'missing', msg: 'Renders nothing' });

    const parse = (s) => {
      const m = s.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const over = (top, bottom) => ({
      r: top.r * top.a + bottom.r * (1 - top.a),
      g: top.g * top.a + bottom.g * (1 - top.a),
      b: top.b * top.a + bottom.b * (1 - top.a), a: 1,
    });
    const bgOf = (el) => {
      const stack = [];
      for (let n = el; n; n = n.parentElement) {
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; }
      }
      let base = { r: 255, g: 255, b: 255, a: 1 };
      const pageBg = parse(getComputedStyle(document.body).backgroundColor);
      if (pageBg && pageBg.a > 0) base = pageBg;
      for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base);
      return base;
    };
    const lum = (c) => {
      const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

    const seen = new Set();
    const textEls = [...root.querySelectorAll('*')].filter((el) =>
      [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
    for (const el of textEls) {
      const cs = getComputedStyle(el);
      const er = el.getBoundingClientRect();
      if (er.width === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const disabled = el.closest(':disabled,[aria-disabled="true"],[data-disabled]');
      const label = el.textContent.trim().slice(0, 32);

      // Clipped text: content wider than its box, and the box hides it without an ellipsis.
      const clips = ['hidden', 'clip'].includes(cs.overflowX) || ['hidden', 'clip'].includes(cs.overflow);
      if (el.scrollWidth > el.clientWidth + 1 && clips && cs.textOverflow !== 'ellipsis') {
        flags.push({ kind: 'overflow', msg: `Text clipped: "${label}"` });
      }
      // Cut-off numbers: an ellipsis is fine for names, never for amounts, IDs or counts.
      const txt = el.textContent.trim();
      if (el.scrollWidth > el.clientWidth + 1 && cs.textOverflow === 'ellipsis' && /^[^\d]{0,6}[\d][\d,.\s-]*[^\d]{0,6}$/.test(txt)) {
        flags.push({ kind: 'overflow', msg: `Number cut off: "${label}"` });
      }
      // Spill: text box runs outside the component.
      if (er.right > r.right + 1 || er.left < r.left - 1) {
        const key = 'spill' + label;
        if (!seen.has(key)) { seen.add(key); flags.push({ kind: 'overflow', msg: `Spills out of the component: "${label}"` }); }
      }
      // Contrast (WCAG AA). Disabled controls are exempt.
      const fg = parse(cs.color);
      if (fg && !disabled) {
        const bg = bgOf(el);
        const fgSolid = fg.a < 1 ? over(fg, bg) : fg;
        const size = parseFloat(cs.fontSize);
        const bold = Number(cs.fontWeight) >= 700;
        const large = size >= 24 || (bold && size >= 18.66);
        const need = large ? 3 : 4.5;
        const cr = ratio(fgSolid, bg);
        if (cr < need) flags.push({ kind: 'contrast', msg: `Contrast ${cr.toFixed(2)}:1 under ${need}:1 on "${label}"` });
      }
    }
    return { flags, size };
  });
}

async function focusCheck(page) {
  const target = await page.$('[data-sheet-root] :is(a[href],button:not(:disabled),input,select,textarea,[tabindex]:not([tabindex="-1"]))');
  if (!target) return [{ kind: 'focus', msg: 'Nothing in the component can take keyboard focus' }];
  const styles = () => target.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0 ? cs.outlineStyle + cs.outlineWidth + cs.outlineColor : 'none',
      shadow: cs.boxShadow, border: cs.borderColor, bg: cs.backgroundColor };
  });
  const before = await styles();
  await page.keyboard.press('Tab');
  const focused = await target.evaluate((el) => el === document.activeElement);
  if (!focused) return [{ kind: 'focus', msg: 'Tab does not reach the control' }];
  const after = await styles();
  const visible = after.outline !== 'none' || after.shadow !== before.shadow || after.border !== before.border || after.bg !== before.bg;
  return visible ? [] : [{ kind: 'focus', msg: 'No visible focus ring' }];
}

async function interact(page, c) {
  if (!c.interact) return [];
  const sel = '[data-sheet-root] :is(button,a,input,[role="button"],[tabindex])';
  if (c.interact === 'focus') return focusCheck(page);
  const el = await page.$(sel);
  if (!el) return [];
  const box = await el.boundingBox();
  if (!box) return [];
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  if (c.interact === 'press') await page.mouse.down();
  await page.waitForTimeout(250);
  return [];
}

// ---------- run ----------
(async () => {
  const t0 = Date.now();
  const componentHtml = htmlPath ? fs.readFileSync(htmlPath, 'utf8') : null;
  const browser = await chromium.launch();
  const cells = [];
  const sizes = {};

  for (const c of cases) {
    for (const theme of themes) {
      for (const width of widths) {
        const context = await browser.newContext({ viewport: { width: width + 48, height: 800 }, deviceScaleFactor: 2, colorScheme: theme });
        const page = await context.newPage();
        if (componentHtml) {
          await page.setContent(hostPage(componentHtml, c, theme, width), { waitUntil: 'load' });
        } else {
          const url = urlTemplate.replace('{case}', encodeURIComponent(c.id)).replace('{theme}', theme).replace('{width}', width);
          await page.goto(url, { waitUntil: 'networkidle' });
        }
        await page.addStyleTag({ content: '*,*::before,*::after{animation-play-state:paused!important;caret-color:transparent!important}' });
        const extra = await interact(page, c);
        const { flags, size } = await inspect(page);
        flags.push(...extra);

        const key = theme + width;
        sizes[c.id + key] = size;
        if (c.sameSizeAs && size) {
          const ref = sizes[c.sameSizeAs + key];
          if (ref && (Math.abs(ref.w - size.w) > 2 || Math.abs(ref.h - size.h) > 2)) {
            flags.push({ kind: 'shift', msg: `Size changes vs ${c.sameSizeAs}: ${ref.w}x${ref.h} to ${size.w}x${size.h}` });
          }
        }

        const frame = (await page.$('#sheet-frame')) || (await page.$('[data-sheet-root]'));
        const shot = await frame.screenshot({ type: 'png' });
        cells.push({ case: c.id, label: c.label || c.id, theme, width, flags: dedupe(flags), img: shot.toString('base64') });
        await context.close();
      }
    }
  }

  // ---------- compose the sheet ----------
  const cols = [];
  for (const theme of themes) for (const width of widths) cols.push({ theme, width });
  const flagged = cells.filter((x) => x.flags.length);
  const sheet = `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #ECEBE8; color: #111; font-family: Inter, ui-sans-serif, system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    .wrap { padding: 48px 56px 56px; width: max-content; }
    .mono { font-family: "JetBrains Mono", ui-monospace, Menlo, monospace; }
    header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 28px; gap: 40px; }
    .kicker { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6B6A66; margin: 0 0 8px; }
    h1 { margin: 0; font-size: 36px; letter-spacing: -.025em; font-weight: 650; }
    .count { font-size: 14px; color: #6B6A66; text-align: right; line-height: 1.5; }
    .count b { color: ${flagged.length ? '#D93036' : '#111'}; font-weight: 650; }
    table { border-collapse: separate; border-spacing: 10px; margin: -10px; }
    th { font-weight: 500; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; color: #6B6A66; text-align: left; padding: 0 4px 2px; }
    td.case { font-size: 13px; font-weight: 550; padding-right: 10px; white-space: nowrap; vertical-align: top; padding-top: 14px; }
    td.cell { vertical-align: top; padding: 0; }
    .tile { position: relative; border-radius: 14px; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.07); }
    .tile.dark { box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
    .tile img { display: block; }
    .tile.bad { box-shadow: 0 0 0 2px #D93036; }
    .tags { padding: 8px 10px 10px; background: #fff; display: flex; flex-direction: column; gap: 4px; }
    .tag { font-size: 12px; color: #D93036; line-height: 1.35; }
    .tag::before { content: ''; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #D93036; margin-right: 6px; vertical-align: 1px; }
  </style></head><body><div class="wrap">
    <header><div><p class="kicker mono">state sheet</p><h1>${esc(title)}</h1></div>
    <div class="count mono">${cases.length} states · ${themes.length} themes · ${widths.length} widths<br><b>${flagged.length ? flagged.length + ' cells flagged' : 'No flags'}</b></div></header>
    <table><thead><tr><th></th>${cols.map((c) => `<th class="mono">${c.theme} · ${c.width}px</th>`).join('')}</tr></thead><tbody>
    ${cases.map((c) => `<tr><td class="case">${esc(c.label || c.id)}</td>${cols.map((col) => {
      const cell = cells.find((x) => x.case === c.id && x.theme === col.theme && x.width === col.width);
      const bad = cell.flags.length > 0;
      return `<td class="cell"><div class="tile ${col.theme} ${bad ? 'bad' : ''}" style="width:${col.width}px"><img width="${col.width}" src="data:image/png;base64,${cell.img}">${bad ? `<div class="tags">${cell.flags.map((f) => `<span class="tag">${esc(f.msg)}</span>`).join('')}</div>` : ''}</div></td>`;
    }).join('')}</tr>`).join('')}
    </tbody></table></div></body></html>`;

  const page = await browser.newPage({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
  await page.setContent(sheet, { waitUntil: 'load' });
  const wrap = await page.$('.wrap');
  await wrap.screenshot({ path: path.join(outDir, 'sheet.png') });
  await browser.close();

  const report = {
    title, cases: cases.length, themes, widths, seconds: Math.round((Date.now() - t0) / 100) / 10,
    flagged: flagged.length,
    flags: flagged.flatMap((x) => x.flags.map((f) => ({ case: x.case, theme: x.theme, width: x.width, ...f }))),
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const md = [`# State sheet: ${title}`, '', `${cases.length} states, ${themes.join(' and ')}, ${widths.join(' and ')} px. ${flagged.length} cells flagged.`, '',
    ...(report.flags.length ? ['| State | Theme | Width | Problem |', '| --- | --- | --- | --- |', ...report.flags.map((f) => `| ${f.case} | ${f.theme} | ${f.width}px | ${f.msg} |`)] : ['No problems found.']), ''].join('\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), md);
  console.log(md);
  console.log(`Sheet: ${path.join(outDir, 'sheet.png')} (${report.seconds}s)`);
  process.exit(strict && flagged.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });

function dedupe(flags) {
  const seen = new Set();
  return flags.filter((f) => (seen.has(f.msg) ? false : (seen.add(f.msg), true)));
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
