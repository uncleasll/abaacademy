export type AttendanceStatus = "present" | "late" | "absent";
export type HwStatus = "done" | "partial" | "not_done";
export type PaymentStatus = "paid" | "unpaid" | "overdue";
export type MonthlyPaymentStatus = "paid" | "partial" | "unpaid" | "sponsor" | "voucher" | "absent";
export type AppStatus = "pending" | "assessment" | "interview" | "teacher_review" | "waitlist" | "accepted" | "rejected";
export type EnrollmentStatus = "active" | "paused" | "terminated";
export type QuarterKey = "Q1" | "Q2" | "Q3" | "Final";

export interface Student {
  id: string;
  name: string;
  age: number;
  parentName: string;
  parentPhone: string;
  address: string;
  klass: string;
  teacher: string;
  stars: number;
  hw: HwStatus;
  attendance: AttendanceStatus;
  nextHw: string;
  attendancePct: number;
  performance: number;
  homeworkAvg: number;
  overall: number;
  status: "Excellent" | "Good" | "Needs Attention";
  rank: number;
  tuitionStatus: PaymentStatus;
  amountDue: number;
  billingConfigured?: boolean;
  telegramConnected?: boolean;
  telegramUsername?: string;
  joinedDate?: string;
  enrollmentStatus?: EnrollmentStatus;
  financeNote?: string;
  terminationNote?: string;
}

export interface AttendanceRecord {
  studentId: string;
  date: string;
  present: boolean;
  note?: string;
}

export interface TuitionRecord {
  legacy?: boolean;
  balance?: number;
  dueDate?: string;
  studentId: string;
  month: string;
  status: MonthlyPaymentStatus;
  amount: number;
  note?: string;
}

export const students: Student[] = [
  { id: "1", name: "Abdulloh Tokhirov", age: 9, parentName: "Akmal Tokhirov", parentPhone: "(646) 555-0133", address: "Brooklyn, NY 11218", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "Read pages 29-30 sixty times", attendancePct: 92, performance: 90, homeworkAvg: 88, overall: 90, status: "Excellent", rank: 8, tuitionStatus: "paid", amountDue: 0 },
  { id: "2", name: "Akhmad Eljanov", age: 8, parentName: "Nodir Eljanov", parentPhone: "(718) 555-0148", address: "Queens, NY 11373", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "Memorize Surah Al-Qadr", attendancePct: 100, performance: 91, homeworkAvg: 82, overall: 92, status: "Excellent", rank: 5, tuitionStatus: "paid", amountDue: 0 },
  { id: "3", name: "Zaynobiddin Ziyaddinov", age: 10, parentName: "Sherzod Ziyaddinov", parentPhone: "(917) 555-0166", address: "Staten Island, NY 10314", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "Memorize Al-Masad and An-Nasr", attendancePct: 100, performance: 97, homeworkAvg: 96, overall: 98, status: "Excellent", rank: 3, tuitionStatus: "paid", amountDue: 0 },
  { id: "4", name: "Zohidulloh Tulashboyev", age: 9, parentName: "Odil Tulashboyev", parentPhone: "(347) 555-0177", address: "Paterson, NJ 07501", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "absent", nextHw: "Memorize the pillars of iman", attendancePct: 100, performance: 98, homeworkAvg: 100, overall: 100, status: "Excellent", rank: 2, tuitionStatus: "overdue", amountDue: 450 },
  { id: "5", name: "Salohiddin Ziyaddinov", age: 8, parentName: "Sherzod Ziyaddinov", parentPhone: "(917) 555-0166", address: "Staten Island, NY 10314", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 4, hw: "partial", attendance: "present", nextHw: "Memorize Surah Al-Layl", attendancePct: 100, performance: 90, homeworkAvg: 75, overall: 90, status: "Excellent", rank: 9, tuitionStatus: "paid", amountDue: 0 },
  { id: "6", name: "Muhammmadamin Ziyaddinov", age: 11, parentName: "Sherzod Ziyaddinov", parentPhone: "(917) 555-0166", address: "Staten Island, NY 10314", klass: "Al-Furqan", teacher: "Sardor", stars: 3, hw: "partial", attendance: "present", nextHw: "Memorize Surah Al-Baqarah", attendancePct: 91, performance: 73, homeworkAvg: 68, overall: 79, status: "Good", rank: 13, tuitionStatus: "unpaid", amountDue: 450 },
  { id: "7", name: "Khoji Akbar", age: 10, parentName: "Kamol Akbarov", parentPhone: "(201) 555-0189", address: "Clifton, NJ 07011", klass: "Al-Furqan", teacher: "Sardor", stars: 3, hw: "not_done", attendance: "absent", nextHw: "Memorize Surah Az-Zalzalah", attendancePct: 82, performance: 78, homeworkAvg: 73, overall: 78, status: "Good", rank: 14, tuitionStatus: "overdue", amountDue: 450 },
  { id: "8", name: "Azimjon Erkinov", age: 7, parentName: "Erkin Azimov", parentPhone: "(929) 555-0122", address: "Brooklyn, NY 11230", klass: "An-Nur", teacher: "Behzodjon", stars: 2, hw: "not_done", attendance: "late", nextHw: "Memorize the pillars of iman", attendancePct: 78, performance: 60, homeworkAvg: 44, overall: 62, status: "Needs Attention", rank: 15, tuitionStatus: "unpaid", amountDue: 450 },
  { id: "9", name: "Zakariyoxo'ja Azimxo'jayev", age: 8, parentName: "Azimxo'ja Azimov", parentPhone: "(732) 555-0101", address: "Edison, NJ 08817", klass: "An-Nur", teacher: "Malika", stars: 1, hw: "not_done", attendance: "absent", nextHw: "Memorize Al-Falaq and Al-Ikhlas", attendancePct: 58, performance: 53, homeworkAvg: 46, overall: 53, status: "Needs Attention", rank: 16, tuitionStatus: "overdue", amountDue: 900, enrollmentStatus: "terminated", financeNote: "Teacher marked terminated. Finance review needed before more invoices.", terminationNote: "Family stopped attending after repeated unexcused absences." },
  { id: "10", name: "Umarbek Mahmadmurodov", age: 9, parentName: "Mahmud Mahmadmurodov", parentPhone: "(516) 555-3141", address: "Long Island, NY 11550", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "Read tha, sad, and daad sixty times", attendancePct: 92, performance: 93, homeworkAvg: 92, overall: 92, status: "Excellent", rank: 4, tuitionStatus: "paid", amountDue: 0 },
];

