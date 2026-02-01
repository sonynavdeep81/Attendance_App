# Student Attendance App - Documentation for Claude Code

## App Overview

A React Native mobile and web application for tracking student attendance across multiple classes. Teachers can manage classes, add students, take daily attendance, view statistics, and export attendance data to Excel files with multiple sheets.

**Key Purpose**: Simplify attendance tracking and identify students at risk of detention (attendance < 75%).

**Package**: `com.attendance.studentapp`
**EAS Project ID**: `1e0ea7b5-09f5-444c-869a-908c1a2c264b`

---

## Tech Stack

### Core Framework
- **React Native** 0.74.5
- **Expo SDK** ~51.0.0
- **TypeScript** ^5.1.3
- **React** 18.2.0

### Key Libraries
- **@react-navigation/native** ^6.1.17 - Navigation
- **@react-navigation/native-stack** ^6.9.26 - Stack navigation
- **@react-navigation/bottom-tabs** ^6.5.20 - Tab navigation
- **@react-native-async-storage/async-storage** 1.23.1 - Local data persistence
- **@react-native-community/datetimepicker** 8.0.1 - Date picker
- **expo-sharing** ~12.0.1 - File sharing on mobile
- **expo-file-system** - File operations (bundled with Expo)

### Platform Support
- Android (native build via EAS)
- iOS (not yet configured for build)
- Web (via react-native-web)

---

## Architecture

### Data Flow
1. **Storage Layer** ([src/utils/storage.ts](src/utils/storage.ts)) - All CRUD operations use AsyncStorage
2. **Screen Layer** ([src/screens/](src/screens/)) - UI components that consume storage functions
3. **Navigation Layer** ([App.tsx](App.tsx)) - Tab and stack navigation setup
4. **Types Layer** ([src/types/index.ts](src/types/index.ts)) - TypeScript interfaces

### Data Models

```typescript
// Class
interface Class {
  id: string;          // UUID
  name: string;        // e.g., "CSE6"
  subject?: string;    // Optional subject name
  createdAt: string;   // ISO timestamp
}

// Student
interface Student {
  id: string;          // UUID
  classId: string;     // Foreign key to Class
  name: string;
  rollNumber: string;
  createdAt: string;
}

// Attendance Record (one per class per date)
interface AttendanceRecord {
  id: string;
  classId: string;
  date: string;                // YYYY-MM-DD format
  absentStudentIds: string[];  // Array of student IDs who were absent
  createdAt: string;
}
```

### Storage Keys
- `@attendance_classes` - All classes
- `@attendance_students` - All students (across all classes)
- `@attendance_records` - All attendance records

---

## Key Features

### 1. Class Management
- **Create/Edit/Delete classes** with name and optional subject
- **View class statistics**: student count, total classes conducted
- **Class Details Screen** shows student list and attendance records

### 2. Student Management
- **Add students** to a class with name and roll number
- **Edit/Delete students** from class details
- **Automatic sorting** by roll number in exports

### 3. Attendance Tracking
- **Take attendance** by marking absent students (tap to toggle)
- **Date selection** for each attendance session
- **Validation**: Cannot take attendance for future dates or duplicate dates
- **Roll number display** with proper wrapping (fixed in recent update)

### 4. Statistics and Reporting
- **Per-class statistics**: total students, classes conducted, detained count
- **Per-student stats**: present/absent counts, attendance percentage, detention status
- **Visual indicators**: Red badges for detained students (< 75%)
- **Filter view**: Toggle between all students and detained-only

### 5. Export to Excel

#### Single Class Export
**Location**: ClassStatsScreen > Export button
**Features**:
- Exports one class to XLS file
- Filter options: All Students OR Detained Only
- Format: HTML table with Excel MIME type
- Filename: `{ClassName}_Attendance_{Detained}_{YYYY-MM-DD}.xls`

#### Multi-Class Export (All Classes)
**Location**: ClassesScreen > Header "Export All" button
**Features**:
- Exports ALL classes to a single multi-sheet XLS file
- Filter options: All Students OR Detained Only (applies to all sheets)
- **Format**: Excel XML Workbook with multiple worksheets
- Each class gets its own sheet/tab named after the class
- Sheet name sanitization: removes invalid chars `\ / ? * [ ]`, max 31 chars
- Handles duplicate class names by appending `_2`, `_3`, etc.
- **Filename**: `All_Classes_Attendance_{Detained}_{DD-MM-YYYY}.xls`

