# ABA Academy Portal — Complete User Guide

This guide explains how to use the ABA Academy staff portal from the first login to daily work.
It is written for everyone who uses the portal: the IT Admin, Registration (support), Finance
(accounting), and teachers.

Portal address: **https://abaacademy.vercel.app**

---

## 1. Who can use the portal

Only eight staff accounts exist. Nobody can create more accounts and nobody can delete these.

| Account | Role | What they do |
| --- | --- | --- |
| admin@abacademypa.com | IT Admin | Full access: staff, groups, Telegram, students, finance |
| support@abacademypa.com | Registration | Applications, groups and placement, directory, weekly schedule |
| accounting@abacademypa.com | Finance | Tuition, payments, receipts, reports |
| firuz@abacademypa.com | Teacher | Own class: attendance, homework, ratings, assessments |
| adhamjon@abacademypa.com | Teacher | Same |
| behzodjon@abacademypa.com | Teacher | Same |
| abdulquddus@abacademypa.com | Teacher | Same |
| abdulwahid@abacademypa.com | Teacher | Same |

Each role sees only its own menu. A teacher sees only their own students and never sees money
details beyond a simple "tuition due" signal.

---

## 2. First login and passwords

1. Open https://abaacademy.vercel.app.
2. Enter your staff email and the temporary password you were given privately.
3. The portal asks you to set a **new password** before you can see any data.
   The new password must be 12 to 128 characters long. Choose something only you know.
4. After that you land on your home page.

**Changing your password later:** click **Change password** in the top bar. You need your current
password. Changing it logs out every other device.

**Forgot your password?** Ask the IT Admin. They open **Users & Roles**, choose your account,
press **Generate password** (or type one), press **Save temporary password**, and hand it to you
privately. At your next login the portal forces you to replace it.

**Logout:** the **Logout** button is in the top bar.

The portal signs you out automatically after 12 hours. The first page load after a quiet period can
take 30–50 seconds because the server wakes up; this is normal.

---

## 3. The daily flow at a glance

```
Registration registers a family  ──►  Teacher reviews / accepts  ──►  Student is enrolled in a group
        │                                                                     │
        │                                   Teacher saves the class day  ◄────┘
        │                                             │
        │                                  Telegram post to the parents' group
        │
        └──►  Finance sets monthly tuition  ──►  invoices appear each month  ──►  Finance records payments
```

---

## 4. Teachers: My Class

Teachers log in and see **My Class**. This is where attendance, homework and ratings are recorded,
and it is what parents receive in Telegram.

### 4.1 Take attendance and save the class

1. In the right-hand panel choose the **group** (for example "Abdulquddus — G1"). Pick one group,
   not "All groups", so the right students are shown.
2. Check the **Date**. It defaults to today. You can pick an earlier day to record a past class,
   but never a future day.
3. Press **Start class**. The student list becomes active.
4. For every student set:
   - **Present / Late / Absent**. Use **Mark all Present** (or Late / Absent) to set everyone at once,
     then change the exceptions.
   - **Homework**: Done / Partial / Not Done.
   - **Rating**: 0 to 5 stars.
   - **Next HW** (open **Details**): what the student should prepare for next time.
     This text appears in the Telegram post as "Next HW".
5. Press **Save class**. All students are saved together; either every record is stored or none is,
   so a lost connection never leaves half a class saved.

After saving, the panel tells you what happened:

- "Attendance was posted to the Telegram group" — the parents' group has the post.
- "The Telegram post was updated" — you saved the same day again and the existing post was edited.
- "It will be posted automatically at 09:30" — the academy uses the daily posting time (see 6.3).
- "The Telegram post failed (…)" — attendance is saved anyway. Press **Save class** again to resend.
  The message tells you why (for example the bot is not in the group). Tell the admin if it keeps failing.

### 4.2 Fixing a mistake

Open the same date, change the student, press **Save class** again. The Telegram post for that day
is edited in place; parents do not get a second post.

### 4.3 What parents see

```
Al-Bukhari Academy | Attendance | 13 Nov 2026
──────────────────

1. Abdulloh Abdusalomzoda
  Present | ⭐⭐⭐⭐⭐ | Last HW: Done
  Next HW: Surah An-Nasr

2. Bekjon Zafarov
  ❌ Absent

──────────────────
📖 My Lord! Increase me in knowledge. -Surah Taha 20:114
```

Present students come first, then late, then absent. Absent students get the short line.

### 4.4 Incoming students and decisions

When Registration sends a family to **teacher review**, the student appears under **Incoming /
Needs your decision** with the parent's contact. Press **Accept** to enroll the student in your group
or **Decline** to send them back to Registration (they go to the waitlist). Students that
Registration enrolled directly simply appear in your list.

### 4.5 Other tools on My Class

- **Export Excel** downloads your group's roster and the day's records.
- **Daily Telegram summary** shows the text of the post; **Copy summary** copies it if you ever need
  to paste it by hand.
