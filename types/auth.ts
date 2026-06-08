import type { AppRole } from "@/types/app-settings";

/** 登录成功后写入 localStorage（不含密码） */
export interface AuthSessionPersisted {
  username: string;
  displayName: string;
  employeeId: string;
  role: AppRole;
}
