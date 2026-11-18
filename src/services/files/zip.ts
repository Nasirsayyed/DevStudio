import { saveAs } from 'file-saver';

export interface ZipEntry {
  path: string;
  content: string;
}

/** Bundles text files into a ZIP and downloads it (JSZip is loaded on demand). */
export async function downloadZip(entries: readonly ZipEntry[], zipName: string): Promise<void> {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  for (const e of entries) zip.file(e.path, e.content);
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  saveAs(blob, zipName, { autoBom: false });
}