- **Enrollment / finance** notes show paused or terminated students and a tuition-due signal.
  Teachers never see amounts or payment history.

### 4.6 Assessments

Open **Assessments** to enter quarterly results (Q1, Q2, Q3, Final) for each student: tajweed and
memorization scores and a short **teacher note** for the report card. The target for "Proficient" is
75%. Filter by group or by **Completed only** to see what is still missing before report cards.

---

## 5. Registration (support): families, groups, schedule

### 5.1 Register a family

**Registration → Family intake**

1. Fill in the child's full name, age, parent first and last name, phone, email, home address,
   parent Telegram and two emergency contacts with their relation.
2. Choose the **Teacher** and **Group**.
3. Choose how to proceed:
   - **Enroll directly in the selected group** — the student is enrolled immediately and appears
     in the teacher's class.
   - **Send to teacher for review first** — the teacher sees the family under "Incoming" and
     accepts or declines.
4. Save. The result shows under **Registration result**.

Registering the same child twice never creates two students. New students receive a permanent
number such as **ABA-0042** that never changes, even after renames or transfers.

### 5.2 Admissions pipeline

The **Pipeline board** shows every application by stage: **New → Teacher Review → Waitlist →
Accepted → Rejected**. Move a card by changing its status. Accepting creates (or reuses) the enrolled
student. **Quick parent contacts** gives the phone list for calls.

### 5.3 Groups & Placement

Each group belongs to one teacher and has a program, a schedule text, a capacity and, optionally, a
Telegram chat.

- **Create group** / **Edit group**: name, teacher, program, schedule, capacity. Changing the teacher
  moves the whole group, with its students, to that teacher.
- **Telegram group chat ID**: the parents' group where attendance is posted (see section 6).
- **Send test message**: posts "this group is connected" to the Telegram group so you can confirm
  the bot works before the first class.
- **Student placement**: pick a student, choose the new group, press **Save placement**. The student
  keeps all attendance and payment history. A group that is full refuses a new student.

### 5.4 Directory

**Directory** lists approved teachers and their students. Search by name, filter by teacher, group
or risk ("Needs review" shows low attendance or overdue tuition).

### 5.5 Weekly Schedule

**Weekly Schedule** is the timetable: rows are teachers, columns are class days. Press **Add** to
create a class block (teacher, day, hours, seats, color), select a block to edit it. The portal
refuses two blocks of the same teacher that overlap in time and marks the **Conflict**.

---

## 6. Telegram attendance posts (IT Admin and Registration)

### 6.1 How it works

Every class group can be linked to the parents' Telegram group. When a teacher saves a class day,
the portal posts the attendance card to that group. Saving the same day again edits the same post.

The seven real class chats are already built into the system and are linked automatically when the
server starts:

| Group | Telegram chat ID |
| --- | --- |
| Behzodjon — G1 | -1003382996965 |
| Behzodjon — G2 | -1003680113409 |
| Abdulquddus — G1 | -1003546618513 |
| Abdulquddus — G2 | -1003540540449 |
| Firuz — G1 | -1003406651107 |
| Adhamjon — G1 | -1003746564495 |
| Abdulwahid — G1 | -1003764772695 |

A chat you enter or clear by hand on the Groups page is never overwritten by the automatic linking.
If an ID was typed without the leading `-100` by mistake, the server repairs it on restart.

### 6.2 Requirements

- The academy bot's token must be set on the server (`TELEGRAM_BOT_TOKEN`, done by the IT Admin).
- The **bot must be a member of every parents' group**. In a supergroup make it an administrator.
- The chat ID must be the full supergroup ID: 13 digits starting with `-100`.

### 6.3 Choose when posts go out

**Groups & Placement → "When attendance is posted to Telegram"**

- **Immediately when the teacher saves** (default). Parents see the class within seconds.
- **Automatically every day at HH:MM** (for example 09:30, academy time, New York). The previous
  class day is posted at that time, like the earlier spreadsheet bot. The teacher sees "It will be
  posted automatically at 09:30" after saving. A day that was already posted is still edited at once.

Press **Save posting time**. The setting applies to all groups.

### 6.4 If a post did not arrive

1. Open the group on the Groups page and press **Send test message**.
2. Read the error:
   - *"Telegram bot is not configured"* — the token is missing on the server (IT Admin).
   - *"chat not found"* / *"bot was kicked"* / *"Forbidden"* — the bot is not in that Telegram
     group, or the chat ID is wrong. Add the bot or fix the ID.
   - *"rejected the bot token"* — the token on the server is wrong.
3. Missed posts are retried by the server every 30 minutes for the last three days, so once the
   cause is fixed the post goes out by itself. The teacher can also just press **Save class** again.

### 6.5 Getting a new chat ID

If a parents' group is recreated, its ID changes. Add the bot to the new group, write any message in
the group, then open in a browser:

```
https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
```

Find `"chat":{"id":-100…}` and enter that number on the Groups page.

---

## 7. Finance (accounting): tuition and payments