export const attendanceDates = ["2026-04-15", "2026-05-01", "2026-05-15", "2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-08-01"];

export const attendanceRecords: AttendanceRecord[] = students.flatMap((student) =>
  attendanceDates.map((date, index) => ({
    studentId: student.id,
    date,
    present: student.attendance !== "absent" && index < Math.max(2, Math.round(student.attendancePct / 13)),
  }))
);

export const tuitionMonths = ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June"];

export const tuitionRecords: TuitionRecord[] = students.flatMap((student) =>
  tuitionMonths.map((month, index) => {
    if (student.enrollmentStatus === "terminated") return { studentId: student.id, month, status: "absent", amount: 0, note: student.terminationNote };
    if (student.tuitionStatus === "paid") return { studentId: student.id, month, status: "paid", amount: 450 };
    if (student.tuitionStatus === "overdue") return { studentId: student.id, month, status: "unpaid", amount: 0, note: student.financeNote };
    if (index === 2) return { studentId: student.id, month, status: "sponsor", amount: 0, note: "need sponsor" };
    if (index < 7) return { studentId: student.id, month, status: "partial", amount: 100 };
    return { studentId: student.id, month, status: "unpaid", amount: 0 };
  })
);

export interface Application {
  id: string;
  name: string;
  age: number;
  parentName: string;
  parentSurname: string;
  email?: string;
  phone: string;
  address: string;
  program: string;
  teacher: string;
  klass: string;
  submitted: string;
  status: AppStatus;
  emergencyContact1Name?: string;
  emergencyContact1Phone?: string;
  emergencyContact1Relation?: string;
  emergencyContact2Name?: string;
  emergencyContact2Phone?: string;
  emergencyContact2Relation?: string;
  parentTelegram?: string;
}

export interface AssessmentRecord {
  studentId: string;
  quarter: QuarterKey;
  islamicStudies: number;
  quranReading: number;
  tajweed: number;
  memorization: number;
  practical: number;
  note: string;
}

