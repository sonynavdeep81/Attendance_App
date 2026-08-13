import AsyncStorage from '@react-native-async-storage/async-storage';
import { Class, Student, AttendanceRecord } from '../types';
import { generateId, getClasses, getStudents, getAttendanceRecords } from './storage';

/**
 * Parse the "All Students" multi-sheet Excel XML export and import
 * classes, students, and attendance records into the app.
 *
 * XML structure per worksheet:
 *   Row 1: "Attendance  ClassName"
 *   Row 2: session (e.g. "Aug - Dec 2024")
 *   Row 3: subject (optional, absent if no subject)
 *   Row 4: "Total Classes: N"
 *   Row 5: empty
 *   Row 6: S No. | Roll No. | Name | DD/MM | DD/MM | ... | Total | Attendance % | Status
 *   Rows 7+: data with P/A marks
 */

const STORAGE_KEYS = {
  CLASSES: 'attendance_classes',
  STUDENTS: 'attendance_students',
  ATTENDANCE: 'attendance_records',
};

/**
 * Extract all text values from <Data ...>...</Data> tags in a <Row>
 */
const extractRowData = (rowXml: string): string[] => {
  const values: string[] = [];
  const cellRegex = /<Cell[^>]*>[\s\S]*?<Data[^>]*>([\s\S]*?)<\/Data>[\s\S]*?<\/Cell>/g;
  let match;
  while ((match = cellRegex.exec(rowXml)) !== null) {
    values.push(unescapeXML(match[1].trim()));
  }
  return values;
};

