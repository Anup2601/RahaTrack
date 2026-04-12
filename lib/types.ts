export type EntityStatus = "active" | "disabled" | "pending";
export type WorkStatus = "not started" | "progress" | "delay" | "complete";

export interface AppUser {
  id: string;
  email: string;
}

export interface Section {
  id: string;
  name: string;
  status: EntityStatus;
  createdAt?: string;
}

export interface Annexure {
  id: string;
  sectionId: string;
  name: string;
  status: EntityStatus;
}

export interface DynamicRow {
  id: string;
  status: EntityStatus;
  [key: string]: string | number | boolean;
}

export interface TableDoc {
  id: string;
  annexureId: string;
  columns: string[];
  rows: DynamicRow[];
  status: EntityStatus;
}

export interface NestedTableDoc {
  id: string;
  parentRowId: string;
  columns: string[];
  rows: DynamicRow[];
  status: EntityStatus;
}

export interface AttachmentDoc {
  id: string;
  annexureId: string;
  name: string;
  fileUrl: string;
  filePath: string;
  status: EntityStatus;
  createdAt?: string;
}

export interface ContactDoc {
  id: string;
  annexureId: string;
  name: string;
  email: string;
  number: string;
  status: EntityStatus;
}

export interface AnnexureTableRow {
  id: string;
  requirements: string;
  attachment: string;
  concernedTeamMembers: string;
  currentStatus: WorkStatus;
  latestRemark: string;
  status?: EntityStatus;
}

export interface LogRow {
  id: string;
  sNo: string;
  date: string;
  time: string;
  username: string;
  status: WorkStatus;
  remark: string;
}
