/** Convert a stored base64 data URL back into a File for form injection. */
export function dataUrlToFile(dataUrl: string, name: string, type: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = type || /data:([^;]+)/.exec(header)?.[1] || 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}
