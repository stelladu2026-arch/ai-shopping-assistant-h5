import type { AppRole } from "@/types/app-settings";

/** 演示环境内置账号（明文口令仅用于本地 MVP，勿用于生产） */
export interface DemoLoginRecord {
  username: string;
  password: string;
  displayName: string;
  employeeId: string;
  role: AppRole;
}

export const DEMO_LOGIN_USERS: DemoLoginRecord[] = [
  {
    username: "guide01",
    password: "demo123",
    displayName: "王小雅",
    employeeId: "GD-1026",
    role: "guide",
  },
  {
    username: "manager01",
    password: "demo123",
    displayName: "李店长",
    employeeId: "GD-2001",
    role: "manager",
  },
];
