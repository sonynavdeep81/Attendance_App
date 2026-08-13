import AsyncStorage from '@react-native-async-storage/async-storage';
import { Class, Student, AttendanceRecord, StudentAttendanceStats, ClassAttendanceStats, ClassRemark, Holiday, ClassCancellation } from '../types';

const STORAGE_KEYS = {
  CLASSES: 'attendance_classes',
  STUDENTS: 'attendance_students',
  ATTENDANCE: 'attendance_records',
  SORT_PREFERENCE: 'attendance_sort_preference',
  REMARKS: 'attendance_remarks',
  HOLIDAYS: 'attendance_holidays',
  CANCELLATIONS: 'attendance_cancellations',
  FONT_SCALE: 'attendance_font_scale',
};

// Helper function to generate unique IDs
export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

// Helper function to get today's date in YYYY-MM-DD format
export const getTodayDate = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
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

export const addClass = async (name: string, subject?: string, subjectCode?: string): Promise<Class> => {
  const classes = await getClasses();
  const newClass: Class = {
    id: generateId(),
    name,
    subject,
    subjectCode,
    createdAt: new Date().toISOString(),
  };
  classes.push(newClass);
  await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  return newClass;
};

export const updateClass = async (id: string, name: string, subject?: string, subjectCode?: string): Promise<void> => {
  const classes = await getClasses();
  const index = classes.findIndex((c) => c.id === id);
  if (index !== -1) {
    classes[index] = { ...classes[index], name, subject, subjectCode };
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

  // Delete associated remarks
  const remarks = await getRemarks();
  const filteredRemarks = remarks.filter((r) => r.classId !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.REMARKS, JSON.stringify(filteredRemarks));

  // Delete associated cancellations
  const cancellations = await getCancellations();
  const filteredCancellations = cancellations.filter((c) => c.classId !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.CANCELLATIONS, JSON.stringify(filteredCancellations));
};

export const getClassById = async (id: string): Promise<Class | undefined> => {
  const classes = await getClasses();
  return classes.find((c) => c.id === id);
};

// ============ STUDENT OPERATIONS ============

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

export const getFontScale = async (): Promise<number> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FONT_SCALE);
    const parsed = data ? parseFloat(data) : NaN;
    return isNaN(parsed) ? 1.0 : parsed;
  } catch (error) {
    return 1.0;
  }
};

export const setFontScale = async (scale: number): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.FONT_SCALE, scale.toString());
};

export const sortStudentsByRollNumber = (students: Student[]): Student[] => {
  return [...students].sort((a, b) => 
    a.rollNumber.localeCompare(b.rollNumber, undefined, { numeric: true })
  );
};

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

export const updateStudent = async (id: string, name: string, rollNumber: string, joinDate: string): Promise<void> => {
  const students = await getStudents();
  const index = students.findIndex((s) => s.id === id);
  if (index !== -1) {
    students[index] = { ...students[index], name, rollNumber, joinDate };
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

// ============ CLASS REMARKS OPERATIONS ============

export const getRemarks = async (): Promise<ClassRemark[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.REMARKS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting remarks:', error);
    return [];
  }
};

export const getRemarksByClass = async (classId: string): Promise<ClassRemark[]> => {
  const remarks = await getRemarks();
  return remarks
    .filter((r) => r.classId === classId)
    .sort((a, b) => b.date.localeCompare(a.date));
};

export const addRemark = async (classId: string, date: string, remark: string): Promise<ClassRemark> => {
  const remarks = await getRemarks();
  const newRemark: ClassRemark = {
    id: generateId(),
    classId,
    date,
    remark,
    createdAt: new Date().toISOString(),
  };
  remarks.push(newRemark);
  await AsyncStorage.setItem(STORAGE_KEYS.REMARKS, JSON.stringify(remarks));
  return newRemark;
};

export const updateRemark = async (id: string, date: string, remark: string): Promise<void> => {
  const remarks = await getRemarks();
  const index = remarks.findIndex((r) => r.id === id);
  if (index !== -1) {
    remarks[index] = { ...remarks[index], date, remark };
    await AsyncStorage.setItem(STORAGE_KEYS.REMARKS, JSON.stringify(remarks));
  }
};

export const deleteRemark = async (id: string): Promise<void> => {
  const remarks = await getRemarks();
  const filtered = remarks.filter((r) => r.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.REMARKS, JSON.stringify(filtered));
};

// ============ HOLIDAY OPERATIONS ============

export const getHolidays = async (): Promise<Holiday[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.HOLIDAYS);
    const holidays: Holiday[] = data ? JSON.parse(data) : [];
    return holidays.sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    console.error('Error getting holidays:', error);
    return [];
  }
};

