# Student Join Date Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-student `joinDate` so attendance stats and exports only count classes from the date each student actually joined, instead of every student being measured against the class's full history.

**Architecture:** Add a `joinDate: string` (YYYY-MM-DD) field to `Student`. `addStudent`/`updateStudent` accept and persist it. A one-time migration backfills existing students to their class's earliest attendance date so current stats don't shift. Every stats/export calculation filters `AttendanceRecord`s per-student by `record.date >= student.joinDate` instead of using one shared count for the whole class. Two screens (`AddEditStudentScreen`, `BulkAddStudentsScreen`) get a date picker using the existing `DateTimePicker` pattern from `ClassScheduleScreen.tsx`.

**Tech Stack:** React Native 0.74.5 / Expo SDK 51 / TypeScript, `@react-native-community/datetimepicker`, `@react-native-async-storage/async-storage`.

**Note on verification:** This project has no automated test framework (`package.json` has no test script, no jest config). Per `CLAUDE.md`, the standard check is `npx tsc --noEmit`. Each task below substitutes a "write failing test" step with a hand-worked example computed inline in the task, and a manual UI smoke-test step where relevant, in place of automated tests.

---

### Task 1: Add `joinDate` to the `Student` type

**Files:**
- Modify: `src/types/index.ts:41-47`

- [ ] **Step 1: Add the field**

Replace:
```ts
export interface Student {
  id: string;
  classId: string;
  name: string;
  rollNumber: string;
  createdAt: string;
}
```
with:
```ts
export interface Student {
  id: string;
  classId: string;
  name: string;
  rollNumber: string;
  joinDate: string;  // YYYY-MM-DD — attendance is only counted from this date onward
  createdAt: string;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: New errors at every call site of `addStudent`/`updateStudent` and every place a `Student` object literal is built without `joinDate` — this is expected; they get fixed in Tasks 2, 8, 9. If you see errors unrelated to `Student`/`joinDate`, stop and investigate before continuing.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "types: add joinDate field to Student"
```

---

### Task 1b: Backfill `joinDate` in `importAttendance.ts` (gap found during Task 1 implementation)

**Files:**
- Modify: `src/utils/importAttendance.ts:236-245`

The Excel-import path builds `Student` object literals directly (not via `addStudent`), so it also needs a `joinDate`. This wasn't caught during brainstorming — the design spec only covered `addStudent`/`updateStudent` and the UI screens, not this bulk-import path. Default to the imported sheet's earliest date column (`dateColumns[0]`), consistent with the migration backfill's "earliest attendance date" rule in Task 2.

- [ ] **Step 1: Add joinDate when constructing an imported student**

Replace (`importAttendance.ts:236-245`):
```ts
      let student = newStudents.find(s => s.classId === classId && s.rollNumber === rollNumber);
      if (!student) {
        student = {
          id: generateId(),
          classId,
          name,
          rollNumber,
          createdAt: new Date().toISOString(),
        };
        newStudents.push(student);
        result.studentsImported++;
      }
```
with:
```ts
      let student = newStudents.find(s => s.classId === classId && s.rollNumber === rollNumber);
      if (!student) {
        student = {
          id: generateId(),
          classId,
          name,
          rollNumber,
          joinDate: dateColumns[0] || new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
        };
        newStudents.push(student);
        result.studentsImported++;
      }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: The `importAttendance.ts` errors introduced by Task 1 are gone. Only the two pre-existing `AppNavigator.tsx` errors and the `storage.ts` `addStudent` call-site error (fixed in Task 2) should remain.

- [ ] **Step 3: Commit**

```bash
git add src/utils/importAttendance.ts
git commit -m "import: backfill joinDate for students created via Excel import"
```

---

### Task 2: `addStudent`/`updateStudent` + migration in `storage.ts`

**Files:**
- Modify: `src/utils/storage.ts:106-197`

- [ ] **Step 1: Add the migration helper and wire it into `getStudents`**

Replace (`storage.ts:106-114`):
```ts
export const getStudents = async (): Promise<Student[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.STUDENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting students:', error);
    return [];
  }
};
```
with:
```ts
// One-time migration: backfill joinDate for students saved before this field existed.
// Defaults to the class's earliest attendance record date, so existing stats don't shift.
const backfillJoinDates = async (students: Student[]): Promise<Student[]> => {
  const missing = students.filter((s) => !s.joinDate);
  if (missing.length === 0) return students;

  const allRecords = await getAttendanceRecords();
  const earliestByClass = new Map<string, string>();
  allRecords.forEach((r) => {
    const current = earliestByClass.get(r.classId);
    if (!current || r.date < current) earliestByClass.set(r.classId, r.date);
  });

  const updated = students.map((s) => {
    if (s.joinDate) return s;
    const joinDate = earliestByClass.get(s.classId) || s.createdAt.split('T')[0];
    return { ...s, joinDate };
  });

  await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
  return updated;
};