export const applications: Application[] = [
  { id: "a1", name: "Sardorbek Yusupov", age: 8, parentName: "Farrukh", parentSurname: "Yusupov", email: "farrukh@example.com", phone: "(646) 555-4567", address: "Brooklyn, NY 11219", program: "Full-Time Hifz", teacher: "Behzodjon", klass: "Al-Bukhari", submitted: "2026-06-28", status: "pending" },
  { id: "a2", name: "Muhammadyusuf Karimov", age: 9, parentName: "Dilshod", parentSurname: "Karimov", email: "dilshod@example.com", phone: "(718) 555-7890", address: "Queens, NY 11375", program: "Full-Time Hifz", teacher: "Sardor", klass: "Al-Furqan", submitted: "2026-06-25", status: "assessment" },
  { id: "a3", name: "Amirbek Nosirov", age: 7, parentName: "Jasur", parentSurname: "Nosirov", email: "jasur@example.com", phone: "(917) 555-5678", address: "Jersey City, NJ 07306", program: "Online Academic", teacher: "Malika", klass: "An-Nur", submitted: "2026-06-20", status: "interview" },
  { id: "a4", name: "Islombek Rahimov", age: 10, parentName: "Otabek", parentSurname: "Rahimov", email: "otabek@example.com", phone: "(347) 555-6789", address: "Brooklyn, NY 11223", program: "Full-Time Hifz", teacher: "Behzodjon", klass: "Al-Bukhari", submitted: "2026-06-15", status: "accepted" },
  { id: "a5", name: "Diyorbek Saidov", age: 8, parentName: "Aziz", parentSurname: "Saidov", email: "aziz@example.com", phone: "(929) 555-8901", address: "Edison, NJ 08820", program: "Full-Time Hifz", teacher: "Sardor", klass: "Al-Furqan", submitted: "2026-06-10", status: "rejected" },
];

export const assessmentCalendar = [
  { key: "Q1" as QuarterKey, label: "Quarter 1 Assessment", window: "Late November", months: "September-November" },
  { key: "Q2" as QuarterKey, label: "Quarter 2 Assessment", window: "Late January", months: "December-January" },
  { key: "Q3" as QuarterKey, label: "Quarter 3 Assessment", window: "Late March", months: "February-March" },
  { key: "Final" as QuarterKey, label: "Quarter 4 / Final Exam", window: "June", months: "April-June" },
];

export const assessmentRecords: AssessmentRecord[] = students.map((student) => ({
  studentId: student.id,
  quarter: "Q1",
  islamicStudies: Math.max(50, student.performance - 4),
  quranReading: student.performance,
  tajweed: Math.max(50, student.performance - 6),
  memorization: Math.max(50, student.performance - 2),
  practical: student.overall,
  note: student.status === "Needs Attention" ? "Needs parent follow-up before next quarter." : "On track for current level.",
}));

export interface ClassGroup {
  id: string;
  name: string;
  teacher: string;
  program: string;
  schedule: string;
  capacity: number;
  enrolled: number;
}

export const classGroups: ClassGroup[] = [
  { id: "g1", name: "Al-Bukhari", teacher: "Behzodjon", program: "Full-Time Hifz", schedule: "Mon-Fri · 9:00 AM", capacity: 16, enrolled: 11 },
  { id: "g2", name: "Al-Furqan", teacher: "Sardor", program: "Full-Time Hifz", schedule: "Mon-Fri · 2:00 PM", capacity: 14, enrolled: 9 },
  { id: "g3", name: "An-Nur", teacher: "Malika", program: "Online Academic", schedule: "Tue/Thu/Sat · 6:00 PM ET", capacity: 12, enrolled: 7 },
];

export interface StaffUser {
  teacherAlias?: string;
  id: string;
  name: string;
  role: "IT Admin" | "Finance" | "Teacher" | "Registration";
  email: string;
  status: "active" | "inactive";
  lastActive: string;
}

export const staffUsers: StaffUser[] = [
  { id: "u1", name: "Shavkat Shoniyozov", role: "IT Admin", email: "shavkat@abaacademy.us", status: "active", lastActive: "Today, 9:12 AM ET" },
  { id: "u2", name: "Behzodjon Nazarov", role: "Teacher", email: "behzodjon@abaacademy.us", status: "active", lastActive: "Today, 8:40 AM ET" },
  { id: "u3", name: "Malika Tosheva", role: "Finance", email: "malika@abaacademy.us", status: "active", lastActive: "Yesterday, 5:05 PM ET" },
  { id: "u4", name: "Kamola Yusupova", role: "Registration", email: "kamola@abaacademy.us", status: "active", lastActive: "Today, 10:22 AM ET" },
  { id: "u5", name: "Sardor Aliyev", role: "Teacher", email: "sardor@abaacademy.us", status: "inactive", lastActive: "3 days ago" },
];
