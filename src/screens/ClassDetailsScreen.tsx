import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Student, Class } from '../types';
import {
  getStudentsByClass,
  deleteStudent,
  getClassById,
  getTodayDate,
  getAttendanceByClass,
} from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClassDetails'>;
  route: RouteProp<RootStackParamList, 'ClassDetails'>;
};

export const ClassDetailsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId } = route.params;
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [totalClasses, setTotalClasses] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Student | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [showDeleteSelectedDialog, setShowDeleteSelectedDialog] = useState(false);

  const loadData = useCallback(async () => {
    const cls = await getClassById(classId);
    setClassInfo(cls || null);

    const studentList = await getStudentsByClass(classId);
    setStudents(studentList);

    const attendance = await getAttendanceByClass(classId);
    setTotalClasses(attendance.length);
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleDeleteStudent = (student: Student) => {
    setDeleteTarget(student);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteStudent(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const selectAllStudents = () => {
    setSelectedStudents(new Set(students.map((s) => s.id)));
  };

  const deselectAllStudents = () => {
    setSelectedStudents(new Set());
  };

  const deleteAllStudents = async () => {
    for (const student of students) {
      await deleteStudent(student.id);
    }
    setShowDeleteAllDialog(false);
    loadData();
  };

  const deleteSelectedStudents = async () => {
    for (const studentId of selectedStudents) {
      await deleteStudent(studentId);
    }
    setSelectedStudents(new Set());
    setSelectionMode(false);
    setShowDeleteSelectedDialog(false);
    loadData();
  };

  const renderStudentItem = ({ item }: { item: Student }) => (
    <View style={styles.studentCard}>
      {selectionMode && (
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => toggleStudentSelection(item.id)}
        >
          <Text style={styles.checkboxText}>
            {selectedStudents.has(item.id) ? '☑️' : '⬜'}
          </Text>
        </TouchableOpacity>
      )}
      <View style={styles.studentInfo}>
        <Text style={styles.rollNumber}>{item.rollNumber}</Text>
        <Text style={styles.studentName}>{item.name}</Text>
      </View>
      {!selectionMode && (
        <>
          <TouchableOpacity
            style={styles.studentEditButton}
            onPress={() => navigation.navigate('EditStudent', { classId, studentId: item.id })}
          >
            <Text style={styles.studentEditButtonText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.studentDeleteButton}
            onPress={() => handleDeleteStudent(item)}
          >
            <Text style={styles.studentDeleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header with class info */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{classInfo?.name || 'Class'}</Text>
        {classInfo?.subject && <Text style={styles.headerSubject}>{classInfo.subject}</Text>}
        <View style={styles.headerStats}>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatNumber}>{students.length}</Text>
            <Text style={styles.headerStatLabel}>Students</Text>
          </View>
          <View style={styles.headerStat}>
            <Text style={styles.headerStatNumber}>{totalClasses}</Text>
            <Text style={styles.headerStatLabel}>Classes</Text>
          </View>
        </View>
      </View>

      {/* Action buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryAction]}
          onPress={() => navigation.navigate('TakeAttendance', { classId, date: getTodayDate() })}
        >
          <Text style={styles.actionButtonText}>📋 Take Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => navigation.navigate('AttendanceHistory', { classId })}
        >
          <Text style={[styles.actionButtonText, styles.secondaryActionText]}>📅 History</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryAction]}
          onPress={() => navigation.navigate('ClassStats', { classId })}
        >
          <Text style={[styles.actionButtonText, styles.secondaryActionText]}>📊 Stats</Text>
        </TouchableOpacity>
      </View>

      {/* Student list */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Students</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.bulkAddButton}
            onPress={() => navigation.navigate('BulkAddStudents', { classId })}
          >
            <Text style={styles.bulkAddButtonText}>📋 Bulk Add</Text>
          </TouchableOpacity>
          {students.length > 0 && (
            <TouchableOpacity
              style={[styles.bulkAddButton, selectionMode && styles.activeButton]}
              onPress={() => {
                setSelectionMode(!selectionMode);
                setSelectedStudents(new Set());
              }}
            >
              <Text style={styles.bulkAddButtonText}>{selectionMode ? '✖️ Cancel' : '☑️ Select'}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selection mode controls */}
      {selectionMode && (
        <View style={styles.selectionControls}>
          <View style={styles.selectionButtons}>
            <TouchableOpacity style={styles.selectButton} onPress={selectAllStudents}>
              <Text style={styles.selectButtonText}>Select All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.selectButton} onPress={deselectAllStudents}>
              <Text style={styles.selectButtonText}>Deselect All</Text>
            </TouchableOpacity>
          </View>
          {selectedStudents.size > 0 && (
            <TouchableOpacity
              style={styles.deleteSelectedButton}
              onPress={() => setShowDeleteSelectedDialog(true)}
            >
              <Text style={styles.deleteSelectedButtonText}>
                🗑️ Delete Selected ({selectedStudents.size})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Delete All button */}
      {!selectionMode && students.length > 0 && (
        <View style={styles.deleteAllContainer}>
          <TouchableOpacity
            style={styles.deleteAllButton}
            onPress={() => setShowDeleteAllDialog(true)}
          >
            <Text style={styles.deleteAllButtonText}>🗑️ Delete All Students</Text>
          </TouchableOpacity>
        </View>
      )}
      <FlatList
        data={students}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No students yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add students</Text>
          </View>
        }
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddStudent', { classId })}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Student"
        message={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDialog
        visible={showDeleteAllDialog}
        title="Delete All Students"
        message={`Are you sure you want to delete all ${students.length} students? This action cannot be undone.`}
        onConfirm={deleteAllStudents}
        onCancel={() => setShowDeleteAllDialog(false)}
      />

      <ConfirmDialog
        visible={showDeleteSelectedDialog}
        title="Delete Selected Students"
        message={`Are you sure you want to delete ${selectedStudents.size} selected students? This action cannot be undone.`}
        onConfirm={deleteSelectedStudents}
        onCancel={() => setShowDeleteSelectedDialog(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#4A90D9',
    padding: 20,
    paddingTop: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubject: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  headerStats: {
    flexDirection: 'row',
    marginTop: 16,
  },
  headerStat: {
    marginRight: 32,
  },
  headerStatNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },
  actions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  primaryAction: {
    backgroundColor: '#4A90D9',
  },
  secondaryAction: {
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryActionText: {
    color: '#333',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  bulkAddButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  bulkAddButtonText: {
    color: '#1976d2',
    fontSize: 13,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#ffcdd2',
  },
  selectionControls: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  selectionButtons: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  selectButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 12,
  },
  selectButtonText: {
    color: '#1976d2',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteSelectedButton: {
    backgroundColor: '#d32f2f',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteSelectedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  deleteAllContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  deleteAllButton: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  deleteAllButtonText: {
    color: '#d32f2f',
    fontSize: 14,
    fontWeight: '600',
  },
  checkbox: {
    marginRight: 12,
  },
  checkboxText: {
    fontSize: 24,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rollNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90D9',
    width: 50,
  },
  studentName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  studentEditButton: {
    padding: 8,
    marginLeft: 8,
  },
  studentEditButtonText: {
    fontSize: 18,
  },
  studentDeleteButton: {
    padding: 8,
    marginLeft: 4,
  },
  studentDeleteButtonText: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4A90D9',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 36,
  },
});
