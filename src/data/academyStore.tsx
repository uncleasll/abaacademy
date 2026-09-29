import type { Invoice, Payment, BillingPlan, PaymentInput, InvoiceInput } from "./financeTypes";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  type Application,
  type AssessmentRecord,
  type AttendanceRecord,
  type ClassGroup,
  type StaffUser,
  type Student,
  type TuitionRecord,
} from "./mockData";

export interface Meeting {
  id: string;
  applicantId: string;
  day: string;
  time: string;
  type: string;
}

interface BootstrapData {
  invoices: Invoice[];
  payments: Payment[];
  billingPlans: BillingPlan[];
  students: Student[];
  applications: Application[];
  classGroups: ClassGroup[];
  staffUsers: StaffUser[];
  meetings: Meeting[];
  attendanceDates: string[];
  attendanceRecords: AttendanceRecord[];
  tuitionMonths: string[];
  tuitionRecords: TuitionRecord[];
  assessmentRecords: AssessmentRecord[];
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
  saveBillingPlan: (payload: BillingPlan) => Promise<void>;
  voidPayment: (id: string, reason: string) => Promise<void>;
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
  updateStudent: (id: string, patch: Partial<Student>) => Promise<Student | undefined>;
  updateAttendanceRecord: (studentId: string, date: string, present: boolean) => Promise<void>;
  updateTuitionRecord: (studentId: string, month: string, status: TuitionRecord["status"], amount: number) => Promise<void>;
  updateAssessmentRecord: (record: AssessmentRecord) => Promise<void>;
  createApplication: (payload: Omit<Application, "id" | "submitted" | "status"> & { intakeMode?: "application" | "review" | "enroll" }) => Promise<Application>;
  updateApplicationStatus: (id: string, status: Application["status"]) => Promise<Application | undefined>;
  createUser: (payload: Pick<StaffUser, "name" | "email" | "role">) => Promise<StaffUser & { temporaryPassword: string }>;
  updateUserStatus: (id: string, status: StaffUser["status"]) => Promise<StaffUser | undefined>;
  deleteUser: (id: string) => Promise<void>;
  createMeeting: (payload: Omit<Meeting, "id">) => Promise<Meeting>;
  deleteMeeting: (id: string) => Promise<void>;
  queueReminder: (payload: Record<string, unknown>) => Promise<void>;
  createTelegramLink: (studentId: string) => Promise<string>;
  sendTelegramReminder: (studentId: string, invoiceId?: string) => Promise<void>;
  prepareExport: (payload: Record<string, unknown>) => Promise<void>;
  downloadFinanceExport: () => Promise<void>;
  downloadReceipts: () => Promise<void>;
  reconcileFinance: () => Promise<{ totalDue: number; overdue: number; unpaid: number; paid: number }>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "aba_academy_token";
const USER_KEY = "aba_academy_user";

const fallbackData: BootstrapData = {
  invoices: [], payments: [], billingPlans: [],
  students: [], applications: [], classGroups: [], staffUsers: [], meetings: [],
  attendanceDates: [], attendanceRecords: [], tuitionMonths: [], tuitionRecords: [], assessmentRecords: [],
};

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

async function request<T>(path: string, init?: RequestInit, authToken?: string | null): Promise<T> {
  const token = authToken ?? localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`${response.status} ${typeof body?.detail === "string" ? body.detail : Array.isArray(body?.detail) ? body.detail.map((item: { msg: string }) => item.msg).join("; ") : response.statusText}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

async function downloadFile(path: string, fallbackName: string, authToken?: string | null) {
  const token = authToken ?? localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
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
  URL.revokeObjectURL(url);
}

export function AcademyProvider({ children }: { children: ReactNode }) {
  const requestVersion = useRef(0);
  const [data, setData] = useState<BootstrapData>(fallbackData);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(false);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());

  const clearSession = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    setApiOnline(false);
    setData(fallbackData);
  };

  const refresh = async (activeToken = token) => {
    if (!activeToken) {
      setLoading(false);
      return;
    }
    const version = ++requestVersion.current;
    setLoading(true);
    try {
      const bootstrap = await request<Partial<BootstrapData>>("/api/bootstrap", undefined, activeToken);
      if (version === requestVersion.current) setData({ ...fallbackData, ...bootstrap });
      setApiOnline(true);
    } catch (error) {
      setData((prev) => prev);
      setApiOnline(false);
      if (error instanceof Error && error.message.startsWith("401")) clearSession();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setAuthLoading(false);
      return;
    }
    request<AuthUser>("/api/auth/me", undefined, token)
      .then((activeUser) => {
        setUser(activeUser);
        localStorage.setItem(USER_KEY, JSON.stringify(activeUser));
        if (!activeUser.mustChangePassword) return refresh(token);
      })
      .catch(() => clearSession())
      .finally(() => setAuthLoading(false));
  }, [token]);

  useEffect(() => {
    if (!token || user?.mustChangePassword !== false) return;
    let stopped = false;
    const synchronize = async () => {
      if (document.visibilityState !== "visible") return;
      const version = ++requestVersion.current;
      try {
        const fresh = await request<BootstrapData>("/api/bootstrap", undefined, token);
        if (!stopped && version === requestVersion.current) { setData({ ...fallbackData, ...fresh }); setApiOnline(true); }
      } catch { if (!stopped) setApiOnline(false); }
    };
    const interval = window.setInterval(() => void synchronize(), 30000);
    window.addEventListener("focus", synchronize);
    return () => { stopped = true; window.clearInterval(interval); window.removeEventListener("focus", synchronize); };
  }, [token, user?.mustChangePassword]);

  const store = useMemo<AcademyStore>(() => {
    const login: AcademyStore["login"] = async (email, password) => {
      const result = await request<{ token: string; user: AuthUser }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }, null);
      localStorage.setItem(TOKEN_KEY, result.token);
      localStorage.setItem(USER_KEY, JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
      setApiOnline(true);
      if (!result.user.mustChangePassword) await refresh(result.token);
    };

    const changePassword: AcademyStore["changePassword"] = async (currentPassword, newPassword) => {
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

    const financeMutation = async (path: string, payload: unknown, method = "POST", idempotent = false) => {
      // Preserve the request ID through network failures, reloads, and retries.
      const serialized = JSON.stringify(payload);
      const key = `aba-finance-request:${user?.id}:${path}:${serialized}`;
      const requestId = sessionStorage.getItem(key) || crypto.randomUUID();
      if (idempotent) sessionStorage.setItem(key, requestId);
      ++requestVersion.current;
      try {
        await request(path, { method, body: JSON.stringify(idempotent ? { ...(payload as object), requestId } : payload) });
        const version = ++requestVersion.current;
        const fresh = await request<BootstrapData>("/api/bootstrap");
        if (version === requestVersion.current) setData({ ...fallbackData, ...fresh });
        setApiOnline(true);
        if (idempotent) sessionStorage.removeItem(key);
      } catch (error) {
        setApiOnline(false);
        throw error;
      }
    };
    const editStaff: AcademyStore["editStaff"] = (id, name) => financeMutation(`/api/users/${id}`, { name }, "PATCH");
    const resetStaffPassword: AcademyStore["resetStaffPassword"] = (id, temporaryPassword) => financeMutation(`/api/users/${id}/reset-password`, { temporaryPassword });
    const saveGroup: AcademyStore["saveGroup"] = (id, payload) => financeMutation(id ? `/api/groups/${id}` : "/api/groups", payload, id ? "PUT" : "POST");
    const transferStudent: AcademyStore["transferStudent"] = (id, groupId) => financeMutation(`/api/students/${id}/placement`, { groupId }, "PUT");
    const recordPayment: AcademyStore["recordPayment"] = payload => financeMutation("/api/finance/payments", payload, "POST", true);
    const createInvoice: AcademyStore["createInvoice"] = payload => financeMutation("/api/finance/invoices", payload, "POST", true);
    const saveBillingPlan: AcademyStore["saveBillingPlan"] = payload => financeMutation("/api/finance/billing-plan", payload, "PUT");
    const voidPayment: AcademyStore["voidPayment"] = (id, reason) => financeMutation(`/api/finance/payments/${id}/void`, { reason });

    const updateStudent: AcademyStore["updateStudent"] = async (id, patch) => {
      const updated = await request<Student>(`/api/students/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setData(prev => ({ ...prev, students: prev.students.map(student => student.id === id ? updated : student) }));
      setApiOnline(true);
      return updated;
    };

