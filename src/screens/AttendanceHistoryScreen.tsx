import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList, AttendanceRecord } from '../types';
import {
  getAttendanceByClass,
  getClassById,
  deleteAttendanceRecord,
  formatDate,
  getStudentsByClass,
} from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'AttendanceHistory'>;
  route: RouteProp<RootStackParamList, 'AttendanceHistory'>;
};

interface AttendanceWithStats extends AttendanceRecord {
  totalStudents: number;
  presentCount: number;
}

export const AttendanceHistoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId } = route.params;
  const [records, setRecords] = useState<AttendanceWithStats[]>([]);
  const [className, setClassName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const cls = await getClassById(classId);
    setClassName(cls?.name || 'Class');

    const students = await getStudentsByClass(classId);
    const totalStudents = students.length;

    const attendanceRecords = await getAttendanceByClass(classId);
    const recordsWithStats: AttendanceWithStats[] = attendanceRecords.map((record) => ({
      ...record,
      totalStudents,
      presentCount: totalStudents - record.absentStudentIds.length,
    }));
    setRecords(recordsWithStats);
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

  const handleDelete = (record: AttendanceRecord) => {
    Alert.alert(
      'Delete Record',
      `Are you sure you want to delete attendance for ${formatDate(record.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteAttendanceRecord(classId, record.date);
            loadData();
          },
        },
      ]
    );
  };

  const renderRecordItem = ({ item }: { item: AttendanceWithStats }) => {
    const attendancePercentage = item.totalStudents > 0
      ? Math.round((item.presentCount / item.totalStudents) * 100)
      : 100;

    return (
      <TouchableOpacity
        style={styles.recordCard}
        onPress={() => navigation.navigate('TakeAttendance', { classId, date: item.date })}
        onLongPress={() => {
          Alert.alert(
            formatDate(item.date),
            'Choose an action',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Edit', onPress: () => navigation.navigate('TakeAttendance', { classId, date: item.date }) },
              { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
            ]
          );
        }}
      >
        <View style={styles.recordInfo}>
          <Text style={styles.recordDate}>{formatDate(item.date)}</Text>
          <View style={styles.recordStats}>
            <Text style={[styles.recordStat, styles.presentStat]}>
              P: {item.presentCount}
            </Text>
            <Text style={[styles.recordStat, styles.absentStat]}>
              A: {item.absentStudentIds.length}
            </Text>
          </View>
        </View>
        <View style={styles.percentageContainer}>
          <Text style={[
            styles.percentage,
            attendancePercentage < 75 && styles.percentageLow
          ]}>
            {attendancePercentage}%
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{className}</Text>
        <Text style={styles.headerSubtitle}>Attendance History</Text>
        <Text style={styles.recordCount}>{records.length} records</Text>
      </View>

      <FlatList
        data={records}
        renderItem={renderRecordItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No attendance records yet</Text>
            <Text style={styles.emptySubtext}>Take attendance to see history here</Text>
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
    padding: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  recordCount: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 8,
  },
  listContent: {
    padding: 16,
  },
  recordCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  recordInfo: {
    flex: 1,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  recordStats: {
    flexDirection: 'row',
    marginTop: 6,
  },
  recordStat: {
    fontSize: 14,
    marginRight: 16,
  },
  presentStat: {
    color: '#4CAF50',
  },
  absentStat: {
    color: '#f44336',
  },
  percentageContainer: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  percentage: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  percentageLow: {
    color: '#f44336',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
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
});
