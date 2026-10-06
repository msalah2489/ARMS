/** Compress an image file to a JPEG data URL suitable for localStorage. */

export type CompressedImage = {
  name: string;
  dataUrl: string;
};

const DEFAULT_MAX_EDGE = 960;
const DEFAULT_QUALITY = 0.72;

export async function compressImageFile(
  file: File,
  options?: { maxEdge?: number; quality?: number },
): Promise<CompressedImage> {
  const maxEdge = options?.maxEdge ?? DEFAULT_MAX_EDGE;
  const quality = options?.quality ?? DEFAULT_QUALITY;

  const dataUrl = await readFileAsDataUrl(file);
  const bitmap = await loadImage(dataUrl);

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { name: file.name, dataUrl };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);

  let compressed = canvas.toDataURL("image/jpeg", quality);
  // Fallback if canvas export fails for exotic types
  if (!compressed.startsWith("data:image")) {
    compressed = dataUrl;
  }

  return { name: file.name, dataUrl: compressed };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("تعذر قراءة الملف."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("تعذر تحميل الصورة."));
    img.src = src;
  });
}
