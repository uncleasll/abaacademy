import type { Invoice, Payment, BillingPlan, PaymentInput, InvoiceInput } from "./financeTypes";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type Application,
  type AssessmentRecord,
  type AttendanceRecord,
  type AttendanceStatus,
  type ClassGroup,
  type HwStatus,
  type StaffUser,
  type Student,
} from "./mockData";

export interface ScheduleBlock {
  id: string;
  group: string;
  teacher: string;
  day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  start: string;
  end: string;
  color: string;
}

export interface ClassSessionEntry {
  studentId: string;
  attendance: AttendanceStatus;
  stars: number;
  hw: HwStatus;
  nextHw: string;
}

interface BootstrapData {
  invoices: Invoice[];
  payments: Payment[];
  billingPlans: BillingPlan[];
  students: Student[];
  applications: Application[];
  classGroups: ClassGroup[];
  staffUsers: StaffUser[];
  attendanceDates: string[];
  attendanceRecords: AttendanceRecord[];
  assessmentRecords: AssessmentRecord[];
  weeklySchedule: ScheduleBlock[];
  /** Today's date in the academy's timezone, as reported by the server. */
  today: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffUser["role"];
  status: StaffUser["status"];
  mustChangePassword: boolean;
  teacherAlias?: string;
}

interface AcademyStore extends BootstrapData {
  editStaff: (id: string, name: string) => Promise<void>;
  resetStaffPassword: (id: string, temporaryPassword: string) => Promise<void>;
  saveGroup: (id: string | null, payload: Omit<ClassGroup, "id" | "enrolled">) => Promise<void>;
  transferStudent: (id: string, groupId: string) => Promise<void>;
  recordPayment: (payload: PaymentInput) => Promise<void>;
  createInvoice: (payload: InvoiceInput) => Promise<void>;
  adjustInvoice: (id: string, payload: { amount: string; dueDate?: string; reason: string }) => Promise<void>;
  voidInvoice: (id: string, reason: string) => Promise<void>;
  saveBillingPlan: (payload: BillingPlan) => Promise<void>;
  voidPayment: (id: string, reason: string) => Promise<void>;
  saveSchedule: (blocks: ScheduleBlock[]) => Promise<void>;
  loading: boolean;
  authLoading: boolean;
  apiOnline: boolean;
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateStudent: (id: string, patch: Partial<Student>) => Promise<void>;
  saveClassSession: (date: string, entries: ClassSessionEntry[]) => Promise<void>;
  updateAttendanceRecord: (studentId: string, date: string, status: AttendanceStatus) => Promise<void>;
  updateAssessmentRecord: (record: AssessmentRecord) => Promise<void>;
  createApplication: (payload: Omit<Application, "id" | "submitted" | "status"> & { intakeMode?: "application" | "review" | "enroll" }) => Promise<Application>;
  updateApplicationStatus: (id: string, status: Application["status"]) => Promise<Application | undefined>;
  updateUserStatus: (id: string, status: StaffUser["status"]) => Promise<StaffUser | undefined>;
  createTelegramLink: (studentId: string) => Promise<string>;
  sendTelegramReminder: (studentId: string, invoiceId?: string) => Promise<void>;
  downloadFinanceExport: () => Promise<void>;
  downloadReceipts: () => Promise<void>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "aba_academy_token";
const USER_KEY = "aba_academy_user";

const fallbackData: BootstrapData = {
  invoices: [], payments: [], billingPlans: [],
  students: [], applications: [], classGroups: [], staffUsers: [],
  attendanceDates: [], attendanceRecords: [], assessmentRecords: [], weeklySchedule: [], today: "",
};

/** `status` 0 means the server could not be reached at all. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const AcademyContext = createContext<AcademyStore | null>(null);

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

function describeFailure(status: number, body: { detail?: unknown } | null, fallback: string) {
  const detail = body?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((item: { msg: string }) => item.msg).join("; ");
  if (status >= 500) return "The server had a problem. Please try again shortly.";
  return fallback || "The request could not be completed.";
}

async function send(path: string, init?: RequestInit, authToken?: string | null) {
  const token = authToken === undefined ? localStorage.getItem(TOKEN_KEY) : authToken;
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Cannot reach the server. Check your connection and try again.");
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, describeFailure(response.status, body, response.statusText));
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit, authToken?: string | null): Promise<T> {
  const response = await send(path, init, authToken);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function downloadFile(path: string, fallbackName: string) {
  const response = await send(path);
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  // Bumped whenever local data changes so a slower, older bootstrap response can never overwrite newer state.
  const requestVersion = useRef(0);
  const pendingWrites = useRef(0);
  const verifiedToken = useRef<string | null>(null);
  const assessmentQueue = useRef(new Map<string, { next: AssessmentRecord | null; running: Promise<void> }>());
  const [data, setData] = useState<BootstrapData>(fallbackData);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    ++requestVersion.current;
    setToken(null);
    setUser(null);
    setApiOnline(false);
    setData(fallbackData);
  };

  /** Every authenticated call goes through here so expiry and outages are handled in one place. */
  const guard = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      const result = await action();
      setApiOnline(true);
      return result;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) clearSession();
      // Validation and permission errors mean the server answered; only outages count as offline.
      else if (!(error instanceof ApiError) || error.status === 0 || error.status >= 500) setApiOnline(false);
      throw error;
    }
  };
  const api = <T,>(path: string, init?: RequestInit, authToken?: string | null) => guard(() => request<T>(path, init, authToken));

  const load = async (activeToken?: string | null) => {
    const version = ++requestVersion.current;
    const fresh = await api<Partial<BootstrapData>>("/api/bootstrap", undefined, activeToken);
    if (version === requestVersion.current) setData({ ...fallbackData, ...fresh });
  };

  const write = async <T,>(action: () => Promise<T>): Promise<T> => {
    ++pendingWrites.current;
    ++requestVersion.current;
    try {
      return await action();
    } finally {
      --pendingWrites.current;
      ++requestVersion.current;
    }
  };

  const refresh = async (activeToken: string | null = token) => {
    if (!activeToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      await load(activeToken);
    } catch {
      // guard() already recorded whether this was an outage or an expired session.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }
    if (verifiedToken.current === token) {
      // login() just verified this token and loaded the workspace.
      verifiedToken.current = null;
      setAuthLoading(false);
      return;
    }
    api<AuthUser>("/api/auth/me", undefined, token)
      .then((activeUser) => {
        setUser(activeUser);
        localStorage.setItem(USER_KEY, JSON.stringify(activeUser));
        if (!activeUser.mustChangePassword) return refresh(token);
      })
      .catch(() => {
        // An expired session was cleared by guard(); a brief outage keeps the user signed in and retries below.
      })
      .finally(() => setAuthLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || user?.mustChangePassword !== false) return;
    const synchronize = () => {
      // Never poll over unsaved edits or while a save is still travelling.
      if (document.visibilityState !== "visible" || pendingWrites.current > 0) return;
      void load(token).catch(() => undefined);
    };
    const interval = window.setInterval(synchronize, 30000);
    window.addEventListener("focus", synchronize);
    return () => { window.clearInterval(interval); window.removeEventListener("focus", synchronize); };
  }, [token, user?.mustChangePassword]);

  const store = useMemo<AcademyStore>(() => {
    const login: AcademyStore["login"] = async (email, password) => {
      const result = await request<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }, null);
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      verifiedToken.current = result.token;
      setToken(result.token);
      setUser(result.user);
      setApiOnline(true);
      if (!result.user.mustChangePassword) await refresh(result.token);
    };

    const changePassword: AcademyStore["changePassword"] = async (currentPassword, newPassword) => {
      // Not guarded: a wrong current password answers 400/401-style errors that must not end the session.
      const result = await request<{ token: string; user: AuthUser }>("/api/auth/change-password", {
        method: "POST", body: JSON.stringify({ currentPassword, newPassword }),
      }, token);
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setUser(result.user);
      setToken(result.token);
    };

    const logout: AcademyStore["logout"] = async () => {
      try {
        await request("/api/auth/logout", { method: "POST" }, token);
      } catch {
        // Stateless JWT logout is completed client-side even if the API is down.
      } finally {
        clearSession();
      }
    };

    /** Saves on the server, then reloads so every page shows what the server actually stored. */
    const mutate = async <T = unknown,>(path: string, payload: unknown, method = "POST", idempotent = false): Promise<T> => {
      // Preserve the request ID through network failures, reloads, and retries.
      const key = `aba-finance-request:${user?.id}:${path}:${JSON.stringify(payload)}`;
      const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
      if (idempotent) sessionStorage.setItem(key, requestId);
      const result = await write(() => api<T>(path, {
        method,
        body: payload === undefined ? undefined : JSON.stringify(idempotent ? { ...(payload as object), requestId } : payload),
      }));
      if (idempotent) sessionStorage.removeItem(key);
      // The save is confirmed; a failed reload only delays the display and the next sync repairs it.
      await load().catch(() => undefined);
      return result;
    };
    const done = (promise: Promise<unknown>) => promise.then(() => undefined);

    const editStaff: AcademyStore["editStaff"] = (id, name) => done(mutate(`/api/users/${id}`, { name }, "PATCH"));
    const resetStaffPassword: AcademyStore["resetStaffPassword"] = (id, temporaryPassword) => done(mutate(`/api/users/${id}/reset-password`, { temporaryPassword }));
    const saveGroup: AcademyStore["saveGroup"] = (id, payload) => done(mutate(id ? `/api/groups/${id}` : "/api/groups", payload, id ? "PUT" : "POST"));
    const transferStudent: AcademyStore["transferStudent"] = (id, groupId) => done(mutate(`/api/students/${id}/placement`, { groupId }, "PUT"));
    const recordPayment: AcademyStore["recordPayment"] = payload => done(mutate("/api/finance/payments", payload, "POST", true));
    const createInvoice: AcademyStore["createInvoice"] = payload => done(mutate("/api/finance/invoices", payload, "POST", true));
    const adjustInvoice: AcademyStore["adjustInvoice"] = (id, payload) => done(mutate(`/api/finance/invoices/${id}`, payload, "PATCH"));
    const voidInvoice: AcademyStore["voidInvoice"] = (id, reason) => done(mutate(`/api/finance/invoices/${id}/void`, { reason }));
    const saveBillingPlan: AcademyStore["saveBillingPlan"] = payload => done(mutate("/api/finance/billing-plan", payload, "PUT"));
    const voidPayment: AcademyStore["voidPayment"] = (id, reason) => done(mutate(`/api/finance/payments/${id}/void`, { reason }));
    const saveSchedule: AcademyStore["saveSchedule"] = blocks => done(mutate("/api/schedule", { blocks }, "PUT"));
    const updateStudent: AcademyStore["updateStudent"] = (id, patch) => done(mutate(`/api/students/${id}`, patch, "PATCH"));
    const saveClassSession: AcademyStore["saveClassSession"] = (date, entries) => done(mutate("/api/class-session", { date, entries }));
    const createApplication: AcademyStore["createApplication"] = payload => mutate<Application>("/api/applications", payload);
    const updateApplicationStatus: AcademyStore["updateApplicationStatus"] = (id, status) => mutate<Application>(`/api/applications/${id}/status`, { status }, "PATCH");
    const updateUserStatus: AcademyStore["updateUserStatus"] = (id, status) => mutate<StaffUser>(`/api/users/${id}/status`, { status }, "PATCH");

    const updateAttendanceRecord: AcademyStore["updateAttendanceRecord"] = async (studentId, date, status) => {
      await write(() => api("/api/attendance", { method: "PUT", body: JSON.stringify({ studentId, date, status }) }));
      setData((prev) => {
        const records = [
          ...prev.attendanceRecords.filter((record) => record.studentId !== studentId || record.date !== date),
          { studentId, date, present: status !== "absent", status },
        ];
        const own = records.filter((record) => record.studentId === studentId).sort((a, b) => a.date.localeCompare(b.date));
        const attendancePct = Math.round((own.filter((record) => record.present).length / own.length) * 100);
        const latest = own[own.length - 1];
        const attendance: AttendanceStatus = latest.status ?? (latest.present ? "present" : "absent");
        return {
          ...prev,
          attendanceRecords: records,
          attendanceDates: prev.attendanceDates.includes(date) ? prev.attendanceDates : [...prev.attendanceDates, date].sort(),
          students: prev.students.map((student) => (student.id === studentId ? { ...student, attendancePct, attendance } : student)),
        };
      });
    };

    const updateAssessmentRecord: AcademyStore["updateAssessmentRecord"] = (record) => {
      // Show the edit immediately, but send one request at a time per student so typing "85" can never
      // be overtaken by the earlier "8". Only the newest pending value is sent next.
      setData((prev) => ({
        ...prev,
        assessmentRecords: [
          ...prev.assessmentRecords.filter((item) => item.studentId !== record.studentId || item.quarter !== record.quarter),
          record,
        ],
      }));
      const key = `${record.studentId}:${record.quarter}`;
      const queued = assessmentQueue.current.get(key);
      if (queued) {
        queued.next = record;
        return queued.running;
      }
      const entry = { next: null as AssessmentRecord | null, running: Promise.resolve() };
      assessmentQueue.current.set(key, entry);
      entry.running = write(async () => {
        try {
          for (let current: AssessmentRecord | null = record; current; current = entry.next) {
            entry.next = null;
            await api("/api/assessments", { method: "PUT", body: JSON.stringify(current) });
          }
        } finally {
          assessmentQueue.current.delete(key);
        }
      }).catch(async (error) => {
        // Drop the unsaved edit from the screen so it is never mistaken for a saved score.
        await load().catch(() => undefined);
        throw error;
      });
      return entry.running;
    };

    const createTelegramLink: AcademyStore["createTelegramLink"] = async (studentId) => {
      const result = await api<{ url: string }>(`/api/telegram/students/${studentId}/link`, { method: "POST" });
      return result.url;
    };

    const sendTelegramReminder: AcademyStore["sendTelegramReminder"] = async (studentId, invoiceId) => {
      await api("/api/telegram/reminders", {
        method: "POST",
        body: JSON.stringify({ studentId, invoiceId: invoiceId || null }),
      });
    };

    const downloadFinanceExport: AcademyStore["downloadFinanceExport"] = () => guard(() => downloadFile("/api/finance/export", "aba-tuition-report.csv"));
    const downloadReceipts: AcademyStore["downloadReceipts"] = () => guard(() => downloadFile("/api/finance/receipts", "aba-paid-receipts.csv"));

    return {
      ...data,
      editStaff, resetStaffPassword, saveGroup, transferStudent,
      recordPayment, createInvoice, adjustInvoice, voidInvoice, saveBillingPlan, voidPayment, saveSchedule,
      loading,
      authLoading,
      apiOnline,
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      changePassword,
      logout,
      refresh,
      updateStudent,
      saveClassSession,
      updateAttendanceRecord,
      updateAssessmentRecord,
      createApplication,
      updateApplicationStatus,
      updateUserStatus,
      createTelegramLink,
      sendTelegramReminder,
      downloadFinanceExport,
      downloadReceipts,
    };
  }, [data, loading, authLoading, apiOnline, token, user]);

  return <AcademyContext.Provider value={store}>{children}</AcademyContext.Provider>;
}

export function useAcademy() {
  const context = useContext(AcademyContext);
  if (!context) throw new Error("useAcademy must be used inside AcademyProvider");
  return context;
}
