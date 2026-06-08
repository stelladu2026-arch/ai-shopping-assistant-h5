import type { MockStoreOption } from "@/types/app-settings";

/** 演示用门店列表 */
export const mockStores: MockStoreOption[] = [
  { id: "store_hz_01", name: "华东 · 上海徐汇旗舰店" },
  { id: "store_hz_02", name: "华东 · 杭州滨江店" },
  { id: "store_nc_01", name: "华北 · 北京朝阳店" },
  { id: "store_sw_01", name: "华南 · 广州天河店" },
];

export const DEFAULT_STORE_ID = mockStores[0]!.id;

export function getStoreNameById(storeId: string): string {
  return mockStores.find((s) => s.id === storeId)?.name ?? mockStores[0]!.name;
}
