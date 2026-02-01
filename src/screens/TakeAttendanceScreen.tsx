import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList, Student } from '../types';
import {
  getStudentsByClass,
  getClassById,
  getAttendanceByDate,
  saveAttendance,
  formatDate,
} from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'TakeAttendance'>;
  route: RouteProp<RootStackParamList, 'TakeAttendance'>;
};

export const TakeAttendanceScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId, date: initialDate } = route.params;
  const [students, setStudents] = useState<Student[]>([]);
  const [absentIds, setAbsentIds] = useState<Set<string>>(new Set());
  const [className, setClassName] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().split('T')[0]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const loadData = useCallback(async () => {
    const cls = await getClassById(classId);
    setClassName(cls?.name || 'Class');

    const studentList = await getStudentsByClass(classId);
    setStudents(studentList);

    // Load existing attendance for this date
    const existingAttendance = await getAttendanceByDate(classId, selectedDate);
    if (existingAttendance) {
      setAbsentIds(new Set(existingAttendance.absentStudentIds));
    } else {
      setAbsentIds(new Set());
    }
    setHasChanges(false);
  }, [classId, selectedDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleAbsent = (studentId: string) => {
    setAbsentIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveAttendance(classId, selectedDate, Array.from(absentIds));
      Alert.alert('Success', 'Attendance saved successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to save attendance');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (date) {
      const newDate = date.toISOString().split('T')[0];
      applyDateChange(newDate);
    }
  };

  const applyDateChange = (newDate: string) => {
    if (hasChanges) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Do you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard',
            style: 'destructive',
            onPress: () => {
              setSelectedDate(newDate);
              setShowDatePicker(false);
            },
          },
        ]
      );
    } else {
      setSelectedDate(newDate);
      setShowDatePicker(false);
    }
  };

  const handleWebDateChange = (dateString: string) => {
    if (dateString && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      applyDateChange(dateString);
    }
  };

  const markAllPresent = () => {
    setAbsentIds(new Set());
    setHasChanges(true);
  };

  const markAllAbsent = () => {
    setAbsentIds(new Set(students.map((s) => s.id)));
    setHasChanges(true);
  };

  const presentCount = students.length - absentIds.size;
  const absentCount = absentIds.size;

  const renderStudentItem = ({ item }: { item: Student }) => {
    const isAbsent = absentIds.has(item.id);
    
    return (
      <TouchableOpacity
        style={[styles.studentCard, isAbsent && styles.studentCardAbsent]}
        onPress={() => toggleAbsent(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.studentInfo}>
          <Text
            style={[styles.rollNumber, isAbsent && styles.textAbsent]}
            numberOfLines={1}
          >
            {item.rollNumber}
          </Text>
          <Text style={[styles.studentName, isAbsent && styles.textAbsent]}>
            {item.name}
          </Text>
        </View>
        <View style={[styles.statusBadge, isAbsent ? styles.absentBadge : styles.presentBadge]}>
          <Text style={styles.statusText}>{isAbsent ? 'A' : 'P'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{className}</Text>
        <TouchableOpacity
          style={styles.dateSelector}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateText}>{formatDate(selectedDate)}</Text>
          <Text style={styles.changeDateText}>📅 Tap to Change Date</Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal - Works on Web */}
      <Modal
        visible={showDatePicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          />
          <View style={styles.datePickerModal}>
            <Text style={styles.datePickerTitle}>Select Date</Text>
            
            {/* Platform-specific date picker */}
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleWebDateChange(e.target.value)}
                style={{
                  fontSize: 18,
                  padding: 16,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  backgroundColor: '#f5f5f5',
                  width: '100%',
                  textAlign: 'center',
                  cursor: 'pointer',
                }}
              />
            ) : (
              <DateTimePicker
                value={new Date(selectedDate + 'T12:00:00')}
                mode="date"
                display="default"
                onChange={(event, date) => {
                  if (date) {
                    const newDate = date.toISOString().split('T')[0];
                    applyDateChange(newDate);
                  }
                }}
              />
            )}
            
            {/* Quick date buttons */}
            <View style={styles.quickDateButtons}>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const today = new Date().toISOString().split('T')[0];
                  applyDateChange(today);
                }}
              >
                <Text style={styles.quickDateButtonText}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickDateButton}
                onPress={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  applyDateChange(yesterday.toISOString().split('T')[0]);
                }}
              >
                <Text style={styles.quickDateButtonText}>Yesterday</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={styles.closeDatePicker}
              onPress={() => setShowDatePicker(false)}
            >
              <Text style={styles.closeDatePickerText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickButton} onPress={markAllPresent}>
          <Text style={styles.quickButtonText}>Mark All Present</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.quickButton, styles.quickButtonDanger]} onPress={markAllAbsent}>
          <Text style={styles.quickButtonText}>Mark All Absent</Text>
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, styles.presentText]}>{presentCount}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statNumber, styles.absentText]}>{absentCount}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{students.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
      </View>

      {/* Instructions */}
      <Text style={styles.instructions}>
        Tap on a student to toggle between Present/Absent. Students are Present by default.
      </Text>

      {/* Student List */}
      <FlatList
        data={students}
        renderItem={renderStudentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No students in this class</Text>
            <Text style={styles.emptySubtext}>Add students first to take attendance</Text>
          </View>
        }
      />

      {/* Save Button */}
      {students.length > 0 && (
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Attendance'}
          </Text>
        </TouchableOpacity>
      )}
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
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  dateSelector: {
    marginTop: 8,
  },
  dateText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  changeDateText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  quickActions: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  quickButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  quickButtonDanger: {
    backgroundColor: '#f44336',
  },
  quickButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  statsBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  presentText: {
    color: '#4CAF50',
  },
  absentText: {
    color: '#f44336',
  },
  instructions: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    padding: 12,
    backgroundColor: '#fff9e6',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  studentCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  studentCardAbsent: {
    backgroundColor: '#ffebee',
    borderLeftColor: '#f44336',
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
    marginRight: 12,
  },
  studentName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  textAbsent: {
    color: '#c62828',
  },
  statusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presentBadge: {
    backgroundColor: '#4CAF50',
  },
  absentBadge: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
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
  saveButton: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#4A90D9',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlayTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  datePickerModal: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 320,
  },
  datePickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  dateInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    fontSize: 18,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  datePickerHelp: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 8,
  },
  quickDateButtons: {
    flexDirection: 'row',
    marginTop: 16,
    justifyContent: 'center',
  },
  quickDateButton: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginHorizontal: 8,
  },
  quickDateButtonText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  closeDatePicker: {
    backgroundColor: '#4A90D9',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  closeDatePickerText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
