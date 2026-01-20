// Type definitions for the Student Attendance App

export interface Class {
  id: string;
  name: string;
  subject?: string;
  createdAt: string;
}

export interface Student {
  id: string;
  classId: string;
  name: string;
  rollNumber: string;
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
  TakeAttendance: { classId: string; date?: string };
  AttendanceHistory: { classId: string };
  EditAttendance: { classId: string; date: string };
  ClassStats: { classId: string };
};

export type MainTabParamList = {
  Classes: undefined;
  Statistics: undefined;
};
