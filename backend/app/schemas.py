from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


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


class StudentPatch(BaseModel):
    attendance: str | None = None
    stars: int | None = Field(default=None, ge=0, le=5)
    hw: str | None = None
    nextHw: str | None = None
    tuitionStatus: str | None = None
    amountDue: int | None = Field(default=None, ge=0)


class Application(BaseModel):
    id: str
    name: str
    age: int
    parentName: str
    parentSurname: str
    phone: str
    address: str
    program: str
    teacher: str
    klass: str
    submitted: str
    status: str


class ApplicationCreate(BaseModel):
    name: str
    age: int = Field(ge=3, le=18)
    parentName: str
    parentSurname: str
    phone: str
    address: str
    program: str
    teacher: str
    klass: str


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


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


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
