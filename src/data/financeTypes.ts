export interface Invoice {
  id: string; studentId: string; period: string; amount: number; paid: number;
  balance: number; dueDate: string; status: 'paid' | 'partial' | 'unpaid' | 'void'; overdue: boolean;
  voided?: boolean; voidReason?: string;
}
export interface Payment {
  id: string; invoiceId: string; studentId: string; period: string; amount: number;
  method: string; paidOn: string; reference: string; note: string; studentName: string;
  parentName: string; parentPhone: string; createdAt: string; voidedAt: string | null; voidReason: string | null;
}
export interface BillingPlan {
  studentId: string; amount: number; startMonth: string; endMonth: string; dueDay: number; active: boolean;
}
export interface PaymentInput {
  studentId: string; invoiceId: string; amount: string; method: string; paidOn: string; reference: string; note: string;
}
export interface InvoiceInput { studentId: string; period: string; amount: string; dueDate: string }
export interface LedgerEntryInput { studentId: string; period: string; amount: string; method: string; paidOn: string; reference: string; note: string }
export const studentCode = (student: { studentNumber?: number | null }) => student.studentNumber ? `ABA-${String(student.studentNumber).padStart(4, '0')}` : '';
export const PAYMENT_METHODS: { value: string; label: string }[] = [
  { value: 'zelle', label: 'Zelle' }, { value: 'zeffy', label: 'Zeffy' }, { value: 'cash', label: 'Cash' },
  { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'check', label: 'Check' }, { value: 'card_external', label: 'Other card payment' },
];
export const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const localToday = () => { const now = new Date(); return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`; };