export const getStudents = async (): Promise<Student[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.STUDENTS);
    const students: Student[] = data ? JSON.parse(data) : [];
    return await backfillJoinDates(students);
  } catch (error) {
    console.error('Error getting students:', error);
    return [];
  }
};
```

`getAttendanceRecords` is defined later in the file (`storage.ts:220`) but that's fine — `backfillJoinDates` only calls it when it actually runs (at `getStudents()` call time), by which point the whole module has finished loading.

- [ ] **Step 2: Add `joinDate` param to `addStudent`**

Replace (`storage.ts:167-188`):
```ts
export const addStudent = async (classId: string, name: string, rollNumber: string, sortByRoll?: boolean): Promise<Student> => {
  const students = await getStudents();
  const newStudent: Student = {
    id: generateId(),
    classId,
    name,
    rollNumber,
    createdAt: new Date().toISOString(),
  };
```
with:
```ts
export const addStudent = async (classId: string, name: string, rollNumber: string, sortByRoll?: boolean, joinDate?: string): Promise<Student> => {
  const students = await getStudents();
  const newStudent: Student = {
    id: generateId(),
    classId,
    name,
    rollNumber,
    joinDate: joinDate || getTodayDate(),
    createdAt: new Date().toISOString(),
  };
```
(leave the rest of the function — lines 176-188 — unchanged)

- [ ] **Step 3: Add `joinDate` param to `updateStudent`**

Replace (`storage.ts:190-197`):
```ts
export const updateStudent = async (id: string, name: string, rollNumber: string): Promise<void> => {
  const students = await getStudents();
  const index = students.findIndex((s) => s.id === id);
  if (index !== -1) {
    students[index] = { ...students[index], name, rollNumber };
    await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }
};
```
with:
```ts
export const updateStudent = async (id: string, name: string, rollNumber: string, joinDate: string): Promise<void> => {
  const students = await getStudents();
  const index = students.findIndex((s) => s.id === id);
  if (index !== -1) {
    students[index] = { ...students[index], name, rollNumber, joinDate };
    await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }
};
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: Remaining errors should now only be at the two screen call sites (`AddEditStudentScreen.tsx`, `BulkAddStudentsScreen.tsx`) missing the new `updateStudent` argument — fixed in Tasks 8-9.

- [ ] **Step 5: Manual verification (hand-worked example)**

Trace through `backfillJoinDates` by hand: given `students = [{id:'s1', classId:'c1', createdAt:'2026-01-10T00:00:00.000Z', joinDate: undefined, ...}]` and `allRecords = [{classId:'c1', date:'2026-01-15', ...}, {classId:'c1', date:'2026-01-20', ...}]`, `earliestByClass` becomes `{c1 → '2026-01-15'}`, so `s1.joinDate` becomes `'2026-01-15'` (not `'2026-01-10'` from `createdAt`). Confirms existing students backfill to the class's first attendance date, not their raw `createdAt`.

- [ ] **Step 6: Commit**

```bash
git add src/utils/storage.ts
git commit -m "storage: add joinDate to addStudent/updateStudent, backfill existing students"
```

---

### Task 3: Filter stats by `joinDate`

**Files:**
- Modify: `src/utils/storage.ts:485-525`

- [ ] **Step 1: Update `calculateStudentStats`**

Replace (`storage.ts:485-508`):
```ts
export const calculateStudentStats = async (classId: string): Promise<StudentAttendanceStats[]> => {
  const students = await getStudentsByClass(classId);
  const attendanceRecords = await getAttendanceByClass(classId);
  const totalClasses = attendanceRecords.length;

  return students.map((student) => {
    const totalAbsent = attendanceRecords.filter((record) =>
      record.absentStudentIds.includes(student.id)
    ).length;
    const totalPresent = totalClasses - totalAbsent;
    const attendancePercentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;

    return {
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      totalClasses,
      totalPresent,
      totalAbsent,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
      isDetained: attendancePercentage < 75,
    };
  });
};
```
with:
```ts
export const calculateStudentStats = async (classId: string): Promise<StudentAttendanceStats[]> => {
  const students = await getStudentsByClass(classId);
  const attendanceRecords = await getAttendanceByClass(classId);

  return students.map((student) => {
    const studentRecords = attendanceRecords.filter((record) => record.date >= student.joinDate);
    const totalClasses = studentRecords.length;
    const totalAbsent = studentRecords.filter((record) =>
      record.absentStudentIds.includes(student.id)
    ).length;
    const totalPresent = totalClasses - totalAbsent;
    const attendancePercentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;

    return {
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      totalClasses,
      totalPresent,
      totalAbsent,
      attendancePercentage: Math.round(attendancePercentage * 100) / 100,
      isDetained: attendancePercentage < 75,
    };
  });
};
```

Note `calculateClassStats` (`storage.ts:510-525`) is unchanged — it calls `calculateStudentStats` for the per-student rows, and separately keeps `totalClassesConducted: attendanceRecords.length` as the class-wide total (per the design spec, the class header total must stay class-wide, not per-student).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors from this change.

- [ ] **Step 3: Manual verification (hand-worked example)**

Class has attendance records on `2026-01-10`, `2026-01-15`, `2026-01-20` (3 total). Student A has `joinDate: '2026-01-01'` (before all records) → `totalClasses = 3`, matches old behavior. Student B has `joinDate: '2026-01-16'` (joined after the first two) → `studentRecords` = only the `2026-01-20` record → `totalClasses = 1`. If B was absent on `2026-01-10` and `2026-01-15` (both pre-join, now excluded) and present on `2026-01-20`, old code would have given B `1/3 = 33%` (detained); new code gives `1/1 = 100%` (not detained) — this is the bug fix working as intended.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts
git commit -m "storage: filter per-student stats by joinDate"
```

---

### Task 4: Join-date-aware single-sheet export (`exportClassAttendanceToCSV`)

**Files:**
- Modify: `src/utils/storage.ts:565-694`

- [ ] **Step 1: Add a shared `getJoinDateNote` helper**

Add this just above `export const exportClassAttendanceToCSV` (i.e. immediately before `storage.ts:565`):
```ts
// Returns a " (Joined: DD/MM/YYYY)" suffix for export name cells when a student's
// joinDate differs from the class's earliest attendance date; '' when they match.
const getJoinDateNote = (student: Student, classEarliestDate: string): string => {
  if (!classEarliestDate || student.joinDate === classEarliestDate) return '';
  return ` (Joined: ${formatDate(student.joinDate)})`;
};
```

- [ ] **Step 2: Fix the detained-only pre-filter to use per-student joinDate**

Replace (`storage.ts:578-588`):
```ts
  // Filter students if detained-only export is requested
  if (filterDetainedOnly) {
    students = students.filter(student => {
      const totalAbsent = sortedRecords.filter(record =>
        record.absentStudentIds.includes(student.id)
      ).length;
      const totalPresent = totalClasses - totalAbsent;
      const percentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;
      return percentage < 75; // Only include detained students
    });
  }
```
with:
```ts
  // Filter students if detained-only export is requested
  if (filterDetainedOnly) {
    students = students.filter(student => {
      const studentRecords = sortedRecords.filter(record => record.date >= student.joinDate);
      const studentTotalClasses = studentRecords.length;
      const totalAbsent = studentRecords.filter(record =>
        record.absentStudentIds.includes(student.id)
      ).length;
      const totalPresent = studentTotalClasses - totalAbsent;
      const percentage = studentTotalClasses > 0 ? (totalPresent / studentTotalClasses) * 100 : 100;
      return percentage < 75; // Only include detained students
    });
  }
```

- [ ] **Step 3: Update the row-building loop to mark pre-join dates and use a per-student denominator**

Replace (`storage.ts:621-646`):
```ts
  // Create data rows
  const rows: string[][] = [];
  students.forEach((student, index) => {
    const row: string[] = [
      (index + 1).toString(),
      student.rollNumber,
      student.name,
    ];
    
    let totalPresent = 0;
    dates.forEach(date => {
      const record = sortedRecords.find(r => r.date === date);
      const isAbsent = record?.absentStudentIds.includes(student.id) || false;
      row.push(isAbsent ? 'A' : 'P');
      if (!isAbsent) totalPresent++;
    });
    
    const percentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100) : 100;
    const isDetained = percentage < 75;
    
    row.push(totalPresent.toString());
    row.push(`${percentage.toFixed(2)}%`);
    row.push(isDetained ? 'DETAINED' : 'OK');
    
    rows.push(row);
  });
```
with:
```ts
  // Create data rows
  const classEarliestDate = dates[0] || '';
  const rows: string[][] = [];
  students.forEach((student, index) => {
    const row: string[] = [
      (index + 1).toString(),
      student.rollNumber,
      `${student.name}${getJoinDateNote(student, classEarliestDate)}`,
    ];

    let totalPresent = 0;
    let studentTotalClasses = 0;
    dates.forEach(date => {
      if (date < student.joinDate) {
        row.push('-');
        return;
      }
      studentTotalClasses++;
      const record = sortedRecords.find(r => r.date === date);
      const isAbsent = record?.absentStudentIds.includes(student.id) || false;
      row.push(isAbsent ? 'A' : 'P');
      if (!isAbsent) totalPresent++;
    });

    const percentage = studentTotalClasses > 0 ? ((totalPresent / studentTotalClasses) * 100) : 100;
    const isDetained = percentage < 75;

    row.push(totalPresent.toString());
    row.push(`${percentage.toFixed(2)}%`);
    row.push(isDetained ? 'DETAINED' : 'OK');

    rows.push(row);
  });
```

- [ ] **Step 4: Style the new `-` cells neutrally instead of green**

Replace (`storage.ts:676-682`):
```ts
      } else if (i > 2 && i < row.length - 3) {
        if (cell === 'A') {
          style += ' color: #c5221f;';
        } else {
          style += ' color: #137333;';
        }
      }