export const addHoliday = async (date: string, name: string, endDate?: string): Promise<Holiday> => {
  const holidays = await getHolidays();
  const newHoliday: Holiday = {
    id: generateId(),
    date,
    endDate: endDate && endDate > date ? endDate : undefined,
    name,
    createdAt: new Date().toISOString(),
  };
  holidays.push(newHoliday);
  await AsyncStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(holidays));
  return newHoliday;
};

export const deleteHoliday = async (id: string): Promise<void> => {
  const holidays = await getHolidays();
  const filtered = holidays.filter((h) => h.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(filtered));
};

// ============ CLASS CANCELLATION OPERATIONS ============

export const getCancellations = async (): Promise<ClassCancellation[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CANCELLATIONS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting cancellations:', error);
    return [];
  }
};

export const getCancellationsByClass = async (classId: string): Promise<ClassCancellation[]> => {
  const cancellations = await getCancellations();
  return cancellations
    .filter((c) => c.classId === classId)
    .sort((a, b) => a.date.localeCompare(b.date));
};

export const addCancellation = async (classId: string, date: string, reason?: string): Promise<ClassCancellation> => {
  const cancellations = await getCancellations();
  const newCancellation: ClassCancellation = {
    id: generateId(),
    classId,
    date,
    reason,
    createdAt: new Date().toISOString(),
  };
  cancellations.push(newCancellation);
  await AsyncStorage.setItem(STORAGE_KEYS.CANCELLATIONS, JSON.stringify(cancellations));
  return newCancellation;
};

export const deleteCancellation = async (id: string): Promise<void> => {
  const cancellations = await getCancellations();
  const filtered = cancellations.filter((c) => c.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.CANCELLATIONS, JSON.stringify(filtered));
};

// ============ CLASS SCHEDULE OPERATIONS ============

export const addSchedulePeriod = async (classId: string, days: string[], startDate: string): Promise<void> => {
  const classes = await getClasses();
  const index = classes.findIndex((c) => c.id === classId);
  if (index !== -1) {
    const existing = classes[index].schedulePeriods || [];
    classes[index] = {
      ...classes[index],
      schedulePeriods: [...existing, { days, startDate }],
    };
    await AsyncStorage.setItem(STORAGE_KEYS.CLASSES, JSON.stringify(classes));
  }
};

// ============ MISSED DATES CALCULATION ============

const DAY_NAME_TO_INDEX: Record<string, number> = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

