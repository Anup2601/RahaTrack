import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  AnnexureRowStatus,
  Annexure,
  AnnexureTableRow,
  AppUser,
  AttachmentDoc,
  ContactDoc,
  DynamicRow,
  EntityStatus,
  LogRow,
  NestedTableDoc,
  Section,
  TableDoc,
  UserRole,
  WorkStatus,
} from "@/lib/types";

const toAnnexureRowStatus = (value: unknown): AnnexureRowStatus => {
  const normalized = String(value ?? "").trim().toLowerCase();

  if (normalized === "completed" || normalized === "complete") {
    return "completed";
  }

  if (normalized === "under review" || normalized === "progress") {
    return "under review";
  }

  return "pending";
};

const usersCollection = collection(db, "users");
const sectionsCollection = collection(db, "sections");
const annexuresCollection = collection(db, "annexures");
const tablesCollection = collection(db, "tables");
const nestedTablesCollection = collection(db, "nestedTables");
const attachmentsCollection = collection(db, "attachments");
const contactsCollection = collection(db, "contacts");

const roles: UserRole[] = ["superadmin", "analyst", "viewer"];

const isRole = (value: unknown): value is UserRole => {
  return roles.includes(value as UserRole);
};

const toIsoDate = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object" || !("toDate" in value)) {
    return undefined;
  }

  return (value as { toDate: () => Date }).toDate().toISOString();
};

const getNestedTableByParentRow = async (parentRowId: string) => {
  const q = query(nestedTablesCollection, where("parentRowId", "==", parentRowId), limit(1));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return null;
  }

  const nestedDoc = snapshot.docs[0];
  const data = nestedDoc.data();

  return {
    id: nestedDoc.id,
    parentRowId: data.parentRowId,
    columns: data.columns ?? ["detail", "value", "note"],
    rows: data.rows ?? [],
    status: data.status ?? "active",
  } as NestedTableDoc;
};

export const ensureUserDocument = async (payload: AppUser) => {
  const ref = doc(usersCollection, payload.id);
  const snapshot = await getDoc(ref);
  const existing = snapshot.exists() ? snapshot.data() : null;

  await setDoc(
    ref,
    {
      id: payload.id,
      email: payload.email,
      role: isRole(existing?.role) ? existing.role : payload.role,
      name: payload.name ?? existing?.name ?? null,
      createdAt: existing?.createdAt ?? serverTimestamp(),
    },
    { merge: true },
  );
};

export const getUserById = async (id: string): Promise<AppUser | null> => {
  const snapshot = await getDoc(doc(usersCollection, id));

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();

  return {
    id: snapshot.id,
    email: String(data.email ?? ""),
    role: isRole(data.role) ? data.role : "viewer",
    name: data.name ? String(data.name) : undefined,
    createdAt: toIsoDate(data.createdAt),
  };
};

export const subscribeUsers = (
  onData: (data: AppUser[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(usersCollection, orderBy("email", "asc"));

  return onSnapshot(
    q,
    (snapshot) => {
      const users = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          email: String(data.email ?? ""),
          role: isRole(data.role) ? data.role : "viewer",
          name: data.name ? String(data.name) : undefined,
          createdAt: toIsoDate(data.createdAt),
        } as AppUser;
      });

      onData(users);
    },
    (error) => {
      console.error("subscribeUsers listener error:", error);
      onError?.(error);
    },
  );
};

export const subscribeSections = (
  onData: (data: Section[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(sectionsCollection, orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      const sections = snapshot.docs.map((item) => {
        const data = item.data();
        return {
          id: item.id,
          name: data.name,
          status: data.status,
          createdAt: toIsoDate(data.createdAt),
        } as Section;
      });

      onData(sections);
    },
    (error) => {
      console.error("subscribeSections listener error:", error);
      onError?.(error);
    },
  );
};

export const createSection = async (name: string) => {
  return addDoc(sectionsCollection, {
    name,
    status: "active" as EntityStatus,
    createdAt: serverTimestamp(),
  });
};

export const updateSectionStatus = async (id: string, status: EntityStatus) => {
  await updateDoc(doc(sectionsCollection, id), { status });
};

export const getSectionById = async (id: string) => {
  const snapshot = await getDoc(doc(sectionsCollection, id));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    name: data.name,
    status: data.status,
    createdAt: toIsoDate(data.createdAt),
  } as Section;
};