```
with:
```ts
      } else if (i > 2 && i < row.length - 3) {
        if (cell === 'A') {
          style += ' color: #c5221f;';
        } else if (cell === '-') {
          style += ' color: #999999;';
        } else {
          style += ' color: #137333;';
        }
      }
```

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 6: Manual verification (hand-worked example)**

Class dates: `['2026-01-10', '2026-01-15', '2026-01-20']`. Student with `joinDate: '2026-01-16'`: cell for `2026-01-10` → `date < joinDate` → pushes `'-'`, `studentTotalClasses` stays 0; cell for `2026-01-15` → still `< joinDate` → `'-'`; cell for `2026-01-20` → `>= joinDate` → counted, `studentTotalClasses = 1`. Final row: `['-', '-', 'P'or'A', totalPresent, percentage, status]` with percentage computed out of 1, not 3. Matches the design.

- [ ] **Step 7: Commit**

```bash
git add src/utils/storage.ts
git commit -m "export: single-sheet CSV/XLS export respects per-student joinDate"
```

---

### Task 5: Join-date-aware multi-sheet export (`generateClassAttendanceSheet`)

**Files:**
- Modify: `src/utils/storage.ts:731-855` (function body)
- Modify: `src/utils/storage.ts:1110-1171` (shared Styles block used by `exportAllClassesToXLS`)

- [ ] **Step 1: Add a `NotJoined` style next to `Present`/`Absent`**

In the `<Styles>` block inside `exportAllClassesToXLS`, replace (`storage.ts:1142-1150`):
```ts
    <Style ss:ID="Absent">
      <Font ss:FontName="Times New Roman" ss:Color="#c5221f"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