Finance and the IT Admin see **Tuition & Payments**, **Payments Matrix** and the finance overview.
The portal records money that was **already received**; it never charges a card itself.

### 7.1 Set up monthly billing for a student

**Tuition & Payments → choose the student → Billing schedule**

1. Enter **Monthly tuition (USD)**.
2. Choose the **First billing month** and **Last billing month** (the real billing period, for
   example September to June; holidays are not assumed).
3. Choose the **Due day of month** (1–28).
4. Press **Save billing schedule**.

From now on an invoice for each month is created automatically, exactly once, as the months arrive.
A past start month creates the missing earlier invoices. Paused or terminated students get no new
invoices. Changing the schedule never silently reprices invoices that already exist.

To bill one extra month, use **Add a single monthly invoice**: billing month, amount, due date,
**Create invoice**.

### 7.2 Record a payment

**Tuition & Payments → choose the student → Record money already received**

1. Choose the **Invoice** (the month being paid).
2. Enter the **Received amount**, **Payment date** and **Payment method**:
   Zelle, Zeffy, Cash, Bank transfer, Check or Other card payment.
3. Enter the **Transaction / reference ID** (Zelle confirmation, Zeffy transaction ID, check number).
4. Save.

Partial payments are allowed; the remaining balance and the overdue status update automatically.
The same payment cannot be recorded twice by accident, and an invoice cannot be overpaid.

### 7.3 Receipts and corrections

- **Payment history & receipts** lists every payment; **Download receipt** gives the parent a receipt
  with the amount, date, method and reference.
- A mistaken payment is **voided**, not deleted: **Correct or void → Void payment record** with a
  reason. The receipt stays in history and the balance is restored. Voiding is a bookkeeping
  correction, not a bank refund.
- **Void invoice** removes an invoice that should not exist. Void its payments first.
- **Save correction** fixes a wrong amount on an invoice.

### 7.4 Payments Matrix

The matrix shows **who paid what for each month** of the school year, one row per student, one
column per month, all calculated from the same ledger. Below it:

- **Enter received money**: student, payment for month, amount, method, transaction date, reference.
  This creates the month's invoice if it does not exist yet.
- **Transactions ledger**: every payment, newest first, with **Correct** (void) per row.
- **Export matrix** and **Export ledger** download CSV files for Excel.

### 7.5 Opening balances and old records

Debt carried over from the previous spreadsheet appears once as an **Opening balance** invoice.
Old manually edited monthly cells are shown read-only and marked legacy; they are not counted as
receipts.

---

## 8. Students (IT Admin)

**Students** is the full directory with a profile panel.

- Search by student, parent, phone or address; filter by teacher, group, **Low attendance** or
  **Overdue tuition**.
- **Attendance history** shows a calendar: green present, amber late, red absent, grey no record.
  Click a day to correct it; if that day was already posted to Telegram, the post is updated.
- **Enrollment**: **End enrollment** with a reason (moved, withdrew…) stops new invoices and removes
  the student from the teacher's active list; **Reactivate** brings them back. History is kept.
- **Finance note** and **Parent contact** are editable here.

---

## 9. IT Admin: Overview and Users & Roles

### 9.1 Overview

The admin **Overview** is the daily control panel:

- **Operations exceptions center**: the highest-signal items for today (missed classes, low
  attendance, overdue tuition, academic follow-up). Acknowledge an item after assigning an owner.
- **Teacher breakdown**: capacity and attendance by group, lowest attendance this month, top
  performers, needs-support list. Filter by teacher, group or month.
- Finance sees its own **Accounting** overview with recent receipts and family balances.

### 9.2 Users & Roles

- Shows the eight accounts, active or inactive.
- **Save name** edits the display name. Email and role are fixed.
- **Set temporary password → Generate password → Save temporary password** resets a colleague's
  password; they must change it at next login. Resetting a password logs that person out everywhere.
- **Activate / Deactivate** switches access on or off without deleting any data. The admin cannot
  deactivate itself.

---

## 10. Frequently asked questions

**The page says "Live DB". What is that?**
The portal is connected to the production database. Everything you save is real.

**The teacher pressed Save but parents got nothing.**
See 6.4. Attendance itself is always saved; only the Telegram delivery can fail, and it is retried.

**Can a teacher post to Telegram manually?**
No. Posting is automatic. The teacher only saves the class. **Copy summary** is there as a backup.

**Can two groups share one Telegram chat?**
No. Each chat is linked to exactly one group.

**A student moved to another teacher. Do we lose history?**
No. Use **Student placement**. Attendance and payments stay with the student, and the student number
does not change.

**We still have the old Google Apps Script bot.**
Turn off its daily trigger (Apps Script → Triggers → delete `postTodayAttendance`), otherwise parents
receive the same attendance twice.

**Who do I contact?**
Portal access and Telegram: the IT Admin (admin@abacademypa.com). Money questions: Finance
(accounting@abacademypa.com). Registration and groups: support@abacademypa.com.
