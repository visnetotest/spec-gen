/**
 * HTML asset-import parsing (decision b555b680).
 *
 * `parseHtmlAssetImports` turns `<script src>` and `<link rel=stylesheet href>`
 * into ImportInfo entries the dependency graph resolves into file→file edges.
 * External/CDN URLs, data URIs, anchors, root-absolute hrefs, and non-stylesheet
 * links must NOT produce imports; bare hrefs must be normalized to `./…`.
 */
import { describe, it, expect } from 'vitest';
import { parseHtmlAssetImports } from './import-parser.js';

describe('parseHtmlAssetImports', () => {
  it('extracts a script src and a stylesheet link, normalized to ./', () => {
    const html =
      '<link rel="stylesheet" href="style.css">\n' +
      '<script src="app.js"></script>';
    const imps = parseHtmlAssetImports(html);
    const sources = imps.map((i) => i.source).sort();
    expect(sources).toEqual(['./app.js', './style.css']);
    for (const i of imps) {
      expect(i.isRelative).toBe(true);
      expect(i.isPackage).toBe(false);
      expect(i.importedNames).toEqual([]);
    }
    expect(imps.find((i) => i.source === './app.js')!.assetKind).toBe('script');
    expect(imps.find((i) => i.source === './style.css')!.assetKind).toBe('stylesheet');
  });

  it('keeps explicit relative prefixes and resolves nested paths', () => {
    const html =
      '<script src="../shared/util.js"></script>' +
      '<link rel="stylesheet" href="./css/main.css">';
    const sources = parseHtmlAssetImports(html).map((i) => i.source).sort();
    expect(sources).toEqual(['../shared/util.js', './css/main.css']);
  });

  it('excludes external, protocol-relative, data, anchor and root-absolute refs', () => {
    const html = [
      '<script src="https://cdn.example/app.js"></script>',
      '<script src="//cdn.example/x.js"></script>',
      '<link rel="stylesheet" href="/assets/site.css">',          // root-absolute → out of scope
      '<link rel="stylesheet" href="data:text/css,body{}">',
      '<a href="#top">top</a>',
    ].join('\n');
    expect(parseHtmlAssetImports(html)).toEqual([]);
  });

  it('only treats rel=stylesheet links as imports', () => {
    const html = [
      '<link rel="preload" href="font.woff2">',
      '<link rel="icon" href="favicon.ico">',
      '<link rel="manifest" href="site.webmanifest">',
      '<link rel="stylesheet" href="real.css">',
    ].join('\n');
    const sources = parseHtmlAssetImports(html).map((i) => i.source);
    expect(sources).toEqual(['./real.css']);
  });

  it('strips query strings and fragments, tolerates quote style and attribute order', () => {
    const html =
      "<script src='app.js?v=2'></script>" +
      '<link href="theme.css#dark" rel=stylesheet>';
    const sources = parseHtmlAssetImports(html).map((i) => i.source).sort();
    expect(sources).toEqual(['./app.js', './theme.css']);
  });

  it('returns line numbers', () => {
    const html = '<html>\n<head>\n<script src="app.js"></script>\n</head>';
    expect(parseHtmlAssetImports(html)[0].line).toBe(3);
  });

  it('ignores commented-out tags (no phantom edges) and keeps line numbers', () => {
    const html =
      '<head>\n' +
      '<!-- <script src="old.js"></script> -->\n' +   // line 2 — must be ignored
      '<script src="app.js"></script>\n';             // line 3 — kept
    const imps = parseHtmlAssetImports(html);
    expect(imps.map((i) => i.source)).toEqual(['./app.js']);
    expect(imps[0].line).toBe(3); // comment blanking preserved the line number
  });

  it('detects order-independent multi-token rel but not data-rel decoys', () => {
    const html = [
      '<link rel="preload stylesheet" href="a.css">', // reversed multi-token → IS a stylesheet
      '<link data-rel="stylesheet" href="b.css">',    // decoy attribute → NOT a stylesheet
    ].join('\n');
    const sources = parseHtmlAssetImports(html).map((i) => i.source);
    expect(sources).toEqual(['./a.css']);
  });

  it('handles a script tag whose attributes span multiple lines', () => {
    const html = '<script\n  defer\n  src="app.js"\n></script>';
    expect(parseHtmlAssetImports(html).map((i) => i.source)).toEqual(['./app.js']);
  });
});
