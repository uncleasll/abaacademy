from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator

from .clock import academy_today

AttendanceValue = Literal['present', 'late', 'absent']
HomeworkValue = Literal['done', 'partial', 'not_done']
ISO_DATE = r'^20\d{2}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$'


class Student(BaseModel):
    id: str
    name: str
    age: int
    parentName: str
    parentPhone: str
    address: str
    klass: str
    teacher: str
    stars: int
    hw: str
    attendance: str
    nextHw: str
    attendancePct: int
    performance: int
    homeworkAvg: int
    overall: int
    status: str
    rank: int
    tuitionStatus: str
    amountDue: int
    joinedDate: str = ""
    enrollmentStatus: str = "active"
    financeNote: str = ""
    terminationNote: str = ""


class StudentPatch(BaseModel):
    attendance: AttendanceValue | None = None
    stars: int | None = Field(default=None, ge=0, le=5)
    hw: HomeworkValue | None = None
    nextHw: str | None = Field(default=None, max_length=500)
    tuitionStatus: str | None = None
    amountDue: int | None = Field(default=None, ge=0)
    enrollmentStatus: Literal['active', 'paused', 'terminated'] | None = None
    financeNote: str | None = Field(default=None, max_length=1000)
    terminationNote: str | None = Field(default=None, max_length=1000)


class Application(BaseModel):
    id: str
    name: str
    age: int
    parentName: str
    parentSurname: str
    email: EmailStr | str = ""
    phone: str
    address: str
    program: str
    teacher: str
    klass: str
    submitted: str
    status: str
    emergencyContact1Name: str = ""
    emergencyContact1Phone: str = ""
    emergencyContact1Relation: str = ""
    emergencyContact2Name: str = ""
    emergencyContact2Phone: str = ""
    emergencyContact2Relation: str = ""
    parentTelegram: str = ""


class ApplicationCreate(BaseModel):
    intakeMode: Literal["application", "review", "enroll"] = "application"
    name: str
    age: int = Field(ge=3, le=18)
    parentName: str
    parentSurname: str
    email: EmailStr | str = ""
    phone: str
    address: str
    program: str
    teacher: str
    klass: str
    emergencyContact1Name: str = ""
    emergencyContact1Phone: str = ""
    emergencyContact1Relation: str = ""
    emergencyContact2Name: str = ""
    emergencyContact2Phone: str = ""
    emergencyContact2Relation: str = ""
    parentTelegram: str = ""


class StatusPatch(BaseModel):
    status: str


class ClassGroup(BaseModel):
    id: str
    name: str
    teacher: str
    program: str
    schedule: str
    capacity: int
    enrolled: int


class StaffUser(BaseModel):
    id: str
    name: str
    role: str
    email: EmailStr
    status: str
    lastActive: str


class StaffUserCreate(BaseModel):
    name: str
    role: str
    email: EmailStr


class PasswordChangeRequest(BaseModel):
    currentPassword: str = Field(min_length=1, max_length=128)
    newPassword: str = Field(min_length=12, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthUser(BaseModel):
    id: str
    name: str
    email: EmailStr
    role: str
    status: str


class Meeting(BaseModel):
    id: str
    applicantId: str
    day: str
    time: str
    type: str


class MeetingCreate(BaseModel):
    applicantId: str
    day: str
    time: str
    type: str


class AttendanceRecordPatch(BaseModel):
    studentId: str
    date: str = Field(pattern=ISO_DATE)
    present: bool | None = None
    status: AttendanceValue | None = None
    note: str = ""

    @model_validator(mode='after')
    def resolve_status(self):
        if self.status is None and self.present is None:
            raise ValueError('Provide an attendance status')
        if self.status is None:
            self.status = 'present' if self.present else 'absent'
        self.present = self.status != 'absent'
        return self


class ClassSessionEntry(BaseModel):
    studentId: str
    attendance: AttendanceValue
    stars: int = Field(ge=0, le=5)
    hw: HomeworkValue
    nextHw: str = Field(default='', max_length=500)


class ClassSessionWrite(BaseModel):
    date: str = Field(pattern=ISO_DATE)
    entries: list[ClassSessionEntry] = Field(min_length=1, max_length=300)


class TuitionRecordPatch(BaseModel):
    studentId: str
    month: str
    status: str
    amount: int = Field(default=0, ge=0)


class AssessmentRecordPatch(BaseModel):
    studentId: str
    quarter: Literal['Q1', 'Q2', 'Q3', 'Final']
    islamicStudies: int = Field(ge=0, le=100)
    quranReading: int = Field(ge=0, le=100)
    tajweed: int = Field(ge=0, le=100)
    memorization: int = Field(ge=0, le=100)
    practical: int = Field(ge=0, le=100)
    note: str = Field(default="", max_length=1000)


class PaymentCreate(BaseModel):
    requestId: UUID
    studentId: str
    invoiceId: str
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2)
    method: Literal['cash', 'zelle', 'zeffy', 'bank_transfer', 'check', 'card_external']
    paidOn: date
    reference: str = Field(default='', max_length=200)
    note: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def validate_date(self):
        if self.paidOn > academy_today():
            raise ValueError('Payment date cannot be in the future')
        return self


