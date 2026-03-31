import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, Student, AttendanceRecord } from '../types';
import { getStudentById, getAttendanceByClass, formatDate } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'StudentAttendance'>;
  route: RouteProp<RootStackParamList, 'StudentAttendance'>;
};

interface DayRecord {
  date: string;
  present: boolean;
}

export const StudentAttendanceScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId, studentId } = route.params;
  const [student, setStudent] = useState<Student | null>(null);
  const [dayRecords, setDayRecords] = useState<DayRecord[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAbsentOnly, setShowAbsentOnly] = useState(false);

  const loadData = useCallback(async () => {
    const studentData = await getStudentById(studentId);
    setStudent(studentData || null);

    if (studentData) {
      navigation.setOptions({ title: `${studentData.rollNumber} - ${studentData.name}` });
    }

    const records: AttendanceRecord[] = await getAttendanceByClass(classId);
    // getAttendanceByClass returns descending; reverse for ascending display
    const ascending = [...records].reverse();
    const days: DayRecord[] = ascending.map((r) => ({
      date: r.date,
      present: !r.absentStudentIds.includes(studentId),
    }));
    setDayRecords(days);
  }, [classId, studentId, navigation]);

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

  const filteredRecords = showAbsentOnly ? dayRecords.filter((d) => !d.present) : dayRecords;

  const totalLectures = dayRecords.length;
  const totalPresent = dayRecords.filter((d) => d.present).length;
  const totalAbsent = totalLectures - totalPresent;
  const percentage = totalLectures > 0 ? (totalPresent / totalLectures) * 100 : 100;
  const isDetained = totalLectures > 0 && percentage < 75;

  const renderItem = ({ item, index }: { item: DayRecord; index: number }) => (
    <View style={styles.row}>
      <Text style={styles.srNo}>{index + 1}</Text>
      <Text style={styles.dateText}>{formatDate(item.date)}</Text>
      <View style={[styles.statusBadge, item.present ? styles.presentBadge : styles.absentBadge]}>
        <Text style={[styles.statusText, item.present ? styles.presentText : styles.absentText]}>
          {item.present ? 'Present' : 'Absent'}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Student info header */}
      <View style={styles.header}>
        <Text style={styles.rollNumber}>{student?.rollNumber}</Text>
        <Text style={styles.studentName}>{student?.name}</Text>
      </View>

      {/* Summary cards */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryNumber}>{totalLectures}</Text>
          <Text style={styles.summaryLabel}>Lectures</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, styles.presentColor]}>{totalPresent}</Text>
          <Text style={styles.summaryLabel}>Present</Text>
        </View>
        <View style={styles.summaryCard}>
          <Text style={[styles.summaryNumber, styles.absentColor]}>{totalAbsent}</Text>
          <Text style={styles.summaryLabel}>Absent</Text>
        </View>
        <View style={[styles.summaryCard, isDetained && styles.detainedCard]}>
          <Text style={[styles.summaryNumber, isDetained ? styles.detainedColor : styles.presentColor]}>
            {percentage.toFixed(1)}%
          </Text>
          <Text style={styles.summaryLabel}>{isDetained ? 'Detained' : 'Attendance'}</Text>
        </View>
      </View>

      {/* Toggle */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show absent only</Text>
        <Switch
          value={showAbsentOnly}
          onValueChange={setShowAbsentOnly}
          trackColor={{ false: '#ccc', true: '#ffcdd2' }}
          thumbColor={showAbsentOnly ? '#c62828' : '#f4f3f4'}
        />
      </View>

      {/* Day-wise list */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderSr}>#</Text>
        <Text style={styles.listHeaderDate}>Date</Text>
        <Text style={styles.listHeaderStatus}>Status</Text>
      </View>

      <FlatList
        data={filteredRecords}
        renderItem={renderItem}
        keyExtractor={(item) => item.date}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No attendance records yet</Text>
          </View>
        }
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rollNumber: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
  },
  studentName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 2,
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryCard: {
    flex: 1,
    alignItems: 'center',
  },
  detainedCard: {
    backgroundColor: '#fff3f3',
    borderRadius: 8,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
  },
  presentColor: {
    color: '#2e7d32',
  },
  absentColor: {
    color: '#c62828',
  },
  detainedColor: {
    color: '#c62828',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  toggleLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  listHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#e8eaf6',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  listHeaderSr: {
    width: 36,
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  listHeaderDate: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
  },
  listHeaderStatus: {
    width: 80,
    fontSize: 13,
    fontWeight: '700',
    color: '#555',
    textAlign: 'right',
  },
  listContent: {
    paddingBottom: 24,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  srNo: {
    width: 36,
    fontSize: 13,
    color: '#999',
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  statusBadge: {
    width: 80,
    alignItems: 'center',
    paddingVertical: 4,
    borderRadius: 12,
  },
  presentBadge: {
    backgroundColor: '#e8f5e9',
  },
  absentBadge: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  presentText: {
    color: '#2e7d32',
  },
  absentText: {
    color: '#c62828',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 15,
    color: '#888',
  },
});
