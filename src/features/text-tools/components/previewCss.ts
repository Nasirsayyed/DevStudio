/** Base styles of the Markdown/HTML preview frame (a separate document, so no MUI theme). */
export function previewCss(mode: 'light' | 'dark', markdown: boolean): string {
  const dark = mode === 'dark';
  const fg = dark ? '#e6e8ee' : '#1f2330';
  const muted = dark ? '#9aa3b5' : '#5b6275';
  const border = dark ? '#2b3240' : '#dfe3ea';
  const code = dark ? '#161b24' : '#f4f6f9';
  const link = dark ? '#8b9cff' : '#4f46e5';
  const base = `:root{color-scheme:${mode}}html,body{margin:0;background:${dark ? '#0f131b' : '#ffffff'};color:${fg}}`;
  if (!markdown) return `${base}body{font-family:system-ui,sans-serif;padding:16px}`;
  return `${base}
body{font:15px/1.65 Inter,system-ui,-apple-system,"Segoe UI",sans-serif;padding:20px 28px;max-width:920px;margin:0 auto;overflow-wrap:anywhere}
h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.4em 0 .6em}h1,h2{padding-bottom:.3em;border-bottom:1px solid ${border}}
h1:first-child,h2:first-child{margin-top:0}a{color:${link}}p,ul,ol,blockquote,table,pre{margin:0 0 1em}
code{font:13px/1.5 "JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;background:${code};padding:.15em .35em;border-radius:5px}
pre{background:${code};padding:12px 14px;border-radius:8px;overflow:auto}pre code{background:none;padding:0}
blockquote{margin-left:0;padding:0 1em;color:${muted};border-left:4px solid ${border}}
table{border-collapse:collapse;display:block;overflow:auto}th,td{border:1px solid ${border};padding:6px 12px}th{background:${code}}
img{max-width:100%}hr{border:0;border-top:1px solid ${border};margin:1.5em 0}li>input[type=checkbox]{margin-right:.4em}
ul:has(> li > input[type=checkbox]){list-style:none;padding-left:1.2em}`;
}
