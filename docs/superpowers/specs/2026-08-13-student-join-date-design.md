# Per-Student Join Date for Attendance

## Problem

Attendance stats currently count every `AttendanceRecord` for a class against every student in that class, regardless of when the student was actually added. A student who joins partway through the term is penalized for classes held before they joined (counted as absent), and their attendance percentage / detained status is calculated against a denominator that includes classes they were never expected to attend.

## Goal

Each student's attendance stats (total classes, present/absent counts, attendance percentage, detained flag) should only be calculated from their individual join date onward, not from the class's first-ever attendance record.

## Data Model

`src/types/index.ts` — add to `Student`:

```ts
export interface Student {
  id: string;
  classId: string;
  name: string;
  rollNumber: string;
  joinDate: string;  // YYYY-MM-DD — attendance is only counted from this date onward
  createdAt: string; // unchanged: when the record was added to the app
}
```

`joinDate` is distinct from `createdAt`: `createdAt` is an audit timestamp of when the row was created in the app; `joinDate` is the user-editable, meaningful date attendance calculations key off. They will usually match but don't have to (e.g. a teacher bulk-imports an existing roster days after the term started, or later corrects a wrong join date).

## Storage Layer (`src/utils/storage.ts`)

- `addStudent(classId, name, rollNumber, sortByRoll?, joinDate?)` — `joinDate` defaults to `getTodayDate()` when omitted.
- `updateStudent(id, name, rollNumber, joinDate)` — `joinDate` becomes editable, same as name/roll number.
- **Migration**: on first load after this ships, any existing `Student` missing `joinDate` is backfilled to the earliest `AttendanceRecord.date` for their `classId` (falling back to their existing `createdAt` if the class has no attendance records yet). This preserves current stats for every student already in the app — nothing shifts for them.
- Every stats/export calculation that currently does `totalClasses = attendanceRecords.length` (or `dates.length`) per student changes to filter per-student:
  ```ts
  const studentRecords = attendanceRecords.filter(r => r.date >= student.joinDate);
  const totalClasses = studentRecords.length;
  ```
  This applies at each of the following locations (line numbers as of this writing, will shift):
  - `getClassAttendanceStats` (~488)
  - class stats totals (~576)
  - single-sheet export (~752)
  - multi-sheet export (~883)
  - lecture-requirement export (~1288)

  The class-level `totalClassesConducted` / "Total Classes: N" header stays the full class-wide count — only each student's individual row uses the join-date-filtered count.

## UI

- `AddEditStudentScreen.tsx`: add a join-date field using the existing `DateTimePicker` pattern from `ClassScheduleScreen.tsx`. Defaults to today when adding a new student; editable on both add and edit.
- `BulkAddStudentsScreen.tsx`: one shared join-date field applied to the whole batch (not per-row) — bulk-add is typically one roster joining together at the same time, so a single field keeps the form simple. All students added in that batch get the same `joinDate`.

## Exports

When a student's `joinDate` differs from the class's earliest attendance date, add a small note next to their row (e.g. "Joined: DD-MM-YYYY") in the HTML/Excel exports, so the reduced denominator isn't confusing on paper. When `joinDate` matches the class-wide earliest date (the common case), no note is shown.

## Out of Scope

- Per-row join dates in bulk-add (single shared date for the batch is sufficient).
- Retroactively editing/marking individual `AttendanceRecord`s — filtering happens at read time only, stored records are untouched.