**Export Table Structure**:
```
Header: Class Name, Session, Subject, Total Classes
Columns: S No. | Roll No. | Name | [Dates as DD/MM] | Total | Attendance % | Status
Color Coding:
  - Present (P): Green (#137333)
  - Absent (A): Red (#c5221f)
  - Status OK: Green background (#e6f4ea)
  - Status DETAINED: Red background (#fce8e6)
```

**Platform-Specific Export**:
- **Web**: Creates Blob and triggers download via temporary `<a>` element
- **Mobile**: Saves to FileSystem.documentDirectory, then shares via Sharing API

---

## Critical Files

### [src/utils/storage.ts](src/utils/storage.ts)
**Purpose**: All data operations and export logic
**Key Functions**:
- `getClasses()`, `getClassById()`, `saveClass()`, `deleteClass()`
- `getStudentsByClass()`, `saveStudent()`, `deleteStudent()`
- `getAttendanceByClass()`, `saveAttendance()`, `deleteAttendance()`
- `calculateClassStats()` - Computes attendance percentages and detained count
- `exportClassAttendanceToCSV()` - Single class export (HTML table)
- **`exportAllClassesToXLS(filterDetainedOnly)`** - Multi-sheet workbook export
  - Uses Excel XML format with `<Workbook>` and `<Worksheet>` elements
  - Helper: `sanitizeSheetName()` - Ensures valid Excel sheet names
  - Helper: `generateClassAttendanceSheetFiltered()` - Creates sheet content with filtering
  - Helper: `escapeXML()` - Escapes XML special characters

**Lines of Interest**:
- Lines 462-879: Multi-sheet export implementation
- Lines 333-460: Single class export (HTML table)
- Lines 226-289: Statistics calculation logic

### [src/screens/ClassesScreen.tsx](src/screens/ClassesScreen.tsx)
**Purpose**: Main screen showing all classes
**Key Features**:
- FlatList of class cards with student/class counts
- FAB button to add new class
- **Header "Export All" button** (lines 126-140)
- Export handler with filter dialog (lines 92-118)
- Delete class with confirmation dialog

**Important Pattern**:
```typescript
// Export handler wrapped in useCallback to prevent stale closure
const handleExportAll = useCallback(() => {
  if (classes.length === 0) {
    Alert.alert('No Classes', 'There are no classes to export.');
    return;
  }
  // Show filter dialog
  Alert.alert('Export Attendance', 'Choose which students to export:', [
    { text: 'All Students', onPress: () => performExport(false) },
    { text: 'Detained Only', onPress: () => performExport(true) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}, [classes, performExport]);
```

### [src/screens/ClassDetailsScreen.tsx](src/screens/ClassDetailsScreen.tsx)
**Purpose**: Shows students in a class and attendance records
**Features**:
- Student list with roll numbers and names
- Attendance record list by date
- Edit/Delete students
- Navigate to Take Attendance or View Stats

### [src/screens/TakeAttendanceScreen.tsx](src/screens/TakeAttendanceScreen.tsx)
**Purpose**: Take attendance for a specific date
**UI Pattern**: Grid of student cards with tap-to-toggle absent/present
**Recent Fix**: Roll number wrapping issue (lines 178-184)

### [src/screens/ClassStatsScreen.tsx](src/screens/ClassStatsScreen.tsx)
**Purpose**: View statistics for a single class
**Features**:
- Summary boxes: Total students, classes conducted, detained count
- Filter button: Toggle between all students and detained only
- Export button: Export current class (respects filter)
- Student stats cards with color-coded detention status

### [src/types/index.ts](src/types/index.ts)
**Purpose**: TypeScript type definitions
**Key Types**: Class, Student, AttendanceRecord, StudentAttendanceStats, RootStackParamList

---

## Important Implementation Details

### 1. Excel XML Multi-Sheet Format

The multi-sheet export uses **Microsoft Excel XML Spreadsheet format**, not CSV:

```xml
<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <!-- Style definitions for Header, ColumnHeader, DataCell, Present, Absent, Detained, OK -->
  </Styles>

  <Worksheet ss:Name="CSE6">
    <Table>
      <!-- Attendance data for CSE6 -->
    </Table>
  </Worksheet>

  <Worksheet ss:Name="CSE5">
    <Table>
      <!-- Attendance data for CSE5 -->
    </Table>
  </Worksheet>
</Workbook>
```

**Why XML instead of CSV**: CSV cannot support multiple sheets in one file. Excel XML allows:
- Multiple worksheets with custom names
- Cell styling (colors, fonts, borders)
- Merged cells for headers
- Proper data types (Number vs String)

### 2. Detained Student Logic

**Rule**: Attendance < 75% = DETAINED

```typescript
const percentage = totalClasses > 0 ? ((totalPresent / totalClasses) * 100) : 100;
const isDetained = percentage < 75;
```

