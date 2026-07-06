// Client-side preparation of an uploaded lead-sheet scan: images are
// downscaled to the model's maximum useful resolution (2576px long edge)
// and re-encoded; PDFs pass through untouched.

export const ACCEPTED_SCAN_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

const MAX_IMAGE_DIMENSION = 2576;
const MAX_UNPROCESSED_BYTES = 4_000_000;

export type PreparedScan = {
  mediaType: string;
  dataBase64: string;
  previewUrl: string;
  fileName: string;
};

export async function prepareScanForUpload(file: File): Promise<PreparedScan> {
  if (!ACCEPTED_SCAN_TYPES.includes(file.type)) {
    throw new Error("Upload a PNG, JPG, WebP, or PDF lead sheet.");
  }

  if (file.type === "application/pdf") {
    // The full PDF goes to the API (multi-page charts keep working); the
    // preview is a rasterized first page so the UI can show a plain image.
    return {
      mediaType: file.type,
      dataBase64: await fileToBase64(file),
      previewUrl: await rasterizePdfFirstPage(file).catch(() => ""),
      fileName: file.name,
    };
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(
    1,
    MAX_IMAGE_DIMENSION / Math.max(bitmap.width, bitmap.height),
  );

  if (scale === 1 && file.size <= MAX_UNPROCESSED_BYTES) {
    return {
      mediaType: file.type,
      dataBase64: await fileToBase64(file),
      previewUrl: URL.createObjectURL(file),
      fileName: file.name,
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Couldn't process the image in this browser.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  return {
    mediaType: "image/jpeg",
    dataBase64: dataUrl.split(",")[1],
    previewUrl: dataUrl,
    fileName: file.name,
  };
}

// Preview size persisted with a session. Full scan bytes never go to
// localStorage (they're only needed for the extraction API call), so this is
// also what "view full size" shows after a reload.
const COMPACT_PREVIEW_LONG_EDGE = 1000;

const compactPreviewCache = new Map<string, string>();

// Downscale a preview (data or blob URL) to a storable JPEG data URL. Cached
// by input URL: the debounced session save calls this on every write.
export async function createCompactPreview(previewUrl: string): Promise<string> {
  if (!previewUrl) return "";
  const cached = compactPreviewCache.get(previewUrl);
  if (cached !== undefined) return cached;

  const image = new Image();
  image.src = previewUrl;
  await image.decode();
  const scale = Math.min(
    1,
    COMPACT_PREVIEW_LONG_EDGE / Math.max(image.width, image.height),
  );

  let compact: string;
  if (scale === 1 && previewUrl.startsWith("data:image/jpeg")) {
    compact = previewUrl;
  } else {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const context = canvas.getContext("2d");
    if (!context) return "";
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    compact = canvas.toDataURL("image/jpeg", 0.8);
  }
  compactPreviewCache.set(previewUrl, compact);
  return compact;
}

const PDF_PREVIEW_LONG_EDGE = 1600;

async function rasterizePdfFirstPage(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const pdfDocument = await pdfjs.getDocument({ data }).promise;
  const page = await pdfDocument.getPage(1);

  const baseViewport = page.getViewport({ scale: 1 });
  const scale =
    PDF_PREVIEW_LONG_EDGE / Math.max(baseViewport.width, baseViewport.height);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.9);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(new Error("Couldn't read the file."));
    reader.readAsDataURL(file);
  });
}