```
with:
```ts
    <Style ss:ID="Absent">
      <Font ss:FontName="Times New Roman" ss:Color="#c5221f"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="NotJoined">
      <Font ss:FontName="Times New Roman" ss:Color="#999999"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
```

- [ ] **Step 2: Update the data-row loop in `generateClassAttendanceSheet`**

Replace (`storage.ts:810-838`):
```ts
  // Data rows
  students.forEach((student, index) => {
    let totalPresent = 0;

    // Calculate attendance
    const attendanceCells: string[] = [];
    dates.forEach(date => {
      const record = sortedRecords.find(r => r.date === date);
      const isAbsent = record?.absentStudentIds.includes(student.id) || false;
      const value = isAbsent ? 'A' : 'P';
      const styleId = isAbsent ? 'Absent' : 'Present';
      attendanceCells.push(`        <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${value}</Data></Cell>`);
      if (!isAbsent) totalPresent++;
    });

    const percentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100) : 100;
    const isDetained = percentage < 75;
    const statusStyleId = isDetained ? 'Detained' : 'OK';

    tableXML += '      <Row>\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${index + 1}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(student.rollNumber)}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(student.name)}</Data></Cell>\n`;
    tableXML += attendanceCells.join('\n') + '\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${totalPresent}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${percentage.toFixed(2)}%</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="${statusStyleId}"><Data ss:Type="String">${isDetained ? 'DETAINED' : 'OK'}</Data></Cell>\n`;
    tableXML += '      </Row>\n';
  });
