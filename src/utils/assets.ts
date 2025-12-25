// Asset loading helpers kept framework-agnostic.

export const loadImage = (url: string) =>
  new Promise<HTMLImageElement>(async (resolve, reject) => {
    try {
      // Fetch explicitly to avoid file:// quirks in packaged Electron.
      const resp = await fetch(url);

      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
      }

      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = (ev) => {
        console.error('Image load failed', url, ev);
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Image load failed: ${url}`));
      };
      img.src = objectUrl;
    } catch (err) {
      console.error('Image fetch failed', url, err);
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });

export const sortFrames = (record: Record<string, string>) =>
  Object.entries(record)
    // Skip macOS resource-fork files like ._1.png that break decoding in prod
    .filter(([key]) => !key.includes('/._'))
    .map(([key, value]) => {
      const match = key.match(/\/(\d+)\.png$/);

      return { url: value, idx: match ? Number(match[1]) : 0 };
    })
    .sort((a, b) => a.idx - b.idx)
    .map((f) => f.url);

export const loadFrames = async (map: Record<string, unknown>) => {
  const urls = sortFrames(map as Record<string, string>);
  
  return Promise.all(urls.map((u) => loadImage(u)));
};


