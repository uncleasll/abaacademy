from __future__ import annotations

import os

from .database import connect
from .security import hash_password


STUDENTS = [
    ("1", "Abdulloh Tokhirov", 9, "Akmal Tokhirov", "(646) 555-0133", "Brooklyn, NY 11218", "Al-Bukhari", "Behzodjon", 5, "done", "present", "Read pages 29-30 sixty times", 92, 90, 88, 90, "Excellent", 8, "paid", 0),
    ("2", "Akhmad Eljanov", 8, "Nodir Eljanov", "(718) 555-0148", "Queens, NY 11373", "Al-Bukhari", "Behzodjon", 5, "done", "present", "Memorize Surah Al-Qadr", 100, 91, 82, 92, "Excellent", 5, "paid", 0),
    ("3", "Zaynobiddin Ziyaddinov", 10, "Sherzod Ziyaddinov", "(917) 555-0166", "Staten Island, NY 10314", "Al-Bukhari", "Behzodjon", 5, "done", "present", "Memorize Al-Masad and An-Nasr", 100, 97, 96, 98, "Excellent", 3, "paid", 0),
    ("4", "Zohidulloh Tulashboyev", 9, "Odil Tulashboyev", "(347) 555-0177", "Paterson, NJ 07501", "Al-Bukhari", "Behzodjon", 5, "done", "absent", "Memorize the pillars of iman", 100, 98, 100, 100, "Excellent", 2, "overdue", 450),
    ("5", "Salohiddin Ziyaddinov", 8, "Sherzod Ziyaddinov", "(917) 555-0166", "Staten Island, NY 10314", "Al-Bukhari", "Behzodjon", 4, "partial", "present", "Memorize Surah Al-Layl", 100, 90, 75, 90, "Excellent", 9, "paid", 0),
    ("6", "Muhammmadamin Ziyaddinov", 11, "Sherzod Ziyaddinov", "(917) 555-0166", "Staten Island, NY 10314", "Al-Furqan", "Sardor", 3, "partial", "present", "Memorize Surah Al-Baqarah", 91, 73, 68, 79, "Good", 13, "unpaid", 450),
    ("7", "Khoji Akbar", 10, "Kamol Akbarov", "(201) 555-0189", "Clifton, NJ 07011", "Al-Furqan", "Sardor", 3, "not_done", "absent", "Memorize Surah Az-Zalzalah", 82, 78, 73, 78, "Good", 14, "overdue", 450),
    ("8", "Azimjon Erkinov", 7, "Erkin Azimov", "(929) 555-0122", "Brooklyn, NY 11230", "An-Nur", "Behzodjon", 2, "not_done", "late", "Memorize the pillars of iman", 78, 60, 44, 62, "Needs Attention", 15, "unpaid", 450),
    ("9", "Zakariyoxo'ja Azimxo'jayev", 8, "Azimxo'ja Azimov", "(732) 555-0101", "Edison, NJ 08817", "An-Nur", "Malika", 1, "not_done", "absent", "Memorize Al-Falaq and Al-Ikhlas", 58, 53, 46, 53, "Needs Attention", 16, "overdue", 900),
    ("10", "Umarbek Mahmadmurodov", 9, "Mahmud Mahmadmurodov", "(516) 555-3141", "Long Island, NY 11550", "Al-Bukhari", "Behzodjon", 5, "done", "present", "Read tha, sad, and daad sixty times", 92, 93, 92, 92, "Excellent", 4, "paid", 0),
]

ATTENDANCE_DATES = ["2026-04-15", "2026-05-01", "2026-05-15", "2026-06-01", "2026-06-15", "2026-07-01", "2026-07-15", "2026-08-01"]
TUITION_MONTHS = ["September", "October", "November", "December", "January", "February", "March", "April", "May", "June"]