class LedgerEntryCreate(BaseModel):
    """One row of the tuition ledger: a payment received for a given month. The invoice is created if needed."""
    requestId: UUID
    studentId: str
    period: str = Field(pattern=r'^20\d{2}-(0[1-9]|1[0-2])$')
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2)
    method: Literal['cash', 'zelle', 'zeffy', 'bank_transfer', 'check', 'card_external']
    paidOn: date
    reference: str = Field(default='', max_length=200)
    note: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def validate_date(self):
        if self.paidOn > academy_today():
            raise ValueError('Payment date cannot be in the future')
        return self


class InvoiceCreate(BaseModel):
    requestId: UUID
    studentId: str
    period: str = Field(pattern=r'^20\d{2}-(0[1-9]|1[0-2])$')
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2)
    dueDate: date


class BillingPlanUpdate(BaseModel):
    studentId: str
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2)
    startMonth: str = Field(pattern=r'^20\d{2}-(0[1-9]|1[0-2])$')
    endMonth: str = Field(pattern=r'^20\d{2}-(0[1-9]|1[0-2])$')
    dueDay: int = Field(ge=1, le=28)
    active: bool = True

    @model_validator(mode='after')
    def validate_months(self):
        span = (int(self.endMonth[:4]) - int(self.startMonth[:4])) * 12 + int(self.endMonth[5:]) - int(self.startMonth[5:])
        if span < 0 or span >= 24:
            raise ValueError('Choose an ordered billing period of at most two years')
        return self


class PaymentVoid(BaseModel):
    reason: str = Field(min_length=5, max_length=1000)

    @model_validator(mode='after')
    def meaningful_reason(self):
        self.reason = self.reason.strip()
        if len(self.reason) < 5:
            raise ValueError('Enter a reason of at least five characters')
        return self


class InvoiceVoid(PaymentVoid):
    pass


class InvoiceAdjust(BaseModel):
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2)
    dueDate: date | None = None
    reason: str = Field(min_length=5, max_length=1000)


class ScheduleBlock(BaseModel):
    id: str = Field(min_length=1, max_length=60)
    group: str = Field(min_length=1, max_length=100)
    teacher: str = Field(min_length=1, max_length=100)
    day: Literal['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    start: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    end: str = Field(pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    color: str = Field(default='', max_length=120)

    @model_validator(mode='after')
    def ordered(self):
        if self.end <= self.start:
            raise ValueError('End time must be after start time')
        return self


class ScheduleWrite(BaseModel):
    blocks: list[ScheduleBlock] = Field(max_length=200)


class StaffEdit(BaseModel):
    name: str = Field(min_length=2, max_length=100)


class StaffPasswordReset(BaseModel):
    temporaryPassword: str = Field(min_length=12, max_length=128)


class GroupWrite(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    teacher: str
    program: str = Field(min_length=2, max_length=100)
    schedule: str = Field(default='', max_length=200)
    capacity: int = Field(ge=1, le=200)
    # Telegram group/supergroup ids are negative numbers such as -1001234567890; None leaves the saved value alone.
    telegramChatId: str | None = Field(default=None, pattern=r'^(-?\d{5,20})?$')


class PlacementWrite(BaseModel):
    groupId: str