const unescapeXML = (str: string): string => {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

/**
 * Parse year(s) from session string like "Aug - Dec 2024" or "Jan - May 2025"
 */
const parseSessionYears = (session: string): { startMonth: string; endMonth: string; year: number; startYear?: number } => {
  // Patterns: "Aug - Dec 2024", "Jan - May 2025", "Aug 2024 - Jan 2025"
  const match1 = session.match(/(\w+)\s*-\s*(\w+)\s+(\d{4})/);
  const match2 = session.match(/(\w+)\s+(\d{4})\s*-\s*(\w+)\s+(\d{4})/);

  if (match2) {
    return { startMonth: match2[1], endMonth: match2[3], year: parseInt(match2[4]), startYear: parseInt(match2[2]) };
  }
  if (match1) {
    return { startMonth: match1[1], endMonth: match1[2], year: parseInt(match1[3]) };
  }
  // Fallback: use current year
  return { startMonth: 'Jan', endMonth: 'Dec', year: new Date().getFullYear() };
};

const monthNameToNumber: { [key: string]: number } = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Convert DD/MM date column header to YYYY-MM-DD using session context.
 */
const resolveDate = (ddmm: string, sessionInfo: { startMonth: string; endMonth: string; year: number; startYear?: number }): string => {
  const parts = ddmm.split('/');
  if (parts.length !== 2) return '';

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  const startMonthNum = monthNameToNumber[sessionInfo.startMonth.toLowerCase()] || 1;
  const year = sessionInfo.year;
  const startYear = sessionInfo.startYear || year;

  // If session spans two years (e.g. Aug 2024 - Jan 2025)
  // months >= startMonth belong to startYear, others to year
  let resolvedYear: number;
  if (startYear !== year) {
    resolvedYear = month >= startMonthNum ? startYear : year;
  } else {
    resolvedYear = year;
  }

  return `${resolvedYear}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

export interface ImportResult {
  classesImported: number;
  studentsImported: number;
  attendanceRecordsImported: number;
  skippedClasses: string[];
}

/**
 * Import attendance data from the "All Students" multi-sheet Excel XML export.
 */
export const importFromXLS = async (xmlContent: string): Promise<ImportResult> => {
  const result: ImportResult = {
    classesImported: 0,
    studentsImported: 0,
    attendanceRecordsImported: 0,
    skippedClasses: [],
  };

  // Load existing data
  const existingClasses = await getClasses();
  const existingStudents = await getStudents();
  const existingAttendance = await getAttendanceRecords();

  const newClasses: Class[] = [...existingClasses];
  const newStudents: Student[] = [...existingStudents];
  const newAttendance: AttendanceRecord[] = [...existingAttendance];

  // Extract all worksheets
  const worksheetRegex = /<Worksheet\s+ss:Name="([^"]*)">([\s\S]*?)<\/Worksheet>/g;
  let wsMatch;

  while ((wsMatch = worksheetRegex.exec(xmlContent)) !== null) {
    const sheetName = unescapeXML(wsMatch[1]);
    const sheetContent = wsMatch[2];

    // Extract all rows
    const rows: string[] = [];
    const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
    let rowMatch;
    while ((rowMatch = rowRegex.exec(sheetContent)) !== null) {
      rows.push(rowMatch[0]);
    }

    if (rows.length < 6) {
      result.skippedClasses.push(sheetName);
      continue;
    }

    // Parse header rows
    const row1Data = extractRowData(rows[0]); // "Attendance  ClassName"
    const row2Data = extractRowData(rows[1]); // session

    if (row1Data.length === 0 || row2Data.length === 0) {
      result.skippedClasses.push(sheetName);
      continue;
    }

    // Extract class name from "Attendance  ClassName"
    const classNameMatch = row1Data[0].replace(/^Attendance\s+/, '').trim();
    const className = classNameMatch || sheetName;

    const session = row2Data[0];
    const sessionInfo = parseSessionYears(session);

    // Determine if row 3 is subject or "Total Classes"
    let subject = '';
    let headerRowIndex = -1;

    for (let i = 2; i < rows.length; i++) {
      const data = extractRowData(rows[i]);
      if (data.length === 0) continue; // empty row

      if (data[0].startsWith('Total Classes:')) {
        // Next non-empty row after this is the column header
        for (let j = i + 1; j < rows.length; j++) {
          const hData = extractRowData(rows[j]);
          if (hData.length > 0 && hData[0] === 'S No.') {
            headerRowIndex = j;
            break;
          }
        }
        break;
      } else if (!data[0].startsWith('Attendance') && data[0] !== session) {
        // This is the subject row
        subject = data[0];
      }
    }

    if (headerRowIndex === -1) {
      result.skippedClasses.push(sheetName);
      continue;
    }

    // Parse column headers to get date columns
    const headerData = extractRowData(rows[headerRowIndex]);
    // headerData: [S No., Roll No., Name, DD/MM, DD/MM, ..., Total, Attendance %, Status]

    const dateColumns: string[] = []; // YYYY-MM-DD dates
    for (let i = 3; i < headerData.length; i++) {
      const val = headerData[i];
      if (val === 'Total') break;
      if (/^\d{2}\/\d{2}$/.test(val)) {
        const resolved = resolveDate(val, sessionInfo);
        if (resolved) dateColumns.push(resolved);
      }
    }

    if (dateColumns.length === 0) {
      result.skippedClasses.push(sheetName);
      continue;
    }

    // Check if class already exists (by name)
    let classObj = newClasses.find(c => c.name === className);
    let classIsNew = false;
    if (!classObj) {
      classObj = {
        id: generateId(),
        name: className,
        subject: subject || undefined,
        createdAt: new Date().toISOString(),
      };
      newClasses.push(classObj);
      classIsNew = true;
      result.classesImported++;
    }
    const classId = classObj.id;

    // Parse student data rows
    const studentMap: Map<string, string> = new Map(); // rollNumber -> studentId

    for (let i = headerRowIndex + 1; i < rows.length; i++) {
      const data = extractRowData(rows[i]);
      if (data.length < 4) continue;

      // data: [srNo, rollNo, name, P/A, P/A, ..., total, %, status]
      const rollNumber = data[1];
      const name = data[2];

      if (!rollNumber || !name) continue;

      // Check if student already exists in this class
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
      studentMap.set(rollNumber, student.id);

      // Parse attendance P/A values starting at index 3
      for (let d = 0; d < dateColumns.length; d++) {
        const cellIndex = 3 + d;
        if (cellIndex >= data.length) break;
        const val = data[cellIndex];
        if (val === 'A') {
          // Mark absent for this date
          const date = dateColumns[d];
          let record = newAttendance.find(r => r.classId === classId && r.date === date);
          if (!record) {
            record = {
              id: generateId(),
              classId,
              date,
              absentStudentIds: [],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
            newAttendance.push(record);
          }
          if (!record.absentStudentIds.includes(student.id)) {
            record.absentStudentIds.push(student.id);
          }
        }
      }
    }

    // Ensure attendance records exist for all dates (even if all present)
    for (const date of dateColumns) {
      const exists = newAttendance.find(r => r.classId === classId && r.date === date);
      if (!exists) {
        newAttendance.push({
          id: generateId(),
          classId,
          date,
          absentStudentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    result.attendanceRecordsImported += dateColumns.length;
  }

  // Save all data
  await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(newClasses));
  await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(newStudents));
  await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(newAttendance));

  return result;
};