```
with:
```ts
  // Data rows
  const classEarliestDate = dates[0] || '';
  students.forEach((student, index) => {
    let totalPresent = 0;
    let studentTotalClasses = 0;

    // Calculate attendance
    const attendanceCells: string[] = [];
    dates.forEach(date => {
      if (date < student.joinDate) {
        attendanceCells.push(`        <Cell ss:StyleID="NotJoined"><Data ss:Type="String">-</Data></Cell>`);
        return;
      }
      studentTotalClasses++;
      const record = sortedRecords.find(r => r.date === date);
      const isAbsent = record?.absentStudentIds.includes(student.id) || false;
      const value = isAbsent ? 'A' : 'P';
      const styleId = isAbsent ? 'Absent' : 'Present';
      attendanceCells.push(`        <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${value}</Data></Cell>`);
      if (!isAbsent) totalPresent++;
    });

    const percentage = studentTotalClasses > 0 ? ((totalPresent / studentTotalClasses) * 100) : 100;
    const isDetained = percentage < 75;
    const statusStyleId = isDetained ? 'Detained' : 'OK';
    const nameCell = `${escapeXML(student.name)}${escapeXML(getJoinDateNote(student, classEarliestDate))}`;

    tableXML += '      <Row>\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${index + 1}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(student.rollNumber)}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${nameCell}</Data></Cell>\n`;
    tableXML += attendanceCells.join('\n') + '\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${totalPresent}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${percentage.toFixed(2)}%</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="${statusStyleId}"><Data ss:Type="String">${isDetained ? 'DETAINED' : 'OK'}</Data></Cell>\n`;
    tableXML += '      </Row>\n';
  });
```

Note: `getJoinDateNote` (added in Task 4, Step 1) is a module-level `const`, so it's already in scope here — no new import needed.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts
git commit -m "export: multi-sheet XLS respects per-student joinDate"
```

---

### Task 6: Join-date-aware `generateClassAttendanceSheetFiltered`

**Files:**
- Modify: `src/utils/storage.ts:862-999`

- [ ] **Step 1: Fix the detained-only pre-filter**

Replace (`storage.ts:885-895`):
```ts
  // Filter students if detained-only export is requested
  if (filterDetainedOnly) {
    students = students.filter(student => {
      const totalAbsent = sortedRecords.filter(record =>
        record.absentStudentIds.includes(student.id)
      ).length;
      const totalPresent = totalClasses - totalAbsent;
      const percentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;
      return percentage < 75; // Only include detained students
    });
  }
```
with:
```ts
  // Filter students if detained-only export is requested
  if (filterDetainedOnly) {
    students = students.filter(student => {
      const studentRecords = sortedRecords.filter(record => record.date >= student.joinDate);
      const studentTotalClasses = studentRecords.length;
      const totalAbsent = studentRecords.filter(record =>
        record.absentStudentIds.includes(student.id)
      ).length;
      const totalPresent = studentTotalClasses - totalAbsent;
      const percentage = studentTotalClasses > 0 ? (totalPresent / studentTotalClasses) * 100 : 100;
      return percentage < 75; // Only include detained students
    });
  }
```

- [ ] **Step 2: Update the data-row loop**

Replace (`storage.ts:966-994`):
```ts
  // Data rows
  students.forEach((student, index) => {
    let totalPresent = 0;

    // Calculate attendance
    const attendanceCells: string[] = [];
    dates.forEach(date => {
      const record = sortedRecords.find(r => r.date === date);
      const isAbsent = record?.absentStudentIds.includes(student.id) || false;
      const value = isAbsent ? 'A' : 'P';
      const styleId = isAbsent ? 'Absent' : 'Present';
      attendanceCells.push(`        <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${value}</Data></Cell>`);
      if (!isAbsent) totalPresent++;
    });

    const percentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100) : 100;
    const isDetained = percentage < 75;
    const statusStyleId = isDetained ? 'Detained' : 'OK';

    tableXML += '      <Row>\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${index + 1}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(student.rollNumber)}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(student.name)}</Data></Cell>\n`;
    tableXML += attendanceCells.join('\n') + '\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${totalPresent}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${percentage.toFixed(2)}%</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="${statusStyleId}"><Data ss:Type="String">${isDetained ? 'DETAINED' : 'OK'}</Data></Cell>\n`;
    tableXML += '      </Row>\n';
  });
