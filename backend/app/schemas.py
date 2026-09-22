from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, model_validator


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
    attendance: str | None = None
    stars: int | None = Field(default=None, ge=0, le=5)
    hw: str | None = None
    nextHw: str | None = None
    tuitionStatus: str | None = None
    amountDue: int | None = Field(default=None, ge=0)
    enrollmentStatus: str | None = None
    financeNote: str | None = None
    terminationNote: str | None = None


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
    date: str
    present: bool
    note: str = ""


class TuitionRecordPatch(BaseModel):
    studentId: str
    month: str
    status: str
    amount: int = Field(default=0, ge=0)


class AssessmentRecordPatch(BaseModel):
    studentId: str
    quarter: str
    islamicStudies: int = Field(ge=0, le=100)
    quranReading: int = Field(ge=0, le=100)
    tajweed: int = Field(ge=0, le=100)
    memorization: int = Field(ge=0, le=100)
    practical: int = Field(ge=0, le=100)
    note: str = ""


class PaymentCreate(BaseModel):
    requestId: UUID
    studentId: str
    invoiceId: str
    amount: Decimal = Field(gt=0, le=100000, decimal_places=2)
    method: Literal['cash', 'bank_transfer', 'check', 'card_external']
    paidOn: date
    reference: str = Field(default='', max_length=200)
    note: str = Field(default='', max_length=1000)

    @model_validator(mode='after')
    def validate_date(self):
        if self.paidOn > date.today():
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


class PlacementWrite(BaseModel):
    groupId: str
