import * as pdfjs from 'pdfjs-dist';
// Vite/WXT resolves `?url` to the bundled worker asset URL.
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Extract plain text from a resume PDF entirely in-browser (no upload). Runs in
 * the options page where the File is available; the extracted text is then sent
 * to the background worker for Claude structuring. This keeps the raw PDF on the
 * user's machine.
 */
export async function extractPdfText(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ');
    pages.push(text);
  }
  return pages.join('\n').replace(/\s+\n/g, '\n').trim();
}
