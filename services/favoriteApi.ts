/**
 * 收藏能力后端接口占位（未来替换 lib/favorites 的 localStorage 实现）
 */

import type { FavoriteRecord } from "@/types/session";

export async function fetchFavorites(_userId?: string): Promise<FavoriteRecord[]> {
  return [];
}

export async function createFavorite(_payload: Omit<FavoriteRecord, "id" | "createdAt">): Promise<FavoriteRecord | null> {
  return null;
}

export async function deleteFavoriteRemote(_id: string): Promise<boolean> {
  return false;
}
