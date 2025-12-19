// Asset loading helpers kept framework-agnostic.
export const loadImage = (url: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = reject;
  });

export const sortFrames = (record: Record<string, string>) =>
  Object.entries(record)
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