APPLICATIONS = [
    ("a1", "Sardorbek Yusupov", 8, "Farrukh", "Yusupov", "(646) 555-4567", "Brooklyn, NY 11219", "Full-Time Hifz", "Behzodjon", "Al-Bukhari", "2026-06-28", "pending"),
    ("a2", "Muhammadyusuf Karimov", 9, "Dilshod", "Karimov", "(718) 555-7890", "Queens, NY 11375", "Full-Time Hifz", "Sardor", "Al-Furqan", "2026-06-25", "assessment"),
    ("a3", "Amirbek Nosirov", 7, "Jasur", "Nosirov", "(917) 555-5678", "Jersey City, NJ 07306", "Online Academic", "Malika", "An-Nur", "2026-06-20", "interview"),
    ("a4", "Islombek Rahimov", 10, "Otabek", "Rahimov", "(347) 555-6789", "Brooklyn, NY 11223", "Full-Time Hifz", "Behzodjon", "Al-Bukhari", "2026-06-15", "accepted"),
    ("a5", "Diyorbek Saidov", 8, "Aziz", "Saidov", "(929) 555-8901", "Edison, NJ 08820", "Full-Time Hifz", "Sardor", "Al-Furqan", "2026-06-10", "rejected"),
]

GROUPS = [
    ("g1", "Al-Bukhari", "Behzodjon", "Full-Time Hifz", "Mon-Fri · 9:00 AM", 16, 11),
    ("g2", "Al-Furqan", "Sardor", "Full-Time Hifz", "Mon-Fri · 2:00 PM", 14, 9),
    ("g3", "An-Nur", "Malika", "Online Academic", "Tue/Thu/Sat · 6:00 PM ET", 12, 7),
]

USERS = [
    ("u1", "Shavkat Shoniyozov", "IT Admin", "shavkat@abaacademy.us", "active", "Today, 9:12 AM ET"),
    ("u2", "Behzodjon Nazarov", "Teacher", "behzodjon@abaacademy.us", "active", "Today, 8:40 AM ET"),
    ("u3", "Malika Tosheva", "Finance", "malika@abaacademy.us", "active", "Yesterday, 5:05 PM ET"),
    ("u4", "Kamola Yusupova", "Registration", "kamola@abaacademy.us", "active", "Today, 10:22 AM ET"),
    ("u5", "Sardor Aliyev", "Teacher", "sardor@abaacademy.us", "inactive", "3 days ago"),
]

AUTH_PASSWORDS = {
    "shavkat@abaacademy.us": "Admin123!",
    "behzodjon@abaacademy.us": "Teacher123!",
    "malika@abaacademy.us": "Finance123!",
    "kamola@abaacademy.us": "Register123!",
    "sardor@abaacademy.us": "Teacher123!",
}


