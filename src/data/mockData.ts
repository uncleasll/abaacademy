export type AttendanceStatus = "present" | "late" | "absent";
export type HwStatus = "done" | "partial" | "not_done";
export type PaymentStatus = "paid" | "unpaid" | "overdue";
export type AppStatus = "pending" | "assessment" | "interview" | "accepted" | "rejected";

export interface Student {
  id: string;
  name: string;
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
}

export const students: Student[] = [
  { id: "1", name: "Abdulloh Tokhirov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "29-30 betlarni 60 marttadan o'qish", attendancePct: 92, performance: 90, homeworkAvg: 88, overall: 90, status: "Excellent", rank: 8, tuitionStatus: "paid", amountDue: 0 },
  { id: "2", name: "Akhmad Eljanov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "Al-qodr surasini yodlash", attendancePct: 100, performance: 91, homeworkAvg: 82, overall: 92, status: "Excellent", rank: 5, tuitionStatus: "paid", amountDue: 0 },
  { id: "3", name: "Zaynobiddin Ziyaddinov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "Al-masad va an-nasr suralarini yodlash", attendancePct: 100, performance: 97, homeworkAvg: 96, overall: 98, status: "Excellent", rank: 3, tuitionStatus: "paid", amountDue: 0 },
  { id: "4", name: "Zohidulloh Tulashboyev", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "absent", nextHw: "iymon kalimalarini yodlash", attendancePct: 100, performance: 98, homeworkAvg: 100, overall: 100, status: "Excellent", rank: 2, tuitionStatus: "overdue", amountDue: 450000 },
  { id: "5", name: "Salohiddin Ziyaddinov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 4, hw: "partial", attendance: "present", nextHw: "Al-layl surasini yodlash", attendancePct: 100, performance: 90, homeworkAvg: 75, overall: 90, status: "Excellent", rank: 9, tuitionStatus: "paid", amountDue: 0 },
  { id: "6", name: "Muhammmadamin Ziyaddinov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 3, hw: "partial", attendance: "present", nextHw: "Momorizing surah Al-Baqara", attendancePct: 91, performance: 73, homeworkAvg: 68, overall: 79, status: "Good", rank: 13, tuitionStatus: "unpaid", amountDue: 450000 },
  { id: "7", name: "Khoji Akbar", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 3, hw: "not_done", attendance: "absent", nextHw: "az-zalzalah surasini yodlash", attendancePct: 82, performance: 78, homeworkAvg: 73, overall: 78, status: "Good", rank: 14, tuitionStatus: "overdue", amountDue: 450000 },
  { id: "8", name: "Azimjon Erkinov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 2, hw: "not_done", attendance: "late", nextHw: "iymon kalimalarini yodlash", attendancePct: 78, performance: 60, homeworkAvg: 44, overall: 62, status: "Needs Attention", rank: 15, tuitionStatus: "unpaid", amountDue: 450000 },
  { id: "9", name: "Zakariyoxo'ja Azimxo'jayev", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 1, hw: "not_done", attendance: "absent", nextHw: "Al-Falaq, Al-Ixlos suralarini yodlash", attendancePct: 58, performance: 53, homeworkAvg: 46, overall: 53, status: "Needs Attention", rank: 16, tuitionStatus: "overdue", amountDue: 900000 },
  { id: "10", name: "Umarbek Mahmadmurodov", klass: "Al-Bukhari", teacher: "Behzodjon", stars: 5, hw: "done", attendance: "present", nextHw: "60 marttadan tho, sod, tha harflarini o'qish", attendancePct: 92, performance: 93, homeworkAvg: 92, overall: 92, status: "Excellent", rank: 4, tuitionStatus: "paid", amountDue: 0 },
];

export interface Application {
  id: string;
  name: string;
  age: number;
  parentName: string;
  phone: string;
  program: string;
  submitted: string;
  status: AppStatus;
}

export const applications: Application[] = [
  { id: "a1", name: "Sardorbek Yusupov", age: 8, parentName: "Farrukh Yusupov", phone: "+998 90 123 45 67", program: "Full-Time Hifz", submitted: "2026-06-28", status: "pending" },
  { id: "a2", name: "Muhammadyusuf Karimov", age: 9, parentName: "Dilshod Karimov", phone: "+998 93 456 78 90", program: "Full-Time Hifz", submitted: "2026-06-25", status: "assessment" },
  { id: "a3", name: "Amirbek Nosirov", age: 7, parentName: "Jasur Nosirov", phone: "+998 97 234 56 78", program: "Online Academic", submitted: "2026-06-20", status: "interview" },
  { id: "a4", name: "Islombek Rahimov", age: 10, parentName: "Otabek Rahimov", phone: "+998 91 345 67 89", program: "Full-Time Hifz", submitted: "2026-06-15", status: "accepted" },
  { id: "a5", name: "Diyorbek Saidov", age: 8, parentName: "Aziz Saidov", phone: "+998 94 567 89 01", program: "Full-Time Hifz", submitted: "2026-06-10", status: "rejected" },
];

export interface StaffUser {
  id: string;
  name: string;
  role: "IT Admin" | "Finance" | "Teacher" | "Registration";
  email: string;
  status: "active" | "inactive";
  lastActive: string;
}

export const staffUsers: StaffUser[] = [
  { id: "u1", name: "Asilbek Ergashev", role: "IT Admin", email: "asilbek@albukhari.uz", status: "active", lastActive: "Today, 09:12" },
  { id: "u2", name: "Behzodjon Nazarov", role: "Teacher", email: "behzodjon@albukhari.uz", status: "active", lastActive: "Today, 08:40" },
  { id: "u3", name: "Malika Tosheva", role: "Finance", email: "malika@albukhari.uz", status: "active", lastActive: "Yesterday, 17:05" },
  { id: "u4", name: "Kamola Yusupova", role: "Registration", email: "kamola@albukhari.uz", status: "active", lastActive: "Today, 10:22" },
  { id: "u5", name: "Sardor Aliyev", role: "Teacher", email: "sardor@albukhari.uz", status: "inactive", lastActive: "3 days ago" },
];
