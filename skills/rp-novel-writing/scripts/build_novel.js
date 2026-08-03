#!/usr/bin/env node
/*
 * build_novel.js — typeset a chapter-file manuscript into a book-format .docx
 *
 * Usage: copy into the workspace, edit CONFIG, run `node build_novel.js`.
 * Requires the `docx` npm package (preinstalled in most Claude environments).
 *
 * Expects chapter files as markdown: first line "# Title", blank line, prose;
 * "***" alone on a line = scene break; *italic* and **bold** supported.
 * Optional epigraphs.json: { "partDir/file.md": ["quote text", "attribution"], ... }
 */
const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, AlignmentType, PageBreak,
  Footer, PageNumber, SectionType,
} = require('docx');

// ----------------------- CONFIG -----------------------
const CONFIG = {
  title: 'NOVEL TITLE',
  subtitle: 'a novel',
  author: 'Author Name',
  font: 'Garamond',
  root: './manuscript',                 // contains part directories
  parts: [                              // in order; omit num/title for single-part books
    { dir: 'part1', num: 'PART ONE', title: 'Part Title' },
  ],
  epigraphsFile: './epigraphs.json',    // optional; null to skip
  dedication: null,                     // optional: ['quote', 'attribution']
  output: './Novel.docx',
  // 6"x9" trim (DXA: 1440 = 1 inch). For US Letter: 12240 x 15840.
  pageWidth: 8640, pageHeight: 12960,
  margin: { top: 1080, bottom: 1080, left: 1152, right: 1152 },
  sceneBreakGlyph: '❦',            // ❦ fleuron
};
// ------------------------------------------------------

const EPI = CONFIG.epigraphsFile && fs.existsSync(CONFIG.epigraphsFile)
  ? JSON.parse(fs.readFileSync(CONFIG.epigraphsFile, 'utf8')) : {};
const FONT = CONFIG.font;

function runs(text, base = {}) {
  const out = [];
  const re = /(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), font: FONT, size: 24, ...base }));
    if (m[2] !== undefined) out.push(new TextRun({ text: m[2], bold: true, font: FONT, size: 24, ...base }));
    else out.push(new TextRun({ text: m[4], italics: true, font: FONT, size: 24, ...base }));
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), font: FONT, size: 24, ...base }));
  return out.length ? out : [new TextRun({ text: '', font: FONT, size: 24 })];
}

const bodyPara = (text, first) => new Paragraph({
  alignment: AlignmentType.JUSTIFIED,
  indent: first ? undefined : { firstLine: 360 },
  spacing: { line: 300, after: 0 },
  children: runs(text),
});

const sceneBreak = () => new Paragraph({
  alignment: AlignmentType.CENTER,
  spacing: { before: 240, after: 240 },
  children: [new TextRun({ text: CONFIG.sceneBreakGlyph, font: FONT, size: 24 })],
});

function chapterChildren(partDir, file, chNum) {
  const raw = fs.readFileSync(path.join(CONFIG.root, partDir, file), 'utf8').trim();
  const lines = raw.split('\n');
  let title = `Chapter ${chNum}`, i = 0;
  if (lines[0].startsWith('# ')) { title = lines[0].slice(2).trim(); i = 1; }
  const paras = lines.slice(i).join('\n').trim().split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);

  const kids = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 1800, after: 60 },
      children: [new TextRun({ text: `CHAPTER ${chNum}`, font: FONT, size: 20, characterSpacing: 60, color: '7A6A45' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
      children: [new TextRun({ text: title, font: FONT, size: 40 })] }),
  ];
  const epi = EPI[`${partDir}/${file}`];
  if (epi) {
    kids.push(new Paragraph({ alignment: AlignmentType.CENTER, indent: { left: 1080, right: 1080 }, spacing: { after: 80 },
      children: [new TextRun({ text: epi[0], italics: true, font: FONT, size: 22 })] }));
    kids.push(new Paragraph({ alignment: AlignmentType.CENTER, indent: { left: 1080, right: 1080 }, spacing: { after: 600 },
      children: [new TextRun({ text: '— ' + epi[1], font: FONT, size: 20, color: '555555' })] }));
  }
  let first = true;
  for (const p of paras) {
    if (/^\*\*\*$/.test(p) || /^\* \* \*$/.test(p)) { kids.push(sceneBreak()); first = true; continue; }
    kids.push(bodyPara(p, first)); first = false;
  }
  return kids;
}

const pageProps = { page: { size: { width: CONFIG.pageWidth, height: CONFIG.pageHeight }, margin: CONFIG.margin } };
const footer = new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
  children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 18, color: '888888' })] })] });

const sections = [];
const titleKids = [
  new Paragraph({ spacing: { before: 4400 } }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
    children: [new TextRun({ text: CONFIG.title.toUpperCase(), font: FONT, size: 72, characterSpacing: 40 })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 2400 },
    children: [new TextRun({ text: CONFIG.subtitle, font: FONT, size: 26, italics: true, color: '7A6A45' })] }),
  new Paragraph({ alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: CONFIG.author, font: FONT, size: 32 })] }),
];
if (CONFIG.dedication) {
  titleKids.push(new Paragraph({ children: [new PageBreak()] }));
  titleKids.push(new Paragraph({ spacing: { before: 5200 } }));
  titleKids.push(new Paragraph({ alignment: AlignmentType.CENTER, indent: { left: 1080, right: 1080 },
    children: [new TextRun({ text: CONFIG.dedication[0], italics: true, font: FONT, size: 24 })] }));
  if (CONFIG.dedication[1]) titleKids.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 },
    children: [new TextRun({ text: '— ' + CONFIG.dedication[1], font: FONT, size: 20, color: '555555' })] }));
}
sections.push({ properties: { ...pageProps, type: SectionType.NEXT_PAGE, titlePage: true },
  footers: { default: new Footer({ children: [new Paragraph({ children: [] })] }) }, children: titleKids });

let ch = 0;
for (const part of CONFIG.parts) {
  if (part.num || part.title) {
    sections.push({ properties: { ...pageProps, type: SectionType.ODD_PAGE }, footers: { default: footer }, children: [
      new Paragraph({ spacing: { before: 4800 } }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
        children: [new TextRun({ text: part.num || '', font: FONT, size: 26, characterSpacing: 80, color: '7A6A45' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: part.title || '', font: FONT, size: 56, italics: true })] }),
    ] });
  }
  for (const f of fs.readdirSync(path.join(CONFIG.root, part.dir)).sort()) {
    if (!f.endsWith('.md')) continue;
    ch += 1;
    sections.push({ properties: { ...pageProps, type: SectionType.NEXT_PAGE },
      footers: { default: footer }, children: chapterChildren(part.dir, f, ch) });
  }
}

const doc = new Document({ creator: CONFIG.author, title: CONFIG.title,
  styles: { default: { document: { run: { font: FONT, size: 24 } } } }, sections });

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(CONFIG.output, buf);
  console.log(`written ${CONFIG.output}: ${buf.length} bytes, ${ch} chapters`);
});
