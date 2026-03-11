# Student Attendance App - Claude Code Context

## App Overview
React Native + Expo app for tracking student attendance. Teachers manage classes, take daily attendance, view statistics, and export to Excel.

**Key Rule**: Students with attendance < 75% are DETAINED.
**Package**: `com.attendance.studentapp`
**Project Path**: `/home/navdeep/Attendance_App`

---

## Tech Stack
- React Native 0.74.5, Expo SDK ~51.0.0, TypeScript ^5.1.3
- Navigation: `@react-navigation/native`, `native-stack`, `bottom-tabs`
- Storage: `@react-native-async-storage/async-storage`
- Export: `expo-file-system`, `expo-sharing`
- Platforms: Android (EAS builds), Web (react-native-web)

---

## Architecture & Data Flow
1. **Storage Layer** (`src/utils/storage.ts`) — All CRUD + export logic
2. **Screen Layer** (`src/screens/`) — UI consuming storage functions
3. **Navigation** (`App.tsx`) — Tab + stack navigation
4. **Types** (`src/types/index.ts`) — TypeScript interfaces

### Storage Keys
- `@attendance_classes` — All classes
- `@attendance_students` — All students
- `@attendance_records` — All attendance records

### Core Data Models
```typescript
interface Class { id: string; name: string; subject?: string; createdAt: string; }
interface Student { id: string; classId: string; name: string; rollNumber: string; createdAt: string; }
interface AttendanceRecord { id: string; classId: string; date: string; absentStudentIds: string[]; createdAt: string; }
```
**Note**: Only absent student IDs are stored. Present = not in `absentStudentIds`.

---

## Critical Files

| File | Purpose |
|------|---------|
| `src/utils/storage.ts` | All data operations and export logic (lines 226-879) |
| `src/screens/ClassesScreen.tsx` | Main classes list + Export All button |
| `src/screens/ClassDetailsScreen.tsx` | Students list + attendance records per class |
| `src/screens/TakeAttendanceScreen.tsx` | Tap-to-toggle attendance grid |
| `src/screens/ClassStatsScreen.tsx` | Per-student stats + single class export |
| `src/types/index.ts` | All TypeScript type definitions |

### Key Functions in storage.ts
- `getClasses()`, `saveClass()`, `deleteClass()`, `getClassById()`
- `getStudentsByClass()`, `saveStudent()`, `deleteStudent()`
- `getAttendanceByClass()`, `saveAttendance()`, `deleteAttendance()`
- `calculateClassStats()` — computes percentages and detained count
- `exportClassAttendanceToCSV()` — single class HTML table export
- `exportAllClassesToXLS(filterDetainedOnly)` — multi-sheet Excel XML export

---

## Important Implementation Details

### 1. Detained Logic
```typescript
const percentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100) : 100;
const isDetained = percentage < 75;
// Default: no records = 100% (not detained)
```

### 2. React Hooks — Critical Pattern
Always use `useCallback` for handlers referencing state. Header buttons set via `navigation.setOptions()` in `useLayoutEffect` will capture stale state without it.
```typescript
// CORRECT
const handleExportAll = useCallback(() => { ... }, [classes, performExport]);
// WRONG — captures stale 'classes' on mount
const handleExportAll = () => { ... };
```

### 3. Multi-Sheet Excel Export
Uses **Microsoft Excel XML format** (not CSV) — supports multiple sheets, cell colors, and merged headers.
- Single class: HTML table with Excel MIME type → `.xls`
- All classes: XML Workbook with one `<Worksheet>` per class → `.xls`
- Sheet names: max 31 chars, no `\ / ? * [ ]`, duplicates get `_2`, `_3` suffix

### 4. Platform-Specific Export
- **Web**: Blob → `<a>` element download
- **Mobile**: `FileSystem.writeAsStringAsync` → `Sharing.shareAsync`

### 5. Export Filenames
- Single: `{ClassName}_Attendance_{Detained}_{YYYY-MM-DD}.xls`
- All classes: `All_Classes_Attendance_{Detained}_{DD-MM-YYYY}.xls`

### 6. Color Scheme
- Primary Blue: `#4A90D9` | Present/OK: `#137333` / `#e6f4ea` | Absent/Detained: `#c5221f` / `#fce8e6`

### 7. Navigation State
Uses `useFocusEffect` to reload data when screen comes into focus.

### 8. ID Generation
`Date.now().toString() + Math.random().toString(36)`

---

## Known Issues & Quirks

| Issue | Cause | Fix |
|-------|-------|-----|
| "No Classes to Export" despite classes existing | Stale closure in handler | Wrap in `useCallback` with `[classes, performExport]` deps |
| Sheet names show as "Sheet1" | Wrong export function used | Use `exportAllClassesToXLS`, not `exportClassAttendanceToCSV` |
| Excel file won't open | Wrong MIME or extension | Use `.xls` + `application/vnd.ms-excel` |
| Colors missing | Opened in Numbers (Mac) | Use Excel 2007+ or Google Sheets |
| Roll number wrapping | Text overflow | `numberOfLines={2}` + `ellipsizeMode="tail"` in TakeAttendanceScreen:178-184 |

---

## Development Commands

```bash
# Run
npm start              # Expo dev server
npm run android        # Android
npm run web            # Browser

# Build
npm run build:android  # EAS Android APK
eas build -p android   # Alternative

# Validate (run after every change)
npx tsc --noEmit       # TypeScript check — fix all errors before finishing
```

## Build/Validation Flow
After every code change, run `npx tsc --noEmit` and fix all TypeScript errors before considering the task complete.

---

## Things to Always Remember
1. Use `useCallback` for all event handlers that reference state
2. Multi-sheet export requires XML Workbook format — never use CSV for this
3. Check platform (web vs mobile) before writing export logic
4. Detained threshold is strictly `< 75%`