```
with:
```ts
  // Data rows
  const classEarliestDate = dates[0] || '';
  students.forEach((student, index) => {
    let totalPresent = 0;
    let studentTotalClasses = 0;

    // Calculate attendance
    const attendanceCells: string[] = [];
    dates.forEach(date => {
      if (date < student.joinDate) {
        attendanceCells.push(`        <Cell ss:StyleID="NotJoined"><Data ss:Type="String">-</Data></Cell>`);
        return;
      }
      studentTotalClasses++;
      const record = sortedRecords.find(r => r.date === date);
      const isAbsent = record?.absentStudentIds.includes(student.id) || false;
      const value = isAbsent ? 'A' : 'P';
      const styleId = isAbsent ? 'Absent' : 'Present';
      attendanceCells.push(`        <Cell ss:StyleID="${styleId}"><Data ss:Type="String">${value}</Data></Cell>`);
      if (!isAbsent) totalPresent++;
    });

    const percentage = studentTotalClasses > 0 ? ((totalPresent / studentTotalClasses) * 100) : 100;
    const isDetained = percentage < 75;
    const statusStyleId = isDetained ? 'Detained' : 'OK';
    const nameCell = `${escapeXML(student.name)}${escapeXML(getJoinDateNote(student, classEarliestDate))}`;

    tableXML += '      <Row>\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${index + 1}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(student.rollNumber)}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${nameCell}</Data></Cell>\n`;
    tableXML += attendanceCells.join('\n') + '\n';
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="Number">${totalPresent}</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${percentage.toFixed(2)}%</Data></Cell>\n`;
    tableXML += `        <Cell ss:StyleID="${statusStyleId}"><Data ss:Type="String">${isDetained ? 'DETAINED' : 'OK'}</Data></Cell>\n`;
    tableXML += '      </Row>\n';
  });
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts
git commit -m "export: filtered multi-sheet XLS respects per-student joinDate"
```

---

### Task 7: Join-date-aware `generateDetaineeSheetTable`

**Files:**
- Modify: `src/utils/storage.ts:1281-1330`

- [ ] **Step 1: Update the detainee-collection loop to use per-student counts**

Replace (`storage.ts:1302-1323`):
```ts
  const allDetainees: DetaineeInfo[] = [];

  for (const student of students) {
    const totalAbsent = sortedRecords.filter(record =>
      record.absentStudentIds.includes(student.id)
    ).length;
    const totalPresent = totalClasses - totalAbsent;
    const percentage = totalClasses > 0 ? (totalPresent / totalClasses) * 100 : 100;

    if (percentage < 75) {
      const lectureRequired = Math.ceil(totalClasses * 0.75);
      allDetainees.push({
        rollNumber: student.rollNumber,
        name: student.name,
        totalDelivered: totalClasses,
        lectureRequired,
        totalAttended: totalPresent,
        lectureShort: lectureRequired - totalPresent,
        percentage,
      });
    }
  }
```
with:
```ts
  const classEarliestDate = dates[0] || '';
  const allDetainees: DetaineeInfo[] = [];

  for (const student of students) {
    const studentRecords = sortedRecords.filter(record => record.date >= student.joinDate);
    const studentTotalClasses = studentRecords.length;
    const totalAbsent = studentRecords.filter(record =>
      record.absentStudentIds.includes(student.id)
    ).length;
    const totalPresent = studentTotalClasses - totalAbsent;
    const percentage = studentTotalClasses > 0 ? (totalPresent / studentTotalClasses) * 100 : 100;

    if (percentage < 75) {
      const lectureRequired = Math.ceil(studentTotalClasses * 0.75);
      allDetainees.push({
        rollNumber: student.rollNumber,
        name: `${student.name}${getJoinDateNote(student, classEarliestDate)}`,
        totalDelivered: studentTotalClasses,
        lectureRequired,
        totalAttended: totalPresent,
        lectureShort: lectureRequired - totalPresent,
        percentage,
      });
    }
  }
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No new errors.

- [ ] **Step 3: Manual verification (hand-worked example)**

Class has 20 total attendance records; student joined after 12 of them, so `studentTotalClasses = 8`. Old code: `lectureRequired = ceil(20 * 0.75) = 15`, comparing against a 20-class history the student was never part of for 12 of those classes — clearly wrong. New code: `lectureRequired = ceil(8 * 0.75) = 6`, correctly scaled to the 8 classes the student was actually eligible for.

- [ ] **Step 4: Commit**

```bash
git add src/utils/storage.ts
git commit -m "export: detainee list respects per-student joinDate"
```

---

### Task 8: Join-date picker in `AddEditStudentScreen`

**Files:**
- Modify: `src/screens/AddEditStudentScreen.tsx`

- [ ] **Step 1: Add imports**

Replace (top of file):
```tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addStudent, updateStudent, getStudentById, getSortPreference, setSortPreference } from '../utils/storage';
```
with:
```tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addStudent, updateStudent, getStudentById, getSortPreference, setSortPreference, getTodayDate, formatDate } from '../utils/storage';
```

- [ ] **Step 2: Add state for join date and its picker visibility**

Replace:
```tsx
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [sortByRoll, setSortByRoll] = useState(false);
```
with:
```tsx
  const [name, setName] = useState('');
  const [rollNumber, setRollNumber] = useState('');
  const [joinDate, setJoinDate] = useState(getTodayDate());
  const [showJoinDatePicker, setShowJoinDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sortByRoll, setSortByRoll] = useState(false);