def seed_if_empty() -> None:
    with connect() as conn:
        conn.execute(
            """
            UPDATE staff_users
            SET name = ?, email = ?
            WHERE id = ? OR email = ?
            """,
            ("Shavkat Shoniyozov", "shavkat@abaacademy.us", "u1", "asilbek@abaacademy.us"),
        )
        conn.execute(
            """
            UPDATE auth_accounts
            SET email = ?
            WHERE staff_user_id = ? OR email = ?
            """,
            ("shavkat@abaacademy.us", "u1", "asilbek@abaacademy.us"),
        )
        count = conn.execute("SELECT COUNT(*) AS count FROM students").fetchone()["count"]
        auth_count = conn.execute("SELECT COUNT(*) AS count FROM auth_accounts").fetchone()["count"]
        attendance_count = conn.execute("SELECT COUNT(*) AS count FROM attendance_records").fetchone()["count"]
        seed_demo_data = os.getenv("SEED_DEMO_DATA", "false" if os.getenv("APP_ENV") == "production" else "true").lower() in {"1", "true", "yes"}
        if not seed_demo_data:
            if auth_count:
                return
            admin_email = os.getenv("ADMIN_EMAIL", "").strip().lower()
            admin_password = os.getenv("ADMIN_PASSWORD", "")
            admin_name = os.getenv("ADMIN_NAME", "ABA Academy Admin").strip()
            if not admin_email or len(admin_password) < 12:
                raise RuntimeError(
                    "Production bootstrap requires ADMIN_EMAIL and ADMIN_PASSWORD (minimum 12 characters)"
                )
            password_hash, password_salt = hash_password(admin_password)
            conn.execute(
                "INSERT INTO staff_users VALUES (?, ?, ?, ?, ?, ?)",
                ("u-initial-admin", admin_name, "IT Admin", admin_email, "active", "Never"),
            )
            conn.execute(
                "INSERT INTO auth_accounts (id, staff_user_id, email, password_hash, password_salt, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (
                    "auth-initial-admin",
                    "u-initial-admin",
                    admin_email,
                    password_hash,
                    password_salt,
                    "IT Admin",
                    "active",
                ),
            )
            return
        if count and not attendance_count:
            student_rows = conn.execute("SELECT id, attendance, attendance_pct, tuition_status FROM students").fetchall()
            for student in student_rows:
                for index, day in enumerate(ATTENDANCE_DATES):
                    present = student["attendance"] != "absent" and index < max(2, round(student["attendance_pct"] / 13))
                    conn.execute(
                        "INSERT OR IGNORE INTO attendance_records (student_id, date, present) VALUES (?, ?, ?)",
                        (student["id"], day, 1 if present else 0),
                    )
                for index, month in enumerate(TUITION_MONTHS):
                    if student["tuition_status"] == "paid":
                        status, amount, note = ("paid", 450, "")
                    elif student["tuition_status"] == "overdue":
                        status, amount, note = ("unpaid", 0, "")
                    elif index == 2:
                        status, amount, note = ("sponsor", 0, "need sponsor")
                    elif index < 7:
                        status, amount, note = ("partial", 100, "")
                    else:
                        status, amount, note = ("unpaid", 0, "")
                    conn.execute(
                        "INSERT OR IGNORE INTO tuition_records VALUES (?, ?, ?, ?, ?)",
                        (student["id"], month, status, amount, note),
                    )
        if auth_count:
            return
        if count:
            staff_rows = conn.execute("SELECT * FROM staff_users").fetchall()
            for row in staff_rows:
                password_hash, password_salt = hash_password(AUTH_PASSWORDS.get(row["email"], "TempPass123!"))
                conn.execute(
                    "INSERT OR IGNORE INTO auth_accounts (id, staff_user_id, email, password_hash, password_salt, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (f"auth-{row['id']}", row["id"], row["email"], password_hash, password_salt, row["role"], row["status"]),
                )
            return
        conn.executemany(
            """
            INSERT INTO students
            (id, name, age, parent_name, parent_phone, address, klass, teacher, stars, hw, attendance,
             next_hw, attendance_pct, performance, homework_avg, overall, status, rank, tuition_status, amount_due)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            STUDENTS,
        )
        conn.executemany(
            """
            INSERT INTO applications
            (id, name, age, parent_name, parent_surname, phone, address, program, teacher, klass, submitted, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            APPLICATIONS,
        )
        conn.executemany(
            "INSERT INTO class_groups VALUES (?, ?, ?, ?, ?, ?, ?)",
            GROUPS,
        )
        conn.executemany(
            "INSERT INTO staff_users VALUES (?, ?, ?, ?, ?, ?)",
            USERS,
        )
        for user_id, _, role, email, status, _ in USERS:
            password_hash, password_salt = hash_password(AUTH_PASSWORDS[email])
            conn.execute(
                "INSERT INTO auth_accounts (id, staff_user_id, email, password_hash, password_salt, role, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
                (f"auth-{user_id}", user_id, email, password_hash, password_salt, role, status),
            )
        conn.executemany(
            "INSERT INTO meetings VALUES (?, ?, ?, ?, ?)",
            [
                ("m-a2", "a2", "Monday", "9:00 AM", "Assessment"),
                ("m-a3", "a3", "Monday", "10:30 AM", "Interview"),
            ],
        )
        for student in STUDENTS:
            student_id = student[0]
            attendance = student[10]
            attendance_pct = student[12]
            tuition_status = student[18]
            for index, day in enumerate(ATTENDANCE_DATES):
                present = attendance != "absent" and index < max(2, round(attendance_pct / 13))
                conn.execute(
                    "INSERT INTO attendance_records (student_id, date, present) VALUES (?, ?, ?)",
                    (student_id, day, 1 if present else 0),
                )
            for index, month in enumerate(TUITION_MONTHS):
                if tuition_status == "paid":
                    status, amount, note = ("paid", 450, "")
                elif tuition_status == "overdue":
                    status, amount, note = ("unpaid", 0, "")
                elif index == 2:
                    status, amount, note = ("sponsor", 0, "need sponsor")
                elif index < 7:
                    status, amount, note = ("partial", 100, "")
                else:
                    status, amount, note = ("unpaid", 0, "")
                conn.execute("INSERT INTO tuition_records VALUES (?, ?, ?, ?, ?)", (student_id, month, status, amount, note))
