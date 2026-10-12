import { put } from "@vercel/blob";
import { randomUUID } from "node:crypto";
import { HttpError, handle, json } from "@/lib/http";
import { requireUser } from "@/lib/users";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Vercel functions accept request bodies up to about 4.5 MB, so keep uploads under that.
const MAX_BYTES = 4 * 1024 * 1024;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Stores one picture in Vercel Blob and returns its public https address. */
export const POST = handle(async (req: Request) => {
  const user = await requireUser(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "Choose a picture to upload.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(400, "Choose a picture to upload.");
  }
  if (file.size > MAX_BYTES) {
    throw new HttpError(413, "That picture is larger than 4 MB. Please choose a smaller one.");
  }
  const ext = EXTENSIONS[file.type];
  if (!ext) {
    throw new HttpError(400, "Only JPG, PNG, WebP or GIF pictures are allowed.");
  }

  const blob = await put(`links/${user.telegram_id}/${randomUUID()}.${ext}`, file, {
    access: "public",
    contentType: file.type,
    addRandomSuffix: false,
  });

  return json({ url: blob.url }, 201);
});
