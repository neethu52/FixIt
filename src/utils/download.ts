/**
 * Downloads issue media (photo snapshot or recorded video) cleanly
 * Handles data URLs, blob URLs, and external URLs (fetching as blob to force download)
 */
export const downloadIssueMedia = async (url: string, filenamePrefix = 'issue-photo'): Promise<void> => {
  if (!url) return;

  try {
    const isVideo =
      url.startsWith('data:video') ||
      url.endsWith('.webm') ||
      url.endsWith('.mp4') ||
      url.includes('video/');

    let ext = isVideo ? 'webm' : 'jpg';
    if (url.includes('.png') || url.startsWith('data:image/png')) ext = 'png';
    else if (url.includes('.mp4') || url.startsWith('data:video/mp4')) ext = 'mp4';
    else if (url.includes('.webp') || url.startsWith('data:image/webp')) ext = 'webp';

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `${filenamePrefix}-${timestamp}.${ext}`;

    // Direct download for data URLs and local blob URLs
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Remote URLs (e.g. Unsplash or S3/CDN): fetch as Blob to trigger native download prompt
    const response = await fetch(url, { mode: 'cors' });
    if (!response.ok) throw new Error('Network fetch failed');
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
  } catch (err) {
    console.warn('Direct blob download failed, falling back to window navigation:', err);
    // Fallback: Open URL in new window/tab so user can save
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filenamePrefix}.jpg`;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};
