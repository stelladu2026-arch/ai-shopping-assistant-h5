/**
 * 尝试将图片下载到本地（移动端多数浏览器会进入「下载」或弹出保存，用户可从相册查看）。
 * 跨域资源优先 fetch 为 Blob；失败则退化为新窗口打开以便长按保存。
 */
export async function downloadImageToDevice(
  url: string,
  filename: string,
): Promise<{ ok: boolean; hint?: string }> {
  try {
    const res = await fetch(url, { mode: "cors", credentials: "omit" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename.replace(/[^\w.\u4e00-\u9fa5-]/g, "_") || "image.jpg";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return { ok: true, hint: "已开始保存图片" };
  } catch {
    try {
      const a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return { ok: true, hint: "已打开图片，可长按保存到相册" };
    } catch {
      return { ok: false, hint: "保存失败，请长按配图区域保存图片" };
    }
  }
}