**Default**: If no attendance records exist, percentage = 100% (not detained)

### 3. React Hooks Patterns

**Critical Pattern**: Always use `useCallback` for handlers that reference state:

```typescript
// CORRECT - prevents stale closure
const handleExportAll = useCallback(() => {
  if (classes.length === 0) { /* ... */ }
}, [classes, performExport]);

// WRONG - would capture stale 'classes' value
const handleExportAll = () => {
  if (classes.length === 0) { /* ... */ }
};
```

**Why**: The header button is set via `navigation.setOptions()` in `useLayoutEffect`. Without `useCallback`, the button's `onPress` captures the initial empty `classes` array.

### 4. Date Handling

- **Storage format**: `YYYY-MM-DD` (ISO date strings)
- **Display format**: `DD/MM` in exports, full date in UI
- **Session detection**: Automatically determines academic year from date range
  ```typescript
  // If dates span July, use "July YYYY - June YYYY+1"
  // Otherwise use "Session YYYY-YYYY+1"
  ```

### 5. Platform-Specific Code

**Web Export**:
```typescript
const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel' });
const url = URL.createObjectURL(blob);
const link = document.createElement('a');
link.href = url;
link.download = filename;
link.click();
URL.revokeObjectURL(url);
```

**Mobile Export**:
```typescript
const fileUri = FileSystem.documentDirectory + filename;
await FileSystem.writeAsStringAsync(fileUri, xlsContent, {
  encoding: FileSystem.EncodingType.UTF8,
});
await Sharing.shareAsync(fileUri, {
  mimeType: 'application/vnd.ms-excel',
  dialogTitle: 'Save Attendance File',
  UTI: 'com.microsoft.excel.xls',
});
```

### 6. Sheet Name Sanitization

Excel sheet name restrictions:
- Cannot contain: `\ / ? * [ ]`
- Maximum 31 characters
- Must be unique within workbook

Implementation:
```typescript
const sanitizeSheetName = (name: string, usedNames: Set<string>) => {
  let sanitized = name.replace(/[\\\/\?\*\[\]]/g, '_');
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }
  // Handle duplicates
  let finalName = sanitized;
  let counter = 2;
  while (usedNames.has(finalName)) {
    const suffix = `_${counter}`;
    const maxLength = 31 - suffix.length;
    finalName = sanitized.substring(0, maxLength) + suffix;
    counter++;
  }
  usedNames.add(finalName);
  return finalName;
};
```

---

## Common Operations

### Add a New Class
1. Navigate to Classes tab
2. Tap FAB "+" button
3. Enter class name and optional subject
4. Save

### Take Attendance
1. Navigate to class details
2. Tap "Take Attendance"
3. Select date (defaults to today)
4. Tap students who are **absent** (toggles red)
5. Save

### Export All Classes
1. Navigate to "My Classes" screen
2. Tap "Export All" in header (top-right)
3. Choose "All Students" or "Detained Only"
4. File downloads (web) or share dialog appears (mobile)
5. Open in Excel or Google Sheets

### View Statistics
1. Navigate to class details
2. Tap "View Statistics"
3. See summary and per-student stats
4. Toggle "Show Detained Only" filter
5. Export single class if needed

---

## Development Setup

### Prerequisites
- Node.js (v16+)
- npm or yarn
- Expo CLI: `npm install -g expo-cli`
- EAS CLI (for builds): `npm install -g eas-cli`

### Installation
```bash
cd /home/navdeep/Attendance_App
npm install
```

### Run Development Server
```bash
# Start Expo dev server
npm start

# Run on Android
npm run android

# Run on iOS
npm run ios

# Run on Web
npm run web
```

### Build Android APK
```bash
# Build preview APK
npm run build:android

# Or using EAS CLI directly
eas build -p android --profile preview
```

**Note**: Requires EAS account and project setup (already configured).

### File Structure
```
Attendance_App/
├── src/
│   ├── screens/          # All screen components
│   ├── components/       # Reusable components (ConfirmDialog, etc.)
│   ├── utils/
│   │   └── storage.ts    # Data layer and export logic
│   └── types/
│       └── index.ts      # TypeScript types
├── assets/               # Icons and splash screens
├── App.tsx              # Entry point, navigation setup
├── app.json             # Expo configuration
├── package.json         # Dependencies
└── tsconfig.json        # TypeScript config
```

---

## Known Patterns and Quirks

### 1. Attendance Logic (Absent vs Present)
- **Storage**: Only stores IDs of **absent** students (space efficient)
- **Calculation**: `totalPresent = totalClasses - totalAbsent`
- **Default**: Students not in `absentStudentIds` array are considered present

