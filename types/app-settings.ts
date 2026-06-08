/** 导购演示 MVP 角色 */
export type AppRole = "guide" | "manager";

export interface MockStoreOption {
  id: string;
  name: string;
}

/** 写入 localStorage 的精简结构（门店名称由 mock 列表推导，亦可冗余持久化） */
export interface AppUserSettingsPersisted {
  role: AppRole;
  storeId: string;
}
