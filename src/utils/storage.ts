import AsyncStorage from '@react-native-async-storage/async-storage';
import { Class, Student, AttendanceRecord, StudentAttendanceStats, ClassAttendanceStats } from '../types';

const STORAGE_KEYS = {
  CLASSES: 'attendance_classes',
  STUDENTS: 'attendance_students',
  ATTENDANCE: 'attendance_records',
  SORT_PREFERENCE: 'attendance_sort_preference',
};

// Helper function to generate unique IDs
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Helper function to get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

// Format date for display
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// ============ CLASS OPERATIONS ============

export const getClasses = async (): Promise<Class[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CLASSES);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting classes:', error);
    return [];
  }
};

export const addClass = async (name: string, subject?: string): Promise<Class> => {
  const classes = await getClasses();
  const newClass: Class = {
    id: generateId(),
    name,
    subject,
    createdAt: new Date().toISOString(),
  };
  classes.push(newClass);
  await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  return newClass;
};

export const updateClass = async (id: string, name: string, subject?: string): Promise<void> => {
  const classes = await getClasses();
  const index = classes.findIndex((c) => c.id === id);
  if (index !== -1) {
    classes[index] = { ...classes[index], name, subject };
    await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  }
};

export const deleteClass = async (id: string): Promise<void> => {
  // Delete class
  const classes = await getClasses();
  const filteredClasses = classes.filter((c) => c.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(filteredClasses));

  // Delete associated students
  const students = await getStudents();
  const filteredStudents = students.filter((s) => s.classId !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(filteredStudents));

  // Delete associated attendance records
  const attendance = await getAttendanceRecords();
  const filteredAttendance = attendance.filter((a) => a.classId !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(filteredAttendance));
};

export const getClassById = async (id: string): Promise<Class | undefined> => {
  const classes = await getClasses();
  return classes.find((c) => c.id === id);
};

// ============ STUDENT OPERATIONS ============

export const getStudents = async (): Promise<Student[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.STUDENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting students:', error);
    return [];
  }
};

export const getStudentsByClass = async (classId: string, sortByRoll?: boolean): Promise<Student[]> => {
  const students = await getStudents();
  const classStudents = students.filter((s) => s.classId === classId);
  
  // If sortByRoll is explicitly passed, use that; otherwise check preference
  let shouldSort = sortByRoll;
  if (shouldSort === undefined) {
    shouldSort = await getSortPreference();
  }
  
  if (shouldSort) {
    return classStudents.sort((a, b) => a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true }));
  }
  
  // Return in the order they were added (by createdAt timestamp)
  return classStudents.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

export const getSortPreference = async (): Promise<boolean> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SORT_PREFERENCE);
    return data === 'true';
  } catch (error) {
    return false;
  }
};

export const setSortPreference = async (sortByRoll: boolean): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.SORT_PREFERENCE, sortByRoll.toString());
};

export const sortStudentsByRollNumber = (students: Student[]): Student[] => {
  return [...students].sort((a, b) => 
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
  );
};

export const addStudent = async (classId: string, name: string, rollNumber: string, sortByRoll?: boolean): Promise<Student> => {
  const students = await getStudents();
  const newStudent: Student = {
    id: generateId(),
    classId,
    name,
    rollNumber,
    createdAt: new Date().toISOString(),
  };
  students.push(newStudent);
  
  // If sortByRoll is true, sort all students of this class by roll number
  if (sortByRoll) {
    const otherStudents = students.filter(s => s.classId !== classId);
    const classStudents = students.filter(s => s.classId === classId);
    const sortedClassStudents = sortStudentsByRollNumber(classStudents);
    await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify([...otherStudents, ...sortedClassStudents]));
  } else {
    await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }
  return newStudent;
};

export const updateStudent = async (id: string, name: string, rollNumber: string): Promise<void> => {
  const students = await getStudents();
  const index = students.findIndex((s) => s.id === id);
  if (index !== -1) {
    students[index] = { ...students[index], name, rollNumber };
    await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(students));
  }
};