export const subscribeAnnexuresBySection = (
  sectionId: string,
  onData: (data: Annexure[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(annexuresCollection, where("sectionId", "==", sectionId));

  return onSnapshot(
    q,
    (snapshot) => {
      const annexures = snapshot.docs
        .map((item) => {
          const data = item.data();
          return {
            id: item.id,
            sectionId: data.sectionId,
            name: data.name,
            status: data.status,
            createdAt: toIsoDate(data.createdAt),
          } as Annexure;
        })
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;

          if (aTime === bTime) {
            return a.name.localeCompare(b.name);
          }

          return aTime - bTime;
        });

      onData(annexures);
    },
    (error) => {
      console.error("subscribeAnnexuresBySection listener error:", error);
      onError?.(error);
    },
  );
};

export const createAnnexure = async (sectionId: string, name: string) => {
  return addDoc(annexuresCollection, {
    sectionId,
    name,
    status: "active" as EntityStatus,
    createdAt: serverTimestamp(),
  });
};

export const updateAnnexureStatus = async (id: string, status: EntityStatus) => {
  await updateDoc(doc(annexuresCollection, id), { status });
};

export const getAnnexureById = async (id: string) => {
  const snapshot = await getDoc(doc(annexuresCollection, id));
  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data();
  return {
    id: snapshot.id,
    sectionId: data.sectionId,
    name: data.name,
    status: data.status,
    createdAt: toIsoDate(data.createdAt),
  } as Annexure;
};

export const getOrCreateTableByAnnexure = async (annexureId: string): Promise<TableDoc> => {
  const q = query(tablesCollection, where("annexureId", "==", annexureId), limit(1));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const tableDoc = snapshot.docs[0];
    const data = tableDoc.data();

    return {
      id: tableDoc.id,
      annexureId: data.annexureId,
      columns: data.columns ?? [],
      rows: data.rows ?? [],
      status: data.status ?? "active",
    };
  }

  const created = await addDoc(tablesCollection, {
    annexureId,
    columns: ["name", "value", "remarks"],
    rows: [],
    status: "active" as EntityStatus,
  });

  return {
    id: created.id,
    annexureId,
    columns: ["name", "value", "remarks"],
    rows: [],
    status: "active",
  };
};

export const saveTableData = async (
  tableId: string,
  rows: DynamicRow[],
  columns: string[],
  status: EntityStatus,
) => {
  await updateDoc(doc(tablesCollection, tableId), {
    rows,
    columns,
    status,
  });
};

export const getOrCreateNestedTableByParentRow = async (
  parentRowId: string,
): Promise<NestedTableDoc> => {
  const nestedTable = await getNestedTableByParentRow(parentRowId);

  if (nestedTable) {
    return nestedTable;
  }

  const created = await addDoc(nestedTablesCollection, {
    parentRowId,
    columns: ["detail", "value", "note"],
    rows: [],
    status: "active" as EntityStatus,
  });

  return {
    id: created.id,
    parentRowId,
    columns: ["detail", "value", "note"],
    rows: [],
    status: "active",
  };
};

export const saveNestedTableData = async (
  tableId: string,
  rows: DynamicRow[],
  columns: string[],
  status: EntityStatus,
) => {
  await updateDoc(doc(nestedTablesCollection, tableId), {
    rows,
    columns,
    status,
  });
};

export const subscribeAttachmentsByAnnexure = (
  annexureId: string,
  onData: (data: AttachmentDoc[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(attachmentsCollection, where("annexureId", "==", annexureId));

  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs
        .map((item) => {
          const raw = item.data();
          return {
            id: item.id,
            annexureId: raw.annexureId,
            name: raw.name,
            fileUrl: raw.fileUrl,
            filePath: raw.filePath,
            status: raw.status,
            createdAt: toIsoDate(raw.createdAt),
          } as AttachmentDoc;
        })
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      onData(data);
    },
    (error) => {
      console.error("subscribeAttachmentsByAnnexure listener error:", error);
      onError?.(error);
    },
  );
};

export const createAttachment = async (payload: {
  annexureId: string;
  name: string;
  fileUrl: string;
  filePath: string;
}) => {
  await addDoc(attachmentsCollection, {
    ...payload,
    status: "active" as EntityStatus,
    createdAt: serverTimestamp(),
  });
};

export const updateAttachment = async (id: string, name: string) => {
  await updateDoc(doc(attachmentsCollection, id), { name });
};

export const updateAttachmentStatus = async (id: string, status: EntityStatus) => {
  await updateDoc(doc(attachmentsCollection, id), { status });
};

export const deleteAttachment = async (id: string) => {
  await deleteDoc(doc(attachmentsCollection, id));
};