```

- [ ] **Step 3: Load existing joinDate when editing**

Replace:
```tsx
    if (student) {
      setName(student.name);
      setRollNumber(student.rollNumber);
    }
```
with:
```tsx
    if (student) {
      setName(student.name);
      setRollNumber(student.rollNumber);
      setJoinDate(student.joinDate);
    }
```

- [ ] **Step 4: Pass joinDate through save**

Replace:
```tsx
      if (isEdit && studentId) {
        await updateStudent(studentId, name.trim(), rollNumber.trim());
        Alert.alert('Success', 'Student updated successfully');
      } else {
        await addStudent(classId, name.trim(), rollNumber.trim(), sortByRoll);
        Alert.alert('Success', 'Student added successfully');
      }
```
with:
```tsx
      if (isEdit && studentId) {
        await updateStudent(studentId, name.trim(), rollNumber.trim(), joinDate);
        Alert.alert('Success', 'Student updated successfully');
      } else {
        await addStudent(classId, name.trim(), rollNumber.trim(), sortByRoll, joinDate);
        Alert.alert('Success', 'Student added successfully');
      }
```

- [ ] **Step 5: Add the date field to the form UI**

Replace:
```tsx
        <Text style={styles.label}>Student Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g., John Doe"
          placeholderTextColor="#999"
        />

        {!isEdit && (
```
with:
```tsx
        <Text style={styles.label}>Student Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g., John Doe"
          placeholderTextColor="#999"
        />

        <Text style={styles.label}>Join Date *</Text>
        <TouchableOpacity style={styles.dateButton} onPress={() => setShowJoinDatePicker(true)}>
          <Text style={styles.dateButtonText}>{formatDate(joinDate)}</Text>
        </TouchableOpacity>
        {showJoinDatePicker && (
          <DateTimePicker
            value={new Date(joinDate + 'T00:00:00')}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, date) => {
              setShowJoinDatePicker(Platform.OS === 'ios');
              if (date) setJoinDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
            }}
          />
        )}

        {!isEdit && (
```

- [ ] **Step 6: Add the `dateButton`/`dateButtonText` styles**

Replace:
```tsx
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
```
with:
```tsx
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors remaining for this file.

- [ ] **Step 8: Manual UI smoke test**

Run `npm run web`, open a class, tap "Add Student": confirm the "Join Date" field shows today's date by default, tapping it opens a date picker, picking a past date updates the button text, and saving persists it (re-open "Edit Student" for that student and confirm the same date shows). Repeat for Edit Student on an existing student to confirm their current `joinDate` loads correctly.

- [ ] **Step 9: Commit**

```bash
git add src/screens/AddEditStudentScreen.tsx
git commit -m "ui: add join date picker to Add/Edit Student screen"
```

---

### Task 9: Shared join-date field in `BulkAddStudentsScreen`

**Files:**
- Modify: `src/screens/BulkAddStudentsScreen.tsx`

- [ ] **Step 1: Add imports**

Replace:
```tsx
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addStudent, getClassById, getSortPreference, setSortPreference } from '../utils/storage';
```
with:
```tsx
import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { Text } from '../components/AppText';
import { TextInput } from '../components/AppTextInput';
import DateTimePicker from '@react-native-community/datetimepicker';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addStudent, getClassById, getSortPreference, setSortPreference, getTodayDate, formatDate } from '../utils/storage';
```

- [ ] **Step 2: Add join-date state**

Replace:
```tsx
  const [inputText, setInputText] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [className, setClassName] = useState('');
  const [sortByRoll, setSortByRoll] = useState(false);
```
with:
```tsx
  const [inputText, setInputText] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [className, setClassName] = useState('');
  const [sortByRoll, setSortByRoll] = useState(false);
  const [joinDate, setJoinDate] = useState(getTodayDate());
  const [showJoinDatePicker, setShowJoinDatePicker] = useState(false);
```

- [ ] **Step 3: Pass joinDate to every `addStudent` call in the batch**

Replace:
```tsx
        await addStudent(classId, student.name, student.rollNumber, shouldSort);
```
with:
```tsx
        await addStudent(classId, student.name, student.rollNumber, shouldSort, joinDate);
```

- [ ] **Step 4: Add the date field to the preview section UI, above the save button**

Replace:
```tsx
            <View style={styles.sortOption}>
              <View style={styles.sortOptionText}>
                <Text style={styles.sortLabel}>Sort by Roll Number</Text>
                <Text style={styles.sortHint}>
                  {sortByRoll ? 'Students will be arranged by roll number' : 'Students will be appended at the end'}
                </Text>
              </View>
              <Switch
                value={sortByRoll}
                onValueChange={handleSortToggle}
                trackColor={{ false: '#ddd', true: '#81b0ff' }}
                thumbColor={sortByRoll ? '#4A90D9' : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
```
with:
```tsx
            <View style={styles.sortOption}>
              <View style={styles.sortOptionText}>
                <Text style={styles.sortLabel}>Sort by Roll Number</Text>
                <Text style={styles.sortHint}>
                  {sortByRoll ? 'Students will be arranged by roll number' : 'Students will be appended at the end'}
                </Text>
              </View>
              <Switch
                value={sortByRoll}
                onValueChange={handleSortToggle}
                trackColor={{ false: '#ddd', true: '#81b0ff' }}
                thumbColor={sortByRoll ? '#4A90D9' : '#f4f3f4'}
              />
            </View>

            <Text style={styles.label}>Join Date (applies to all {parsedStudents.length} students) *</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowJoinDatePicker(true)}>
              <Text style={styles.dateButtonText}>{formatDate(joinDate)}</Text>
            </TouchableOpacity>
            {showJoinDatePicker && (
              <DateTimePicker
                value={new Date(joinDate + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowJoinDatePicker(Platform.OS === 'ios');
                  if (date) setJoinDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
                }}
              />
            )}

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
```

- [ ] **Step 5: Add `label`/`dateButton`/`dateButtonText` styles**

Read `src/screens/BulkAddStudentsScreen.tsx`'s `StyleSheet.create` block first to check whether `label` already exists (it's used for "Paste Student Data:"). If `label` already exists, only add `dateButton`/`dateButtonText`; append this to the styles object:
```tsx
  dateButton: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 16,
  },
  dateButtonText: {
    fontSize: 16,
    color: '#333',
  },
```

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors remaining anywhere in the project (this is the last file touched by this plan).

- [ ] **Step 7: Manual UI smoke test**

Run `npm run web`, open a class, tap "Add Multiple Students", paste a few rows, tap Preview: confirm the "Join Date" field appears above the save button defaulted to today, change it to a past date, save, then open the class's student list / Edit Student for one of the newly added students and confirm its `joinDate` matches what was picked.

- [ ] **Step 8: Commit**

```bash
git add src/screens/BulkAddStudentsScreen.tsx
git commit -m "ui: add shared join date field to Bulk Add Students screen"
```

---

### Task 10: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 2: End-to-end manual smoke test**

Run `npm run web` and walk through:
1. Add a class, add 3 students on 3 different join dates (today, a week ago, a month ago).
2. Take attendance for 5 different dates spanning that whole range, marking a mix of present/absent.
3. Open Class Stats: confirm each student's `totalClasses`/percentage only reflects attendance dates on/after their own `joinDate`, and the class-level "Total Classes" stays the full 5.
4. Export to Excel (single class) and open the file (or inspect the generated HTML/XML string): confirm pre-join dates show `-` for the late-joining students, their name has a "(Joined: ...)" note, and their Total/% column is computed against their own reduced denominator.
5. Confirm a student whose `joinDate` matches the class's earliest attendance date shows no "(Joined: ...)" note.

- [ ] **Step 3: Report results to the user**

Summarize what was tested and any discrepancies found. Do not claim "done" without having actually run steps 1-2.
