// Photos picked or pasted into the web chat, shrunk in the browser before upload: phone
// photos are 3-12 MB and a Vercel function accepts at most 4.5 MB per request. The server
// re-normalizes to a 1568px JPEG anyway, so nothing is lost.

const MAX_EDGE = 1600;
const MAX_RAW_BYTES = 3 * 1024 * 1024; // when the browser can't decode it (HEIC in Chrome), send as-is up to this

export const MAX_CHAT_IMAGES = 3; // the chat API reads up to 3

export interface ChatImage {
  id: string;
  /** data: URL sent to /api/chat and used for the preview. */
  dataUrl: string;
  name: string;
}

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("couldn't read the file"));
    reader.readAsDataURL(file);
  });
}

export async function toChatImage(file: File): Promise<ChatImage> {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Not decodable here (e.g. HEIC outside Safari): the server converts HEIC itself.
    if (file.size > MAX_RAW_BYTES) throw new Error(`${file.name || "That photo"} is too large in this format. Try a JPEG or PNG, or a screenshot.`);
    return { id, dataUrl: await readAsDataUrl(file), name: file.name };
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("couldn't process the image");
  ctx.fillStyle = "#fff"; // transparent PNGs get a white background, like the server does
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return { id, dataUrl: canvas.toDataURL("image/jpeg", 0.85), name: file.name };
}

/** Image files from a paste or drop event (screenshots, copied images). */
export function imageFiles(data: DataTransfer | null): File[] {
  if (!data) return [];
  return [...data.files].filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
}