    const updateAttendanceRecord: AcademyStore["updateAttendanceRecord"] = async (studentId, date, present) => {
      const recalculateStudentAttendance = (prev: BootstrapData) => {
        const records = [
          ...prev.attendanceRecords.filter((record) => record.studentId !== studentId || record.date !== date),
          { studentId, date, present },
        ];
        const studentRecords = records.filter((record) => record.studentId === studentId);
        const presentCount = studentRecords.filter((record) => record.present).length;
        const attendancePct = studentRecords.length ? Math.round((presentCount / studentRecords.length) * 100) : 0;
        const attendance: Student["attendance"] = present ? "present" : "absent";
        return {
          ...prev,
          attendanceRecords: records,
          students: prev.students.map((student) =>
            student.id === studentId ? { ...student, attendancePct, attendance } : student
          ),
        };
      };
      try {
        await request("/api/attendance", { method: "PUT", body: JSON.stringify({ studentId, date, present }) });
        setApiOnline(true);
        setData(prev => recalculateStudentAttendance(prev));
      } catch (error) {
        setApiOnline(false);
        throw error;
      }
    };

    const updateTuitionRecord: AcademyStore["updateTuitionRecord"] = async () => {
      throw new Error("Use Tuition & Payments. Monthly totals are automatic.");
    };