### 2. ID Generation
All IDs use timestamp-based UUID: `Date.now().toString() + Math.random().toString(36)`

### 3. Async Storage Limitations
- All data stored as JSON strings
- No relational queries (must filter in-memory)
- Size limit: 6MB on Android, 10MB on iOS (unlikely to hit with attendance data)

### 4. Navigation State
- Uses `useFocusEffect` to reload data when screen comes into focus
- Ensures data stays fresh when navigating back from other screens

### 5. Color Scheme
- **Primary Blue**: `#4A90D9` (used in icons, buttons, links)
- **Green (Present/OK)**: `#137333` (text), `#e6f4ea` (background)
- **Red (Absent/Detained)**: `#c5221f` (text), `#fce8e6` (background)
- **Background**: `#f5f5f5` (light gray)

### 6. Recent Bug Fixes
- **Issue**: "No Classes to Export" error when classes exist
  - **Cause**: Stale closure in `handleExportAll` not wrapped in `useCallback`
  - **Fix**: Added `useCallback` with `[classes, performExport]` dependencies
  - **Location**: [src/screens/ClassesScreen.tsx:92-118](src/screens/ClassesScreen.tsx#L92-L118)

- **Issue**: Roll number text wrapping in Take Attendance screen
  - **Fix**: Added `numberOfLines={2}` and `ellipsizeMode="tail"` to roll number Text
  - **Location**: [src/screens/TakeAttendanceScreen.tsx:178-184](src/screens/TakeAttendanceScreen.tsx#L178-L184)

---

## Future Enhancement Ideas

1. **Import/Export full database** (already has `exportData`/`importData` functions)
2. **Class archiving** (hide old classes without deleting)
3. **Bulk student import** via CSV
4. **Authentication** (multi-teacher support)
5. **Cloud sync** (Firebase or similar)
6. **Push notifications** for low attendance
7. **PDF export** in addition to XLS

---

## Testing and Verification

### Manual Testing Checklist

**Export All Classes**:
1. Create 2-3 classes with students
2. Take attendance for multiple dates
3. Navigate to "My Classes"
4. Tap "Export All" button
5. Choose "All Students"
6. Verify file downloads with format: `All_Classes_Attendance_DD-MM-YYYY.xls`
7. Open in Excel/Google Sheets
8. Verify:
   - Multiple sheets exist (tabs at bottom)
   - Each sheet is named after class (not "Sheet1")
   - Each sheet contains correct attendance data
   - Colors and formatting are correct
9. Repeat with "Detained Only" filter
10. Verify filename includes "_Detained" suffix
11. Verify only students with < 75% attendance appear

**Edge Cases**:
- Export with no classes (should show alert)
- Export with classes that have no attendance
- Export with duplicate class names
- Export with class names containing special characters

---

## Troubleshooting

### Export shows "No Classes to Export"
- **Cause**: Handler not wrapped in `useCallback`
- **Fix**: Ensure export handlers use `useCallback` with state dependencies

### Sheet names appear as "Sheet1", "Sheet2"
- **Check**: Using `exportClassAttendanceToCSV` instead of `exportAllClassesToXLS`
- **Fix**: Multi-sheet export requires `exportAllClassesToXLS` function

### Excel file won't open
- **Check**: File extension is `.xls` (not `.xlsx` or `.csv`)
- **Check**: MIME type is `application/vnd.ms-excel`
- **Try**: Open in Google Sheets instead (upload to Drive first)

### Colors not showing in Excel
- **Likely**: Opening in Numbers (Mac) - use Excel or Google Sheets
- **Alternative**: Colors are defined via XML styles, should work in Excel 2007+

---

## Contact and Maintenance

**Developer**: Navdeep
**Project Path**: `/home/navdeep/Attendance_App`
**Last Updated**: February 2026
**Claude Code Version**: This documentation was created for Claude Code to use as context for future updates.

---

## Quick Reference Commands

```bash
# Development
npm start                    # Start dev server
npm run android             # Run on Android
npm run web                 # Run on web browser

# Building
npm run build:android       # Build Android APK (EAS)
eas build -p android        # Alternative build command

# Dependencies
npm install                 # Install packages
npm update                  # Update packages

# Expo
npx expo prebuild --clean   # Regenerate native folders
```

---

**Note to Claude Code**: This app is fully functional. All requested features have been implemented and tested. When making future changes, pay special attention to:
1. React hooks patterns (always use `useCallback` for event handlers that reference state)
2. Excel XML format for multi-sheet exports
3. Platform-specific export logic (web vs mobile)
4. Detained student calculation (< 75% threshold)