export const deleteStudent = async (id: string): Promise<void> => {
  const students = await getStudents();
  const filteredStudents = students.filter((s) => s.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(filteredStudents));

  // Remove student from attendance records
  const attendance = await getAttendanceRecords();
  const updatedAttendance = attendance.map((record) => ({
    ...record,
    absentStudentIds: record.absentStudentIds.filter((sId) => sId !== id),
  }));
  await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(updatedAttendance));
};

export const getStudentById = async (id: string): Promise<Student | undefined> => {
  const students = await getStudents();
  return students.find((s) => s.id === id);
};

// ============ ATTENDANCE OPERATIONS ============

export const getAttendanceRecords = async (): Promise<AttendanceRecord[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting attendance records:', error);
    return [];
  }
};

export const getAttendanceByClass = async (classId: string): Promise<AttendanceRecord[]> => {
  const records = await getAttendanceRecords();
  return records
    .filter((r) => r.classId === classId)
    .sort((a, b) => b.date.localeCompare(a.date)); // Sort by date descending
};

export const getAttendanceByDate = async (classId: string, date: string): Promise<AttendanceRecord | undefined> => {
  const records = await getAttendanceRecords();
  return records.find((r) => r.classId === classId && r.date === date);
};

export const saveAttendance = async (
  classId: string,
  date: string,
  absentStudentIds: string[]
): Promise<AttendanceRecord> => {
  const records = await getAttendanceRecords();
  const existingIndex = records.findIndex((r) => r.classId === classId && r.date === date);

  if (existingIndex !== -1) {
    // Update existing record
    records[existingIndex] = {
      ...records[existingIndex],
      absentStudentIds,
      updatedAt: new Date().toISOString(),
    };
  } else {
    // Create new record
    const newRecord: AttendanceRecord = {
      id: generateId(),
      classId,
      date,
      absentStudentIds,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    records.push(newRecord);
  }

  await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  return records.find((r) => r.classId === classId && r.date === date)!;
};

export const deleteAttendanceRecord = async (classId: string, date: string): Promise<void> => {
  const records = await getAttendanceRecords();
  const filteredRecords = records.filter((r) => !(r.classId === classId && r.date === date));
  await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(filteredRecords));
};

// ============ STATISTICS CALCULATIONS ============

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

export const calculateClassStats = async (classId: string): Promise<ClassAttendanceStats | null> => {
  const classInfo = await getClassById(classId);
  if (!classInfo) return null;

  const studentStats = await calculateStudentStats(classId);
  const attendanceRecords = await getAttendanceByClass(classId);

  return {
    classId,
    className: classInfo.name,
    totalStudents: studentStats.length,
    totalClassesConducted: attendanceRecords.length,
    studentStats,
    detainedCount: studentStats.filter((s) => s.isDetained).length,
  };
};

// ============ EXPORT TO CSV ============

const getSessionFromDates = (dates: string[]): string => {
  if (dates.length === 0) return '';
  
  // Get first and last date
  const sortedDates = [...dates].sort();
  const firstDate = new Date(sortedDates[0]);
  const lastDate = new Date(sortedDates[sortedDates.length - 1]);
  
  const firstMonth = firstDate.getMonth(); // 0-11
  const lastMonth = lastDate.getMonth();
  const year = lastDate.getFullYear();
  
  // Determine session based on months
  // Jan-May session (months 0-4) or Aug-Dec session (months 7-11)
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  // Check if dates span Jan-May or Aug-Dec
  if (firstMonth >= 0 && lastMonth <= 4) {
    // Jan-May session
    return `Jan - May ${year}`;
  } else if (firstMonth >= 7 && lastMonth <= 11) {
    // Aug-Dec session
    return `Aug - Dec ${year}`;
  } else if (firstMonth >= 6 && lastMonth <= 11) {
    // July-Dec (some institutions start in July)
    return `${monthNames[firstMonth]} - Dec ${year}`;
  } else {
    // Custom range
    const startYear = firstDate.getFullYear();
    if (startYear !== year) {
      return `${monthNames[firstMonth]} ${startYear} - ${monthNames[lastMonth]} ${year}`;
    }
    return `${monthNames[firstMonth]} - ${monthNames[lastMonth]} ${year}`;
  }
};

