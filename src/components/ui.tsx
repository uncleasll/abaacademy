import type { ReactNode } from "react";
import { Star } from "lucide-react";
import type { AttendanceStatus, HwStatus, PaymentStatus } from "../data/mockData";

export function StatCard({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${
        accent
          ? "bg-green-900 border-green-800 text-cream"
          : "bg-white border-line"
      }`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${
          accent ? "text-gold-300" : "text-ink/50"
        }`}
      >
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold sm:text-3xl ${accent ? "text-cream" : "text-ink"}`}>
        {value}
      </p>
      {sub && (
        <p className={`mt-1 text-xs ${accent ? "text-cream/70" : "text-ink/50"}`}>{sub}</p>
      )}
    </div>
  );
}

export function StarRating({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={14}
          className={i < value ? "fill-amber-400 text-amber-400" : "text-line"}
        />
      ))}
    </div>
  );
}

const attendanceStyles: Record<AttendanceStatus, string> = {
  present: "bg-emerald-500/10 text-emerald-700",
  late: "bg-amber-400/15 text-amber-600",
  absent: "bg-red-500/10 text-red-600",
};
const attendanceLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
};

export function AttendancePill({ status }: { status: AttendanceStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${attendanceStyles[status]}`}>
      {attendanceLabels[status]}
    </span>
  );
}

const hwStyles: Record<HwStatus, string> = {
  done: "bg-emerald-500/10 text-emerald-700",
  partial: "bg-amber-400/15 text-amber-600",
  not_done: "bg-red-500/10 text-red-600",
};
const hwLabels: Record<HwStatus, string> = {
  done: "Done",
  partial: "Partial",
  not_done: "Not Done",
};

export function HwPill({ status }: { status: HwStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${hwStyles[status]}`}>
      {hwLabels[status]}
    </span>
  );
}

const statusStyles: Record<string, string> = {
  Excellent: "bg-emerald-500/10 text-emerald-700",
  Good: "bg-amber-400/15 text-amber-600",
  "Needs Attention": "bg-red-500/10 text-red-600",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

const paymentStyles: Record<PaymentStatus, string> = {
  paid: "bg-emerald-500/10 text-emerald-700",
  unpaid: "bg-amber-400/15 text-amber-600",
  overdue: "bg-red-500/10 text-red-600",
};
const paymentLabels: Record<PaymentStatus, string> = {
  paid: "Paid",
  unpaid: "Pending",
  overdue: "Overdue",
};

export function PaymentPill({ status }: { status: PaymentStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStyles[status]}`}>
      {paymentLabels[status]}
    </span>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-line bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function SectionTitle({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) {
  return (
    <div className="mb-5 min-w-0">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-widest text-gold-600 font-semibold">{eyebrow}</p>
      )}
      <h2 className="font-display mt-1 text-2xl leading-tight text-ink sm:text-3xl">{title}</h2>
      {sub && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink/55">{sub}</p>}
    </div>
  );
}
