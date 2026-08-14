// Type definitions for the Student Attendance App

export interface SchedulePeriod {
  days: string[]; // e.g. ["Monday", "Tuesday", "Thursday"]
  startDate: string; // YYYY-MM-DD — effective from this date onwards
}

export type ClassType = 'theory' | 'lab';

export interface Class {
  id: string;
  name: string;
  subject?: string;
  subjectCode?: string;
  classType?: ClassType; // defaults to 'theory' when absent (legacy classes)
  createdAt: string;
  schedulePeriods?: SchedulePeriod[];
}

export interface Holiday {
  id: string;
  date: string;    // YYYY-MM-DD — start date (or the only date for single-day holidays)
  endDate?: string; // YYYY-MM-DD — if present, this is a range (e.g. exam period)
  name: string;
  createdAt: string;
}

export interface ClassCancellation {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD
  reason?: string;
  createdAt: string;
}

export interface ClassRemark {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD format
  remark: string;
  createdAt: string;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  rollNumber: string;
  joinDate: string;  // YYYY-MM-DD — attendance is only counted from this date onward
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  date: string; // YYYY-MM-DD format
  absentStudentIds: string[]; // Only store absent student IDs
  createdAt: string;
  updatedAt: string;
}

export interface StudentAttendanceStats {
  studentId: string;
  studentName: string;
  rollNumber: string;
  totalClasses: number;
  totalPresent: number;
  totalAbsent: number;
  attendancePercentage: number;
  isDetained: boolean; // Less than 75% attendance
}

export interface ClassAttendanceStats {
  classId: string;
  className: string;
  totalStudents: number;
  totalClassesConducted: number;
  studentStats: StudentAttendanceStats[];
  detainedCount: number;
}

export type RootStackParamList = {
  MainTabs: undefined;
  AddClass: undefined;
  EditClass: { classId: string };
  ClassDetails: { classId: string };
  AddStudent: { classId: string };
  EditStudent: { classId: string; studentId: string };
  BulkAddStudents: { classId: string };
  TakeAttendance: { classId: string; date?: string; studentId?: string };
  AttendanceHistory: { classId: string };
  EditAttendance: { classId: string; date: string };
  ClassStats: { classId: string };
  ClassRemarks: { classId: string };
  StudentAttendance: { classId: string; studentId: string };
  ClassSchedule: { classId: string };
  Holidays: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Classes: undefined;
  Statistics: undefined;
};
