# Batch Join Date Assignment

## Problem

After adding the per-student join date feature, teachers who already bulk-added a roster (all defaulted to the same day) need to correct join dates for groups of students who actually joined together on a different date. Editing one student at a time via Edit Student is tedious for this cleanup.

## Goal

Let a teacher select multiple existing students in a class and assign them all the same join date in one action, reusing the class's existing selection-mode UI (already used for bulk delete).

## Data Model

No changes. Uses the existing `Student.joinDate` field.

## Storage Layer (`src/utils/storage.ts`)

New function:
```ts
export const updateStudentsJoinDate = async (studentIds: string[], joinDate: string): Promise<void> => {
  const students = await getStudents();
  const idSet = new Set(studentIds);
  const updated = students.map((s) => (idSet.has(s.id) ? { ...s, joinDate } : s));
  await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(updated));
};
```
Only touches `joinDate`; `name`/`rollNumber`/`createdAt`/`classId` are untouched.

## UI (`src/screens/ClassDetailsScreen.tsx`)

- Add `joinDate`/`showJoinDatePicker` state (same `DateTimePicker` pattern used in `AddEditStudentScreen.tsx`/`ClassScheduleScreen.tsx`).
- In the existing selection-mode toolbar (next to "🗑️ Delete Selected", same `selectedStudents.size > 0` visibility gate), add a "📅 Set Join Date (N)" button.
- Tapping it opens a small confirmation modal (reuse the existing `Modal` pattern already used elsewhere in this codebase, e.g. `ClassScheduleScreen.tsx`) with a date button + `DateTimePicker` and Cancel/Apply buttons.
- Apply calls `updateStudentsJoinDate(Array.from(selectedStudents), joinDate)`, then reloads the student list and exits selection mode (mirrors `deleteSelectedStudents`'s existing cleanup flow).

## Out of Scope

- Per-student different dates in one batch action (that's the single/bulk-add pickers, already built).
- Any change to `addStudent`/`updateStudent`/export logic (unaffected — they already read `joinDate` off the `Student` record).