export const subscribeContactsByAnnexure = (
  annexureId: string,
  onData: (data: ContactDoc[]) => void,
  onError?: (error: Error) => void,
) => {
  const q = query(contactsCollection, where("annexureId", "==", annexureId));

  return onSnapshot(
    q,
    (snapshot) => {
      const data = snapshot.docs
        .map((item) => {
          const raw = item.data();
          return {
            id: item.id,
            annexureId: raw.annexureId,
            name: raw.name,
            email: raw.email,
            number: raw.number,
            status: raw.status,
          } as ContactDoc;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      onData(data);
    },
    (error) => {
      console.error("subscribeContactsByAnnexure listener error:", error);
      onError?.(error);
    },
  );
};

export const createContact = async (payload: {
  annexureId: string;
  name: string;
  email: string;
  number: string;
}) => {
  await addDoc(contactsCollection, {
    ...payload,
    status: "active" as EntityStatus,
  });
};

export const updateContact = async (
  id: string,
  payload: { name: string; email: string; number: string },
) => {
  await updateDoc(doc(contactsCollection, id), payload);
};

export const updateContactStatus = async (id: string, status: EntityStatus) => {
  await updateDoc(doc(contactsCollection, id), { status });
};

export const getAnnexureStatusRows = async (annexureId: string): Promise<AnnexureTableRow[]> => {
  const table = await getOrCreateTableByAnnexure(annexureId);
  return table.rows.map((row) => {
    return {
      id: row.id,
      requirements: String(row.requirements ?? row.team ?? ""),
      attachment: String(row.attachment ?? ""),
      concernedTeamMembers: String(row.concernedTeamMembers ?? ""),
      currentStatus: toAnnexureRowStatus(row.currentStatus),
      latestRemark: String(row.latestRemark ?? ""),
      status: (row.status as EntityStatus) || "active",
    } as AnnexureTableRow;
  });
};

export const saveAnnexureStatusRows = async (
  annexureId: string,
  rows: AnnexureTableRow[],
) => {
  const table = await getOrCreateTableByAnnexure(annexureId);
  const normalizedRows: DynamicRow[] = rows.map((row) => ({
    id: row.id,
    status: (row.status ?? "active") as EntityStatus,
    sNo: row.id,
    requirements: row.requirements,
    attachment: row.attachment,
    concernedTeamMembers: row.concernedTeamMembers,
    currentStatus: row.currentStatus,
    latestRemark: row.latestRemark,
  }));

  await saveTableData(
    table.id,
    normalizedRows,
    ["sNo", "requirements", "attachment", "concernedTeamMembers", "currentStatus", "latestRemark"],
    table.status,
  );
};

export const getAnnexureContextByRowId = async (
  parentRowId: string,
): Promise<{ annexureId: string; attachmentNames: string[] } | null> => {
  const snapshot = await getDocs(tablesCollection);

  for (const tableDoc of snapshot.docs) {
    const data = tableDoc.data();
    const rows = (data.rows ?? []) as DynamicRow[];
    const matchedRow = rows.find((row) => row.id === parentRowId);

    if (matchedRow) {
      const attachmentNames = String(matchedRow.attachment ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

      return {
        annexureId: String(data.annexureId ?? ""),
        attachmentNames,
      };
    }
  }

  return null;
};

export const getAttachmentsByAnnexure = async (annexureId: string): Promise<AttachmentDoc[]> => {
  const q = query(attachmentsCollection, where("annexureId", "==", annexureId));
  const snapshot = await getDocs(q);

  return snapshot.docs
    .map((item) => {
      const raw = item.data();
      return {
        id: item.id,
        annexureId: raw.annexureId,
        name: raw.name,
        fileUrl: raw.fileUrl,
        filePath: raw.filePath,
        status: raw.status,
        createdAt: toIsoDate(raw.createdAt),
      } as AttachmentDoc;
    })
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
};

export const getLogRowsByParentRow = async (parentRowId: string): Promise<LogRow[]> => {
  const nested = await getNestedTableByParentRow(parentRowId);

  if (!nested) {
    return [];
  }

  return nested.rows.map((row) => ({
    id: row.id,
    sNo: String(row.sNo ?? ""),
    date: String(row.date ?? ""),
    time: String(row.time ?? ""),
    username: String(row.username ?? row.mailTo ?? ""),
    status: (row.workStatus as WorkStatus) ?? "not started",
    remark: String(row.remark ?? ""),
  }));
};

export const saveLogRowsByParentRow = async (
  parentRowId: string,
  rows: LogRow[],
) => {
  const nested = await getOrCreateNestedTableByParentRow(parentRowId);
  const normalizedRows: DynamicRow[] = rows.map((row) => ({
    id: row.id,
    status: "active" as EntityStatus,
    sNo: row.sNo,
    date: row.date,
    time: row.time,
    username: row.username,
    workStatus: row.status,
    remark: row.remark,
  }));

  await saveNestedTableData(
    nested.id,
    normalizedRows,
    ["sNo", "date", "time", "username", "workStatus", "remark"],
    nested.status,
  );
};