    const updateAssessmentRecord: AcademyStore["updateAssessmentRecord"] = async (record) => {
      setData((prev) => ({
        ...prev,
        assessmentRecords: [
          ...prev.assessmentRecords.filter((item) => item.studentId !== record.studentId || item.quarter !== record.quarter),
          record,
        ],
      }));
      try {
        await request("/api/assessments", { method: "PUT", body: JSON.stringify(record) });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    };

    const createApplication: AcademyStore["createApplication"] = async payload => {
      const created = await request<Application>("/api/applications", { method: "POST", body: JSON.stringify(payload) });
      const fresh = await request<BootstrapData>("/api/bootstrap");
      ++requestVersion.current;
      setData({ ...fallbackData, ...fresh });
      setApiOnline(true);
      return created;
    };

    const updateApplicationStatus: AcademyStore["updateApplicationStatus"] = async (id, status) => {
      const updated = await request<Application>(`/api/applications/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      const fresh = await request<BootstrapData>("/api/bootstrap");
      ++requestVersion.current;
      setData({ ...fallbackData, ...fresh });
      setApiOnline(true);
      return updated;
    };

    const createUser: AcademyStore["createUser"] = async (payload) => {
      const created = await request<StaffUser & { temporaryPassword: string }>("/api/users", {
        method: "POST", body: JSON.stringify(payload),
      });
      const { temporaryPassword: _, ...staffUser } = created;
      setApiOnline(true);
      setData(prev => ({ ...prev, staffUsers: [staffUser, ...prev.staffUsers] }));
      return created;
    };

    const updateUserStatus: AcademyStore["updateUserStatus"] = async (id, status) => {
      const updated = await request<StaffUser>(`/api/users/${id}/status`, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      setApiOnline(true);
      setData(prev => ({ ...prev, staffUsers: prev.staffUsers.map(user => user.id === id ? updated : user) }));
      return updated;
    };

    const deleteUser: AcademyStore["deleteUser"] = async (id) => {
      const previousUsers = data.staffUsers;
      setData((prev) => ({ ...prev, staffUsers: prev.staffUsers.filter((user) => user.id !== id) }));
      try {
        await request<void>(`/api/users/${id}`, { method: "DELETE" });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
        setData((prev) => ({ ...prev, staffUsers: previousUsers }));
      }
    };

    const createMeeting: AcademyStore["createMeeting"] = async (payload) => {
      const optimistic: Meeting = { ...payload, id: `m-${Date.now()}` };
      setData((prev) => ({
        ...prev,
        meetings: [...prev.meetings.filter((meeting) => meeting.applicantId !== payload.applicantId), optimistic],
      }));
      try {
        const created = await request<Meeting>("/api/meetings", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setApiOnline(true);
        setData((prev) => ({
          ...prev,
          meetings: prev.meetings.map((meeting) => (meeting.id === optimistic.id ? created : meeting)),
        }));
        return created;
      } catch {
        setApiOnline(false);
        return optimistic;
      }
    };

    const deleteMeeting: AcademyStore["deleteMeeting"] = async (id) => {
      setData((prev) => ({ ...prev, meetings: prev.meetings.filter((meeting) => meeting.id !== id) }));
      try {
        await request<void>(`/api/meetings/${id}`, { method: "DELETE" });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    };

    const queueReminder: AcademyStore["queueReminder"] = async (payload) => {
      try {
        await request("/api/actions/reminder", { method: "POST", body: JSON.stringify(payload) });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    };

    const createTelegramLink: AcademyStore["createTelegramLink"] = async (studentId) => {
      const result = await request<{ url: string }>(`/api/telegram/students/${studentId}/link`, { method: "POST" });
      setApiOnline(true);
      return result.url;
    };

    const sendTelegramReminder: AcademyStore["sendTelegramReminder"] = async (studentId, invoiceId) => {
      await request("/api/telegram/reminders", {
        method: "POST",
        body: JSON.stringify({ studentId, invoiceId: invoiceId || null }),
      });
      setApiOnline(true);
    };

    const prepareExport: AcademyStore["prepareExport"] = async (payload) => {
      try {
        await request("/api/actions/export", { method: "POST", body: JSON.stringify(payload) });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    };

    const downloadFinanceExport: AcademyStore["downloadFinanceExport"] = async () => {
      try {
        await downloadFile("/api/finance/export", "aba-tuition-report.csv", token);
        setApiOnline(true);
      } catch {
        setApiOnline(false);
        throw new Error("Could not download finance export");
      }
    };

    const downloadReceipts: AcademyStore["downloadReceipts"] = async () => {
      try {
        await downloadFile("/api/finance/receipts", "aba-paid-receipts.csv", token);
        setApiOnline(true);
      } catch {
        setApiOnline(false);
        throw new Error("Could not download receipts");
      }
    };

    const reconcileFinance: AcademyStore["reconcileFinance"] = async () => {
      try {
        const result = await request<{ totalDue: number; overdue: number; unpaid: number; paid: number }>(
          "/api/finance/reconcile",
          { method: "POST" }
        );
        setApiOnline(true);
        return result;
      } catch {
        setApiOnline(false);
        throw new Error("Could not reconcile finance data");
      }
    };

    return {
      ...data,
      editStaff, resetStaffPassword, saveGroup, transferStudent,
      recordPayment, createInvoice, saveBillingPlan, voidPayment,
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
      updateAttendanceRecord,
      updateTuitionRecord,
      updateAssessmentRecord,
      createApplication,
      updateApplicationStatus,
      createUser,
      updateUserStatus,
      deleteUser,
      createMeeting,
      deleteMeeting,
      queueReminder,
      createTelegramLink,
      sendTelegramReminder,
      prepareExport,
      downloadFinanceExport,
      downloadReceipts,
      reconcileFinance,
    };
  }, [data, loading, authLoading, apiOnline, token, user]);

  return <AcademyContext.Provider value={store}>{children}</AcademyContext.Provider>;
}

export function useAcademy() {
  const context = useContext(AcademyContext);
  if (!context) throw new Error("useAcademy must be used inside AcademyProvider");
  return context;
}
