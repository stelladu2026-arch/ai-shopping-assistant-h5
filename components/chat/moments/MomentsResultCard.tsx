"use client";

import type { ReactNode } from "react";
import { downloadImageToDevice } from "@/lib/downloadImage";
import type { MomentsGenerationResult } from "@/types/agent";

interface MomentsResultCardProps {
  data: MomentsGenerationResult;
  /** 下载结果提示（如 Toast） */
  onDownloadHint?: (message: string) => void;
  /** 标题栏右侧，如收藏按钮 */
  headerTrailing?: ReactNode;
}

function buildCopyPayload(data: MomentsGenerationResult): string {
  const lines: string[] = [];
  if (data.bodyTitle) lines.push(data.bodyTitle);
  if (data.bodyText) lines.push(data.bodyText);
  if (data.hashtags.length) {
    lines.push(data.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" "));
  }
  if (data.generatedImageUrl && !data.generatedImageUrl.startsWith("data:")) lines.push(data.generatedImageUrl);
  else if (!data.generatedImageUrl && data.imagePlaceholder?.trim()) lines.push(data.imagePlaceholder);
  if (data.commentThreadScript?.trim()) lines.push(data.commentThreadScript);
  return lines.join("\n\n");
}

export function MomentsResultCard({ data, onDownloadHint, headerTrailing }: MomentsResultCardProps) {
  const { outputKind } = data;
  const showCopyBlock = outputKind === "copy_only" || outputKind === "rich";
  const showImageBlock = outputKind === "image_only" || outputKind === "rich";
  const showComment = outputKind === "copy_only" || outputKind === "rich";

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyPayload(data));
      onDownloadHint?.("已复制到剪贴板");
    } catch {
      onDownloadHint?.("复制失败，请重试");
    }
  };

  const onDownloadImage = async () => {
    if (!data.generatedImageUrl?.trim()) return;
    const name = `${data.cardTitle || "朋友圈配图"}.jpg`;
    const { ok, hint } = await downloadImageToDevice(data.generatedImageUrl, name);
    if (hint) onDownloadHint?.(hint);
    else if (ok) onDownloadHint?.("已开始保存图片");
    else onDownloadHint?.("保存失败，请长按图片保存到相册");
  };

  return (
    <div className="mt-2 overflow-hidden rounded-saas border border-slate-200/70 bg-white shadow-surfaceLg ring-1 ring-slate-900/[0.04]">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-white px-3 py-2.5">
        <span className="min-w-0 flex-1 text-[0.78rem] font-bold leading-snug text-slate-900">{data.cardTitle}</span>
        {headerTrailing ? <div className="flex shrink-0 items-center">{headerTrailing}</div> : null}
      </div>

      <div className="space-y-3 px-3 py-3">
        {showCopyBlock ? (
          <>
            {data.bodyTitle ? (
              <div>
                <p className="text-[0.65rem] font-semibold text-slate-400">标题</p>
                <p className="mt-1 text-[0.95rem] font-bold leading-snug text-slate-900">
                  {data.bodyTitle}
                </p>
              </div>
            ) : null}
            {data.bodyText ? (
              <div>
                <p className="text-[0.65rem] font-semibold text-slate-400">正文</p>
                <p className="mt-1 whitespace-pre-wrap text-[0.88rem] font-medium leading-relaxed text-slate-800">
                  {data.bodyText}
                </p>
              </div>
            ) : null}
            {data.hashtags.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {data.hashtags.map((h) => (
                  <span
                    key={h}
                    className="rounded-md bg-slate-100 px-2 py-0.5 text-[0.72rem] font-semibold text-brand-800"
                  >
                    {h.startsWith("#") ? h : `#${h}`}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {showImageBlock ? (
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.65rem] font-semibold text-slate-400">配图</p>
              {data.generatedImageUrl ? (
                <button
                  type="button"
                  onClick={() => void onDownloadImage()}
                  className="shrink-0 rounded-lg border border-slate-200/80 bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-slate-700 shadow-sm active:bg-slate-100"
                >
                  下载图片
                </button>
              ) : null}
            </div>
            {data.generatedImageUrl ? (
              <img
                src={data.generatedImageUrl}
                alt="AI 生成配图"
                className="mt-2 h-48 w-full rounded-xl object-cover"
              />
            ) : (
              <div className="mt-2 flex aspect-[4/3] max-h-48 items-center justify-center overflow-auto rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-center text-[0.75rem] font-medium leading-relaxed text-slate-400">
                {data.imagePlaceholder?.trim() || "演示回放、待核对"}
              </div>
            )}
            {data.imageSuggestion?.trim() ? (
              <p className="mt-2 text-[0.82rem] font-medium leading-relaxed text-slate-700">
                {data.imageSuggestion}
              </p>
            ) : null}
          </div>
        ) : null}

        {showComment && data.commentThreadScript?.trim() ? (
          <div>
            <p className="text-[0.65rem] font-semibold text-slate-400">评论区话术</p>
            <blockquote className="mt-1 border-l-[3px] border-brand-400 bg-brand-50/50 py-2 pl-3 pr-2 text-[0.82rem] font-medium italic leading-relaxed text-slate-800">
              {data.commentThreadScript}
            </blockquote>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-100 bg-white px-3 py-2.5">
        <button
          type="button"
          onClick={onCopy}
          className="flex w-full items-center justify-center rounded-xl bg-brand-600 py-2.5 text-[0.8rem] font-bold text-white shadow-sm transition-colors duration-75 active:bg-brand-700"
        >
          一键复制
        </button>
      </div>
    </div>
  );
}