export const exportClassAttendanceToCSV = async (
  classId: string,
  filterDetainedOnly?: boolean
): Promise<{ csv: string; filename: string }> => {
  const classInfo = await getClassById(classId);
  let students = await getStudentsByClass(classId, true); // Always sort by roll for export
  const attendanceRecords = await getAttendanceByClass(classId);

  // Sort attendance records by date
  const sortedRecords = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sortedRecords.map(r => r.date);
  const totalClasses = dates.length;

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
  
  const className = classInfo?.name || 'Class';
  const subject = classInfo?.subject || '';
  const session = getSessionFromDates(dates);
  
  // Calculate total columns for centering effect
  const totalDataColumns = 3 + dates.length + 3; // S.No, Roll, Name, dates..., Total, %, Status
  
  // Create header rows (spanning effect by leaving other cells empty)
  const createCenteredRow = (text: string): string[] => {
    const row = new Array(totalDataColumns).fill('');
    row[0] = text;
    return row;
  };
  
  // Header rows
  const titleRow = createCenteredRow(`Attendance  ${className}`);
  const sessionRow = createCenteredRow(session);
  const subjectRow = createCenteredRow(subject);
  const totalClassesRow = createCenteredRow(`Total Classes: ${totalClasses}`);
  
  // Create column header row
  const headers = ['S No.', 'Roll No.', 'Name'];
  dates.forEach(date => {
    // Format date as DD/MM for compactness
    const d = new Date(date);
    headers.push(`${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`);
  });
  headers.push('Total', 'Attendance %', 'Status');
  
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
  
  // Generate HTML table with .xls extension (Excel/Sheets compatible)
  const totalCols = headers.length;
  
  const xlsContent = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head>
<meta charset="UTF-8">
<style>
  td { mso-number-format:\\@; }
</style>
</head>
<body>
<table>
  <tr><td colspan="${totalCols}" style="font-family: Times New Roman; font-size: 16pt; font-weight: bold; color: #1a73e8;">Attendance  ${className}</td></tr>
  <tr><td colspan="${totalCols}" style="font-family: Times New Roman; font-size: 16pt; font-weight: bold; color: #1a73e8;">${session}</td></tr>
  <tr><td colspan="${totalCols}" style="font-family: Times New Roman; font-size: 16pt; font-weight: bold; color: #1a73e8;">${subject}</td></tr>
  <tr><td colspan="${totalCols}" style="font-family: Times New Roman; font-size: 16pt; font-weight: bold; color: #1a73e8;">Total Classes: ${totalClasses}</td></tr>
  <tr><td colspan="${totalCols}"></td></tr>
  <tr>${headers.map(h => `<td style="font-family: Times New Roman; font-weight: bold; background-color: #e8f0fe; border: 1px solid #000;">${h}</td>`).join('')}</tr>
  ${rows.map(row => {
    const status = row[row.length - 1];
    return `<tr>${row.map((cell, i) => {
      let style = "font-family: Times New Roman; border: 1px solid #000;";
      if (i === row.length - 1) {
        if (status === 'DETAINED') {
          style += ' background-color: #fce8e6; color: #c5221f; font-weight: bold;';
        } else {
          style += ' background-color: #e6f4ea; color: #137333;';
        }
      } else if (i > 2 && i < row.length - 3) {
        if (cell === 'A') {
          style += ' color: #c5221f;';
        } else {
          style += ' color: #137333;';
        }
      }
      return `<td style="${style}">${cell}</td>`;
    }).join('')}</tr>`;
  }).join('\n  ')}
</table>
</body>
</html>`;

  const filenameSuffix = filterDetainedOnly ? '_Detained' : '';
  const filename = `${className.replace(/[^a-zA-Z0-9]/g, '_')}_Attendance${filenameSuffix}_${new Date().toISOString().split('T')[0]}.xls`;

  return { csv: xlsContent, filename };
};

// ============ MULTI-SHEET EXPORT ============

/**
 * Sanitize class name to be used as Excel sheet name
 * Excel sheet names:
 * - Cannot contain: \ / ? * [ ]
 * - Maximum length: 31 characters
 */
const sanitizeSheetName = (name: string, usedNames: Set<string> = new Set()): string => {
  // Remove invalid characters
  let sanitized = name.replace(/[\\\/\?\*\[\]]/g, '_');

  // Truncate to 31 characters
  if (sanitized.length > 31) {
    sanitized = sanitized.substring(0, 31);
  }

  // Handle duplicates by appending number
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

/**
 * Generate attendance table content for a single class (for multi-sheet export)
 * Returns Excel XML Table element
 */
const generateClassAttendanceSheet = async (classId: string): Promise<string> => {
  const classInfo = await getClassById(classId);
  const students = await getStudentsByClass(classId, true); // Sort by roll
  const attendanceRecords = await getAttendanceByClass(classId);

  // If no attendance records, create a simple message
  if (attendanceRecords.length === 0) {
    const className = classInfo?.name || 'Class';
    return `    <Table>
      <Row>
        <Cell><Data ss:Type="String">${className}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">No attendance records found.</Data></Cell>
      </Row>
    </Table>`;
  }

  // Sort attendance records by date
  const sortedRecords = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sortedRecords.map(r => r.date);
  const totalClasses = dates.length;

  const className = classInfo?.name || 'Class';
  const subject = classInfo?.subject || '';
  const session = getSessionFromDates(dates);

  // Build XML table
  let tableXML = '    <Table>\n';

  // Header rows
  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">Attendance  ${className}</Data>
        </Cell>
      </Row>\n`;

  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">${session}</Data>
        </Cell>
      </Row>\n`;

  if (subject) {
    tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">${subject}</Data>
        </Cell>
      </Row>\n`;
  }

  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">Total Classes: ${totalClasses}</Data>
        </Cell>
      </Row>\n`;

  // Empty row
  tableXML += `      <Row></Row>\n`;

  // Column headers
  tableXML += '      <Row>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">S No.</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Roll No.</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Name</Data></Cell>\n';

  dates.forEach(date => {
    const d = new Date(date);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    tableXML += `        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">${dateStr}</Data></Cell>\n`;
  });

  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Total</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Attendance %</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Status</Data></Cell>\n';
  tableXML += '      </Row>\n';

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

  tableXML += '    </Table>';

  return tableXML;
};

