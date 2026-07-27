import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applications as fallbackApplications,
  attendanceDates as fallbackAttendanceDates,
  attendanceRecords as fallbackAttendanceRecords,
  classGroups as fallbackClassGroups,
  staffUsers as fallbackStaffUsers,
  students as fallbackStudents,
  tuitionMonths as fallbackTuitionMonths,
  tuitionRecords as fallbackTuitionRecords,
  type Application,
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
  students: Student[];
  applications: Application[];
  classGroups: ClassGroup[];
  staffUsers: StaffUser[];
  meetings: Meeting[];
  attendanceDates: string[];
  attendanceRecords: AttendanceRecord[];
  tuitionMonths: string[];
  tuitionRecords: TuitionRecord[];
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: StaffUser["role"];
  status: StaffUser["status"];
}

interface AcademyStore extends BootstrapData {
  loading: boolean;
  authLoading: boolean;
  apiOnline: boolean;
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  updateStudent: (id: string, patch: Partial<Student>) => Promise<Student | undefined>;
  updateAttendanceRecord: (studentId: string, date: string, present: boolean) => Promise<void>;
  updateTuitionRecord: (studentId: string, month: string, status: TuitionRecord["status"], amount: number) => Promise<void>;
  createApplication: (payload: Omit<Application, "id" | "submitted" | "status">) => Promise<Application>;
  updateApplicationStatus: (id: string, status: Application["status"]) => Promise<Application | undefined>;
  createUser: (payload: Pick<StaffUser, "name" | "email" | "role">) => Promise<StaffUser>;
  updateUserStatus: (id: string, status: StaffUser["status"]) => Promise<StaffUser | undefined>;
  createMeeting: (payload: Omit<Meeting, "id">) => Promise<Meeting>;
  deleteMeeting: (id: string) => Promise<void>;
  queueReminder: (payload: Record<string, unknown>) => Promise<void>;
  prepareExport: (payload: Record<string, unknown>) => Promise<void>;
  downloadFinanceExport: () => Promise<void>;
  downloadReceipts: () => Promise<void>;
  reconcileFinance: () => Promise<{ totalDue: number; overdue: number; unpaid: number; paid: number }>;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000";
const TOKEN_KEY = "aba_academy_token";
const USER_KEY = "aba_academy_user";

const fallbackData: BootstrapData = {
  students: fallbackStudents,
  applications: fallbackApplications,
  classGroups: fallbackClassGroups,
  staffUsers: fallbackStaffUsers,
  attendanceDates: fallbackAttendanceDates,
  attendanceRecords: fallbackAttendanceRecords,
  tuitionMonths: fallbackTuitionMonths,
  tuitionRecords: fallbackTuitionRecords,
  meetings: [
    { id: "m-a2", applicantId: "a2", day: "Monday", time: "9:00 AM", type: "Assessment" },
    { id: "m-a3", applicantId: "a3", day: "Monday", time: "10:30 AM", type: "Interview" },
  ],
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
    throw new Error(`${response.status} ${response.statusText}`);
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
    setLoading(true);
    try {
      const bootstrap = await request<BootstrapData>("/api/bootstrap", undefined, activeToken);
      setData(bootstrap);
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
        return refresh(token);
      })
      .catch(() => clearSession())
      .finally(() => setAuthLoading(false));
  }, [token]);

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
      await refresh(result.token);
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

    const updateStudent: AcademyStore["updateStudent"] = async (id, patch) => {
      setData((prev) => ({
        ...prev,
        students: prev.students.map((student) => (student.id === id ? { ...student, ...patch } : student)),
      }));
      try {
        const updated = await request<Student>(`/api/students/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setApiOnline(true);
        setData((prev) => ({
          ...prev,
          students: prev.students.map((student) => (student.id === id ? updated : student)),
        }));
        return updated;
      } catch {
        setApiOnline(false);
      }
    };

    const updateAttendanceRecord: AcademyStore["updateAttendanceRecord"] = async (studentId, date, present) => {
      setData((prev) => ({
        ...prev,
        attendanceRecords: [
          ...prev.attendanceRecords.filter((record) => record.studentId !== studentId || record.date !== date),
          { studentId, date, present },
        ],
      }));
      try {
        await request("/api/attendance", { method: "PUT", body: JSON.stringify({ studentId, date, present }) });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    };

    const updateTuitionRecord: AcademyStore["updateTuitionRecord"] = async (studentId, month, status, amount) => {
      setData((prev) => ({
        ...prev,
        tuitionRecords: [
          ...prev.tuitionRecords.filter((record) => record.studentId !== studentId || record.month !== month),
          { studentId, month, status, amount },
        ],
      }));
      try {
        await request("/api/tuition-records", { method: "PUT", body: JSON.stringify({ studentId, month, status, amount }) });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
    };

    const createApplication: AcademyStore["createApplication"] = async (payload) => {
      const optimistic: Application = {
        ...payload,
        id: `a-${Date.now()}`,
        submitted: new Date().toISOString().slice(0, 10),
        status: "pending",
      };
      setData((prev) => ({ ...prev, applications: [optimistic, ...prev.applications] }));
      try {
        const created = await request<Application>("/api/applications", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setApiOnline(true);
        setData((prev) => ({
          ...prev,
          applications: prev.applications.map((app) => (app.id === optimistic.id ? created : app)),
        }));
        return created;
      } catch {
        setApiOnline(false);
        return optimistic;
      }
    };

    const updateApplicationStatus: AcademyStore["updateApplicationStatus"] = async (id, status) => {
      setData((prev) => ({
        ...prev,
        applications: prev.applications.map((app) => (app.id === id ? { ...app, status } : app)),
      }));
      try {
        const updated = await request<Application>(`/api/applications/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        setApiOnline(true);
        setData((prev) => ({
          ...prev,
          applications: prev.applications.map((app) => (app.id === id ? updated : app)),
        }));
        return updated;
      } catch {
        setApiOnline(false);
      }
    };

    const createUser: AcademyStore["createUser"] = async (payload) => {
      const optimistic: StaffUser = { ...payload, id: `u-${Date.now()}`, status: "active", lastActive: "Just now" };
      setData((prev) => ({ ...prev, staffUsers: [optimistic, ...prev.staffUsers] }));
      try {
        const created = await request<StaffUser>("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setApiOnline(true);
        setData((prev) => ({
          ...prev,
          staffUsers: prev.staffUsers.map((user) => (user.id === optimistic.id ? created : user)),
        }));
        return created;
      } catch {
        setApiOnline(false);
        return optimistic;
      }
    };

    const updateUserStatus: AcademyStore["updateUserStatus"] = async (id, status) => {
      setData((prev) => ({
        ...prev,
        staffUsers: prev.staffUsers.map((user) =>
          user.id === id ? { ...user, status, lastActive: "Updated just now" } : user
        ),
      }));
      try {
        const updated = await request<StaffUser>(`/api/users/${id}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status }),
        });
        setApiOnline(true);
        setData((prev) => ({
          ...prev,
          staffUsers: prev.staffUsers.map((user) => (user.id === id ? updated : user)),
        }));
        return updated;
      } catch {
        setApiOnline(false);
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
      loading,
      authLoading,
      apiOnline,
      token,
      user,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
      refresh,
      updateStudent,
      updateAttendanceRecord,
      updateTuitionRecord,
      createApplication,
      updateApplicationStatus,
      createUser,
      updateUserStatus,
      createMeeting,
      deleteMeeting,
      queueReminder,
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
