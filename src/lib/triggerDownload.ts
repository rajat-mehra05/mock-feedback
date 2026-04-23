// GitHub asset URLs carry `Content-Disposition: attachment`, so the browser
// saves without navigating. The link must be in the DOM before `click()`.
export function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}