export const getMissedDates = async (classId: string): Promise<string[]> => {
  const cls = await getClassById(classId);
  if (!cls || !cls.schedulePeriods || cls.schedulePeriods.length === 0) return [];

  const attendanceRecords = await getAttendanceByClass(classId);
  const recordedDates = new Set(attendanceRecords.map((r) => r.date));

  const holidays = await getHolidays();
  const holidayDates = new Set<string>();
  for (const h of holidays) {
    if (h.endDate) {
      const cur = new Date(h.date + 'T00:00:00');
      const end = new Date(h.endDate + 'T00:00:00');
      while (cur <= end) {
        holidayDates.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`);
        cur.setDate(cur.getDate() + 1);
      }
    } else {
      holidayDates.add(h.date);
    }
  }

  const cancellations = await getCancellationsByClass(classId);
  const cancelledDates = new Set(cancellations.map((c) => c.date));

  const today = getTodayDate();
  const missedDates: string[] = [];

  const periods = [...cls.schedulePeriods].sort((a, b) => a.startDate.localeCompare(b.startDate));

  for (let p = 0; p < periods.length; p++) {
    const period = periods[p];
    const periodEnd = p + 1 < periods.length ? periods[p + 1].startDate : today;

    const scheduledDayIndices = new Set(
      period.days.map((d) => DAY_NAME_TO_INDEX[d]).filter((i) => i !== undefined)
    );

    const current = new Date(period.startDate + 'T00:00:00');
    const end = new Date(periodEnd + 'T00:00:00');

    while (current < end) {
      const dateStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
      const dayOfWeek = current.getDay();

      if (
        scheduledDayIndices.has(dayOfWeek) &&
        !holidayDates.has(dateStr) &&
        !cancelledDates.has(dateStr) &&
        !recordedDates.has(dateStr)
      ) {
        missedDates.push(dateStr);
      }

      current.setDate(current.getDate() + 1);
    }
  }

  return missedDates.sort();
};

// ============ STATISTICS CALCULATIONS ============

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
  const subjectCode = classInfo?.subjectCode || '';
  const subjectDisplay = [subject, subjectCode].filter(Boolean).join('  |  ');
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
  const subjectRow = createCenteredRow(subjectDisplay);
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
  <tr><td colspan="${totalCols}" style="font-family: Times New Roman; font-size: 16pt; font-weight: bold; color: #1a73e8;">${subjectDisplay}</td></tr>
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
  const subjectCode = classInfo?.subjectCode || '';
  const subjectDisplay = [subject, subjectCode].filter(Boolean).join('  |  ');
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

  if (subjectDisplay) {
    tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">${subjectDisplay}</Data>
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
  const subjectCode = classInfo?.subjectCode || '';
  const subjectDisplay = [subject, subjectCode].filter(Boolean).join('  |  ');
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

  if (subjectDisplay) {
    tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="${2 + dates.length + 2}">
          <Data ss:Type="String">${subjectDisplay}</Data>
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
 * Generate the "Holidays & Missed Dates" worksheet content for multi-sheet export.
 */
const generateHolidaysMissedSheet = async (classes: Class[]): Promise<string> => {
  const holidays = await getHolidays();
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  let tableXML = '    <Table>\n';

  // ── Section: Global Holidays ──
  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="1">
          <Data ss:Type="String">Global Holidays</Data>
        </Cell>
      </Row>\n`;

  tableXML += `      <Row>
        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Date / Period</Data></Cell>
        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Name</Data></Cell>
      </Row>\n`;

  if (holidays.length === 0) {
    tableXML += `      <Row>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String">No holidays recorded</Data></Cell>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String"></Data></Cell>
      </Row>\n`;
  } else {
    for (const h of holidays) {
      const fmt = (ds: string) => {
        const d = new Date(ds + 'T00:00:00');
        return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
      };
      const dateDisplay = h.endDate ? `${fmt(h.date)}  →  ${fmt(h.endDate)}` : fmt(h.date);
      tableXML += `      <Row>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(dateDisplay)}</Data></Cell>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(h.name)}</Data></Cell>
      </Row>\n`;
    }
  }

  tableXML += `      <Row></Row>\n`;

  // ── Section: Missed Attendance Dates (per class) ──
  tableXML += `      <Row>
        <Cell ss:StyleID="Header" ss:MergeAcross="1">
          <Data ss:Type="String">Missed Attendance Dates</Data>
        </Cell>
      </Row>\n`;

  for (const cls of classes) {
    if (!cls.schedulePeriods || cls.schedulePeriods.length === 0) continue;

    const missed = await getMissedDates(cls.id);

    tableXML += `      <Row>
        <Cell ss:StyleID="ColumnHeader" ss:MergeAcross="1">
          <Data ss:Type="String">${escapeXML(cls.name)}${cls.subject ? '  |  ' + escapeXML(cls.subject) : ''}</Data>
        </Cell>
      </Row>\n`;

    tableXML += `      <Row>
        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Date</Data></Cell>
        <Cell ss:StyleID="ColumnHeader"><Data ss:Type="String">Day</Data></Cell>
      </Row>\n`;

    if (missed.length === 0) {
      tableXML += `      <Row>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String">No missed dates</Data></Cell>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String"></Data></Cell>
      </Row>\n`;
    } else {
      for (const dateStr of missed) {
        const d = new Date(dateStr + 'T00:00:00');
        const dateDisplay = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
        tableXML += `      <Row>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${escapeXML(dateDisplay)}</Data></Cell>
        <Cell ss:StyleID="DataCell"><Data ss:Type="String">${DAY_NAMES[d.getDay()]}</Data></Cell>
      </Row>\n`;
      }
    }

    tableXML += `      <Row></Row>\n`;
  }

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

  // Add Holidays & Missed Dates sheet
  const holidaysMissedData = await generateHolidaysMissedSheet(classes);
  workbookContent += `
  <Worksheet ss:Name="Holidays &amp; Missed">
${holidaysMissedData}
  </Worksheet>
`;

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

// ============ DETAINEE LIST EXPORT (Attendance Performa) ============

/**
 * Derive B.Tech year from class name's first character.
 * "1CE12" → 1, "3ce45" → 3. Returns 0 if not a digit 1-4.
 */
const getYearFromClassName = (className: string): number => {
  const firstChar = className.charAt(0);
  const year = parseInt(firstChar, 10);
  return (year >= 1 && year <= 4) ? year : 0;
};

const getOrdinalSuffix = (n: number): string => {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
};

/**
 * Derive semester from year + session.
 * Jan-May → even semester, otherwise → odd semester.
 * Year 1 → sem 1 or 2, Year 2 → sem 3 or 4, etc.
 */
const getSemesterFromYearAndSession = (year: number, session: string): number => {
  const isEven = /jan/i.test(session);
  return (year - 1) * 2 + (isEven ? 2 : 1);
};

/**
 * Format class/semester/group for the detainee export Row 6.
 */
const getDetaineeClassInfo = (className: string, session: string): {
  classLabel: string;
  semesterLabel: string;
  groupLabel: string;
} => {
  const year = getYearFromClassName(className);
  const classLabel = year > 0
    ? `Class: B.Tech. (${getOrdinalSuffix(year)} Year)`
    : `Class: ${className}`;

  let semesterLabel = '';
  if (year > 0) {
    const sem = getSemesterFromYearAndSession(year, session);
    semesterLabel = `Semester: ${getOrdinalSuffix(sem)}`;
  }

  const groupLabel = `Group: ${className.toUpperCase()}`;

  return { classLabel, semesterLabel, groupLabel };
};

type DetaineeInfo = {
  rollNumber: string;
  name: string;
  totalDelivered: number;
  lectureRequired: number;
  totalAttended: number;
  lectureShort: number;
  percentage: number;
};

/**
 * Generate detainee list table XML for a single class (used as a sheet in multi-sheet export).
 */
const generateDetaineeSheetTable = async (classId: string): Promise<string> => {
  const classInfo = await getClassById(classId);
  const students = await getStudentsByClass(classId, true);
  const attendanceRecords = await getAttendanceByClass(classId);

  const sortedRecords = [...attendanceRecords].sort((a, b) => a.date.localeCompare(b.date));
  const dates = sortedRecords.map(r => r.date);
  const totalClasses = dates.length;
  const session = getSessionFromDates(dates);

  const className = classInfo?.name || 'Class';
  const subject = classInfo?.subject || '';
  const subjectCode = classInfo?.subjectCode || '';

  if (totalClasses === 0) {
    return `    <Table>
      <Row><Cell><Data ss:Type="String">${escapeXML(className)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">No attendance records found.</Data></Cell></Row>
    </Table>`;
  }

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

  if (allDetainees.length === 0) {
    return `    <Table>
      <Row><Cell><Data ss:Type="String">${escapeXML(className)}</Data></Cell></Row>
      <Row><Cell><Data ss:Type="String">No detained students in this class.</Data></Cell></Row>
    </Table>`;
  }

  const detained = allDetainees.filter(s => s.percentage < 63);
  const condonedDAA = allDetainees.filter(s => s.percentage >= 63 && s.percentage < 69);
  const condonedHoD = allDetainees.filter(s => s.percentage >= 69 && s.percentage < 75);

  const buildSectionHeaders = (): string => {
    return `      <Row ss:Height="21">
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Sr. No.</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Roll No.</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Name</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">No. of Lectures Delivered</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Lecture Required&#10;(75%)</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">No. of Lecture Attended</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">No. of Lecture Short</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Condoned 6% by HoD</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Condoned 6% by DAA</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Remarks</Data></Cell>
      </Row>\n`;
  };

  const buildDataRows = (list: DetaineeInfo[]): string => {
    return list.map((s, i) => `      <Row ss:Height="21">
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${i + 1}</Data></Cell>
        <Cell ss:StyleID="DDataLeft"><Data ss:Type="String">${escapeXML(s.rollNumber)}</Data></Cell>
        <Cell ss:StyleID="DDataLeft"><Data ss:Type="String">${escapeXML(s.name)}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.totalDelivered}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.lectureRequired}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.totalAttended}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.lectureShort}</Data></Cell>
        <Cell ss:StyleID="DDataBorder"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DDataBorder"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DDataBorder"><Data ss:Type="String"></Data></Cell>
      </Row>`).join('\n');
  };

  const buildHoDSectionHeaders = (): string => {
    return `      <Row ss:Height="21">
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Sr. No.</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Roll No.</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Name</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">No. of Lectures Delivered</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Lecture Required&#10;(75%)</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">No. of Lecture Attended</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">No. of Lecture Short</Data></Cell>
        <Cell ss:StyleID="DColHeaderMerged" ss:MergeAcross="1"><Data ss:Type="String">Condoned&#10;6% by HoD</Data></Cell>
        <Cell ss:StyleID="DColHeader"><Data ss:Type="String">Remarks</Data></Cell>
      </Row>\n`;
  };

  const buildHoDDataRows = (list: DetaineeInfo[]): string => {
    return list.map((s, i) => `      <Row ss:Height="21">
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${i + 1}</Data></Cell>
        <Cell ss:StyleID="DDataLeft"><Data ss:Type="String">${escapeXML(s.rollNumber)}</Data></Cell>
        <Cell ss:StyleID="DDataLeft"><Data ss:Type="String">${escapeXML(s.name)}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.totalDelivered}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.lectureRequired}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.totalAttended}</Data></Cell>
        <Cell ss:StyleID="DDataCenter"><Data ss:Type="Number">${s.lectureShort}</Data></Cell>
        <Cell ss:StyleID="DDataBorder" ss:MergeAcross="1"><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DDataBorder"><Data ss:Type="String"></Data></Cell>
      </Row>`).join('\n');
  };

  let tableXML = `    <Table>
      <Column ss:Width="48"/>
      <Column ss:Width="75"/>
      <Column ss:Width="220"/>
      <Column ss:Width="80"/>
      <Column ss:Width="61"/>
      <Column ss:Width="68"/>
      <Column ss:Width="58"/>
      <Column ss:Width="68"/>
      <Column ss:Width="66"/>
      <Column ss:Width="62"/>\n`;

  // Row 1: Institution header
  tableXML += `      <Row ss:Height="36">
        <Cell ss:StyleID="DInstHeader" ss:MergeAcross="9">
          <Data ss:Type="String">Computer Science &amp; Engineering&#10;Punjabi University, Patiala</Data>
        </Cell>
      </Row>\n`;

  // Row 2: Spacer
  tableXML += `      <Row ss:Height="9.75"></Row>\n`;

  // Row 3: Attendance Record title
  tableXML += `      <Row ss:Height="21">
        <Cell ss:StyleID="DTitleHeader" ss:MergeAcross="9">
          <Data ss:Type="String">Attendance Record (${escapeXML(session.replace(' - ', '-').toUpperCase())})</Data>
        </Cell>
      </Row>\n`;

  // Row 4: Empty merged row
  tableXML += `      <Row ss:Height="15.75">
        <Cell ss:MergeAcross="9"><Data ss:Type="String"></Data></Cell>
      </Row>\n`;

  // Row 5: Spacer
  tableXML += `      <Row ss:Height="7.5"></Row>\n`;

  // Row 6: Class / Semester / Group
  const { classLabel, semesterLabel, groupLabel } = getDetaineeClassInfo(className, session);
  tableXML += `      <Row ss:Height="15.75">
        <Cell ss:StyleID="DInfoBold" ss:MergeAcross="2"><Data ss:Type="String">${escapeXML(classLabel)}</Data></Cell>
        <Cell ss:StyleID="DInfoBold" ss:MergeAcross="1"><Data ss:Type="String">${escapeXML(semesterLabel)}</Data></Cell>
        <Cell ss:StyleID="DInfoBoldRight" ss:MergeAcross="4"><Data ss:Type="String">${escapeXML(groupLabel)}</Data></Cell>
      </Row>\n`;

  // Row 7: Empty
  tableXML += `      <Row ss:Height="15.75"></Row>\n`;

  // Row 8: Subject and Subject Code
  const subjectLine = [subject, subjectCode].filter(Boolean).join('  |  Code: ');
  tableXML += `      <Row ss:Height="24">
        <Cell ss:StyleID="DInfoBold" ss:MergeAcross="9"><Data ss:Type="String">Subject: ${escapeXML(subjectLine)}</Data></Cell>
      </Row>\n`;

  // Section 1: Less than 63% (Detained)
  tableXML += `      <Row ss:Height="18">
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DSectionLabel" ss:MergeAcross="8"><Data ss:Type="String">Less than 63% (Detained)</Data></Cell>
      </Row>\n`;
  tableXML += buildSectionHeaders();
  if (detained.length > 0) {
    tableXML += buildDataRows(detained) + '\n';
  }

  // Spacer
  tableXML += `      <Row ss:Height="11.25"></Row>\n`;

  // Section 2: Less than 69% but upto 63% (Condoned by DAA)
  tableXML += `      <Row ss:Height="18">
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DSectionLabel" ss:MergeAcross="8"><Data ss:Type="String">Less than 69% but upto 63% (To be condoned by Dean Academic Affairs)</Data></Cell>
      </Row>\n`;
  tableXML += buildSectionHeaders();
  if (condonedDAA.length > 0) {
    tableXML += buildDataRows(condonedDAA) + '\n';
  }

  // Spacer
  tableXML += `      <Row ss:Height="11.25"></Row>\n`;

  // Section 3: Less than 75% but upto 69% (Condoned by HoD)
  tableXML += `      <Row ss:Height="18">
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DSectionLabel" ss:MergeAcross="8"><Data ss:Type="String">Less than 75% but upto 69% (To be condoned by Head of Department)</Data></Cell>
      </Row>\n`;
  tableXML += buildHoDSectionHeaders();
  if (condonedHoD.length > 0) {
    tableXML += buildHoDDataRows(condonedHoD) + '\n';
  }

  // Spacer + Name
  tableXML += `      <Row ss:Height="21"></Row>\n`;
  tableXML += `      <Row ss:Height="24.75">
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell><Data ss:Type="String"></Data></Cell>
        <Cell ss:StyleID="DSignatureRight" ss:MergeAcross="6"><Data ss:Type="String">Dr. Navdeep Singh</Data></Cell>
      </Row>\n`;

  tableXML += `    </Table>`;
  return tableXML;
};

/**
 * Export detainee lists for all classes as a multi-sheet Excel XML file.
 * Each class gets its own sheet in Attendance Performa format with 3 sections:
 *   1. < 63% — Detained
 *   2. >= 63% and < 69% — To be condoned by Dean Academic Affairs
 *   3. >= 69% and < 75% — To be condoned by Head of Department
 */
export const exportAllDetaineeLists = async (): Promise<{
  xls: string;
  filename: string;
}> => {
  const classes = await getClasses();

  if (classes.length === 0) {
    throw new Error('No classes to export');
  }

  // Detainee-specific styles (prefixed with D to avoid conflicts with attendance styles)
  let workbookContent = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">

  <Styles>
    <Style ss:ID="DInstHeader">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Bold="1"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
    </Style>
    <Style ss:ID="DTitleHeader">
      <Font ss:FontName="Times New Roman" ss:Size="14" ss:Bold="1"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="DInfoBold">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Bold="1"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="DInfoBoldRight">
      <Font ss:FontName="Times New Roman" ss:Size="12" ss:Bold="1"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="DSectionLabel">
      <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
    </Style>
    <Style ss:ID="DColHeader">
      <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DColHeaderMerged">
      <Font ss:FontName="Times New Roman" ss:Size="10" ss:Bold="1"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center" ss:WrapText="1"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DDataCenter">
      <Font ss:FontName="Times New Roman" ss:Size="11"/>
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DDataLeft">
      <Font ss:FontName="Times New Roman" ss:Size="11"/>
      <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DDataBorder">
      <Font ss:FontName="Times New Roman" ss:Size="11"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
      </Borders>
    </Style>
    <Style ss:ID="DSignatureRight">
      <Font ss:FontName="Times New Roman" ss:Size="11" ss:Bold="1"/>
      <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
    </Style>
  </Styles>
`;

  const usedSheetNames = new Set<string>();

  for (const cls of classes) {
    const sheetName = sanitizeSheetName(cls.name, usedSheetNames);
    const sheetData = await generateDetaineeSheetTable(cls.id);

    workbookContent += `
  <Worksheet ss:Name="${escapeXML(sheetName)}">
${sheetData}
  </Worksheet>
`;
  }

  workbookContent += `</Workbook>`;

  const today = new Date();
  const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1)
    .toString()
    .padStart(2, '0')}-${today.getFullYear()}`;
  const filename = `All_Classes_Detainee_List_${dateStr}.xls`;

  return { xls: workbookContent, filename };
};

// ============ DATA MANAGEMENT ============

export const clearAllData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    STORAGE_KEYS.CLASSES,
    STORAGE_KEYS.STUDENTS,
    STORAGE_KEYS.ATTENDANCE,
    STORAGE_KEYS.REMARKS,
    STORAGE_KEYS.HOLIDAYS,
    STORAGE_KEYS.CANCELLATIONS,
    STORAGE_KEYS.SORT_PREFERENCE,
  ]);
};

export const exportData = async (): Promise<string> => {
  const classes = await getClasses();
  const students = await getStudents();
  const attendance = await getAttendanceRecords();
  const holidays = await getHolidays();
  const cancellations = await getCancellations();
  const remarks = await getRemarks();

  return JSON.stringify({
    classes,        // includes schedulePeriods
    students,
    attendance,
    holidays,       // includes exam period ranges
    cancellations,
    remarks,
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
    if (data.holidays) {
      await AsyncStorage.setItem(STORAGE_KEYS.HOLIDAYS, JSON.stringify(data.holidays));
    }
    if (data.cancellations) {
      await AsyncStorage.setItem(STORAGE_KEYS.CANCELLATIONS, JSON.stringify(data.cancellations));
    }
    if (data.remarks) {
      await AsyncStorage.setItem(STORAGE_KEYS.REMARKS, JSON.stringify(data.remarks));
    }
  } catch (error) {
    console.error('Error importing data:', error);
    throw new Error('Invalid data format');
  }
};
