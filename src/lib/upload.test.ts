import { afterEach, describe, expect, it, vi } from "vitest";
import { upload } from "@vercel/blob/client";
import { uploadCommentPhoto, uploadPostMedia } from "./upload";

vi.mock("@vercel/blob/client", () => ({ upload: vi.fn() }));

const identity = { id: "guest", token: "token" };

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetAllMocks();
});

describe("original photo uploads", () => {
  it("uploads a single lightweight comment photo in the commenter's namespace", async () => {
    const original = new File(["original with metadata"], "photo.png", { type: "image/png" });
    const previewBlob = new Blob(["preview"], { type: "image/jpeg" });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 2000, height: 1000, close: vi.fn() }));
    vi.stubGlobal("document", { createElement: () => ({ getContext: () => ({ drawImage: vi.fn() }), toBlob: (callback: (blob: Blob) => void) => callback(previewBlob) }) });
    vi.mocked(upload).mockResolvedValue({ url: "comment-url" } as Awaited<ReturnType<typeof upload>>);
    expect(await uploadCommentPhoto(original, identity, vi.fn())).toBe("comment-url");
    expect(upload).toHaveBeenCalledExactlyOnceWith("comments/guest/preview-photo.jpg", expect.any(File), expect.objectContaining({ clientPayload: JSON.stringify({ kind: "image", scope: "comments" }) }));
    expect(await (vi.mocked(upload).mock.calls[0][1] as File).text()).toBe("preview");
  });

  it("uploads untouched original bytes plus a separate scaled JPEG preview", async () => {
    const original = new File(["original photo bytes and metadata"], "IMG_1.png", { type: "image/png" });
    const previewBlob = new Blob(["preview"], { type: "image/jpeg" });
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4032, height: 3024, close }));
    const toBlob = vi.fn((callback: (blob: Blob) => void) => callback(previewBlob));
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob };
    vi.stubGlobal("document", { createElement: () => canvas });
    const mockedUpload = vi.mocked(upload);
    mockedUpload.mockImplementation(async (_path, _file, options) => {
      options.onUploadProgress?.({ loaded: 1, total: 1, percentage: 100 });
      return { url: mockedUpload.mock.calls.length === 1 ? "original-url" : "preview-url" } as Awaited<ReturnType<typeof upload>>;
    });
    const progress = vi.fn();

    const result = await uploadPostMedia(original, "image", identity, progress);

    expect(result).toEqual({ url: "original-url", previewUrl: "preview-url" });
    expect(mockedUpload.mock.calls[0][1]).toBe(original);
    expect(await original.text()).toBe("original photo bytes and metadata");
    const preview = mockedUpload.mock.calls[1][1] as File;
    expect(preview.type).toBe("image/jpeg");
    expect(preview.name).toBe("preview-IMG_1.jpg");
    expect(canvas).toMatchObject({ width: 1600, height: 1200 });
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), "image/jpeg", 0.8);
    expect(close).toHaveBeenCalledOnce();
    expect(progress.mock.calls[0][0]).toBeLessThan(100);
    expect(progress).toHaveBeenLastCalledWith(100);
  });

  it("keeps an undecodable original and uses multipart for large photos", async () => {
    vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("Unsupported format")));
    const original = new File([new Uint8Array(9 * 1024 * 1024)], "IMG_1.heic", { type: "image/heic" });
    vi.mocked(upload).mockResolvedValue({ url: "original-url" } as Awaited<ReturnType<typeof upload>>);

    expect(await uploadPostMedia(original, "image", identity, vi.fn())).toEqual({ url: "original-url", previewUrl: null });
    expect(upload).toHaveBeenCalledExactlyOnceWith("posts/guest/IMG_1.heic", original, expect.objectContaining({ multipart: true, contentType: "image/heic" }));
  });

  it.each(["image/gif", "video/mp4"])("preserves %s without making a static preview", async (type) => {
    const decode = vi.fn();
    vi.stubGlobal("createImageBitmap", decode);
    const original = new File(["bytes"], type === "image/gif" ? "animated.gif" : "clip.mp4", { type });
    vi.mocked(upload).mockResolvedValue({ url: "original-url" } as Awaited<ReturnType<typeof upload>>);

    const result = await uploadPostMedia(original, type === "image/gif" ? "image" : "video", identity, vi.fn());
    expect(result.previewUrl).toBeNull();
    expect(decode).not.toHaveBeenCalled();
    expect(vi.mocked(upload).mock.calls[0][1]).toBe(original);
    expect(upload).toHaveBeenCalledOnce();
  });
});