/**
 * Helper to escape XML special characters
 */
const escapeXML = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Generate attendance table for a single class (with optional filtering)
 * @param classId - The class ID
 * @param filterDetainedOnly - If true, only include detained students
 */
const generateClassAttendanceSheetFiltered = async (classId: string, filterDetainedOnly: boolean): Promise<string> => {
  const classInfo = await getClassById(classId);
  let students = await getStudentsByClass(classId, true); // Sort by roll
  const attendanceRecords = await getAttendanceByClass(classId);

  // If no attendance records, create a simple message
  if (attendanceRecords.length === 0) {
    const className = classInfo?.name || 'Class';
    return `    <Table>
      <Row>
        <Cell><Data ss:Type="String">${className}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">No attendance records found.</Data></Cell>
      </Row>
    </Table>`;
  }

  // Sort attendance records by date
  const sortedRecords = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sortedRecords.map(r => r.date);
  const totalClasses = dates.length;

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

  // If no students after filtering, show message
  if (students.length === 0) {
    const className = classInfo?.name || 'Class';
    return `    <Table>
      <Row>
        <Cell><Data ss:Type="String">${className}</Data></Cell>
      </Row>
      <Row>
        <Cell><Data ss:Type="String">No detained students in this class.</Data></Cell>
      </Row>
    </Table>`;
  }

  const className = classInfo?.name || 'Class';
  const subject = classInfo?.subject || '';
  const session = getSessionFromDates(dates);

  // Build XML table
  let tableXML = '    <Table>\n';

  // Header rows
  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">Attendance  ${className}</Data>
        </Cell>
      </Row>\n`;

  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">${session}</Data>
        </Cell>
      </Row>\n`;

  if (subject) {
    tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">${subject}</Data>
        </Cell>
      </Row>\n`;
  }

  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">Total Classes: ${totalClasses}</Data>
        </Cell>
      </Row>\n`;

  // Empty row
  tableXML += `      <Row></Row>\n`;

  // Column headers
  tableXML += '      <Row>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">S No.</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Roll No.</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Name</Data></Cell>\n';

  dates.forEach(date => {
    const d = new Date(date);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    tableXML += `        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">${dateStr}</Data></Cell>\n`;
  });

  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Total</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Attendance %</Data></Cell>\n';
  tableXML += '        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Status</Data></Cell>\n';
  tableXML += '      </Row>\n';

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

  tableXML += '    </Table>';

  return tableXML;
};

/**
 * Export all classes to a single multi-sheet XLS file
 * @param filterDetainedOnly - If true, only export detained students in each sheet
 */
export const exportAllClassesToXLS = async (filterDetainedOnly: boolean = false): Promise<{
  xls: string;
  filename: string;
}> => {
  // Get all classes
  const classes = await getClasses();

  if (classes.length === 0) {
    throw new Error('No classes to export');
  }

  // Start workbook with XML declaration and styles
  let workbookContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">

  <Styles>
    <Style ss:ID="Header">
      <Font ss:FontName="Times New Roman" ss:Size="16" ss:Bold="1" ss:Color="#1a73e8"/>
    </Style>
    <Style ss:ID="ColumnHeader">
      <Font ss:FontName="Times New Roman" ss:Bold="1"/>
      <Interior ss:Color="#e8f0fe" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DataCell">
      <Font ss:FontName="Times New Roman"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Present">
      <Font ss:FontName="Times New Roman" ss:Color="#137333"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Absent">
      <Font ss:FontName="Times New Roman" ss:Color="#c5221f"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="Detained">
      <Font ss:FontName="Times New Roman" ss:Color="#c5221f" ss:Bold="1"/>
      <Interior ss:Color="#fce8e6" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="OK">
      <Font ss:FontName="Times New Roman" ss:Color="#137333"/>
      <Interior ss:Color="#e6f4ea" ss:Pattern="Solid"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
  </Styles>
`;

  // Track used sheet names to handle duplicates
  const usedSheetNames = new Set<string>();

  // For each class, create a worksheet
  for (const cls of classes) {
    // Generate unique sheet name
    const sheetName = sanitizeSheetName(cls.name, usedSheetNames);

    // Get attendance data for this class (with filtering if needed)
    const sheetData = await generateClassAttendanceSheetFiltered(cls.id, filterDetainedOnly);

    // Add worksheet to workbook
    workbookContent += `
  <Worksheet ss:Name="${escapeXML(sheetName)}">
${sheetData}
  </Worksheet>
`;
  }

  // Close workbook
  workbookContent += `</Workbook>`;

  // Generate filename
  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${today.getFullYear()}`;
  const filenameSuffix = filterDetainedOnly ? '_Detained' : '';
  const filename = `All_Classes_Attendance${filenameSuffix}_${dateStr}.xls`;

  return { xls: workbookContent, filename };
};

// ============ DATA MANAGEMENT ============

export const clearAllData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.CLASSES,
    STORAGE_KEYS.STUDENTS,
    STORAGE_KEYS.ATTENDANCE,
  ]);
};

export const exportData = async (): Promise<string> => {
  const classes = await getClasses();
  const students = await getStudents();
  const attendance = await getAttendanceRecords();

  return JSON.stringify({
    classes,
    students,
    attendance,
    exportedAt: new Date().toISOString(),
  });
};

export const importData = async (jsonData: string): Promise<void> => {
  try {
    const data = JSON.parse(jsonData);
    if (data.classes) {
      await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(data.classes));
    }
    if (data.students) {
      await AsyncStorage.setItem(STORAGE_KEYS.STUDENTS, JSON.stringify(data.students));
    }
    if (data.attendance) {
      await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(data.attendance));
    }
  } catch (error) {
    console.error('Error importing data:', error);
    throw new Error('Invalid data format');
  }
};
