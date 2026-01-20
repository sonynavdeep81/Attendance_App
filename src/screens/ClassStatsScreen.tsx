import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RootStackParamList, StudentAttendanceStats } from '../types';
import { calculateClassStats, getClassById, exportClassAttendanceToCSV } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClassStats'>;
  route: RouteProp<RootStackParamList, 'ClassStats'>;
};

export const ClassStatsScreen: React.FC<Props> = ({ route }) => {
  const { classId } = route.params;
  const [className, setClassName] = useState('');
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalClasses, setTotalClasses] = useState(0);
  const [studentStats, setStudentStats] = useState<StudentAttendanceStats[]>([]);
  const [detainedCount, setDetainedCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetainedOnly, setShowDetainedOnly] = useState(false);
  const [exporting, setExporting] = useState(false);

  const loadData = useCallback(async () => {
    const cls = await getClassById(classId);
    setClassName(cls?.name || 'Class');

    const stats = await calculateClassStats(classId);
    if (stats) {
      setTotalStudents(stats.totalStudents);
      setTotalClasses(stats.totalClassesConducted);
      setStudentStats(stats.studentStats);
      setDetainedCount(stats.detainedCount);
    }
  }, [classId]);

  const handleExport = async () => {
    if (totalClasses === 0) {
      Alert.alert('No Data', 'No attendance records to export. Please take attendance first.');
      return;
    }

    setExporting(true);
    try {
      const { csv: xlsContent, filename } = await exportClassAttendanceToCSV(classId);

      if (Platform.OS === 'web') {
        // Web: Create download as XLS file
        const blob = new Blob([xlsContent], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        Alert.alert(
          'Export Successful', 
          `File "${filename}" downloaded!\n\nOpen with Excel or upload to Google Drive and open with Google Sheets.`
        );
      } else {
        // Mobile: Save file and share it
        const fileUri = FileSystem.documentDirectory + filename;
        await FileSystem.writeAsStringAsync(fileUri, xlsContent, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        
        // Check if sharing is available
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/vnd.ms-excel',
            dialogTitle: 'Save Attendance File',
            UTI: 'com.microsoft.excel.xls',
          });
        } else {
          Alert.alert('Success', `File saved to: ${fileUri}`);
        }
      }
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Error', 'Failed to export attendance data.');
    } finally {
      setExporting(false);
    }
  };

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

  const displayedStats = showDetainedOnly
    ? studentStats.filter((s) => s.isDetained)
    : studentStats;

  const renderStudentStat = ({ item }: { item: StudentAttendanceStats }) => (
    <View style={[styles.statCard, item.isDetained && styles.statCardDetained]}>
      <View style={styles.studentHeader}>
        <Text style={styles.rollNumber}>{item.rollNumber}</Text>
        <Text style={styles.studentName}>{item.studentName}</Text>
        {item.isDetained && (
          <View style={styles.detainedBadge}>
            <Text style={styles.detainedText}>DETAINED</Text>
          </View>
        )}
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, styles.presentValue]}>{item.totalPresent}</Text>
          <Text style={styles.statLabel}>Present</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statValue, styles.absentValue]}>{item.totalAbsent}</Text>
          <Text style={styles.statLabel}>Absent</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{item.totalClasses}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[
            styles.statValue,
            styles.percentageValue,
            item.isDetained && styles.percentageDetained
          ]}>
            {item.attendancePercentage.toFixed(1)}%
          </Text>
          <Text style={styles.statLabel}>Attendance</Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>{className}</Text>
            <Text style={styles.headerSubtitle}>Attendance Statistics</Text>
          </View>
          <TouchableOpacity
            style={[styles.exportButton, exporting && styles.exportButtonDisabled]}
            onPress={handleExport}
            disabled={exporting}
          >
            <Text style={styles.exportButtonText}>
              {exporting ? '⏳' : '📤'} Export
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary */}
      <View style={styles.summaryContainer}>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{totalStudents}</Text>
          <Text style={styles.summaryLabel}>Total Students</Text>
        </View>
        <View style={styles.summaryBox}>
          <Text style={styles.summaryValue}>{totalClasses}</Text>
          <Text style={styles.summaryLabel}>Classes Conducted</Text>
        </View>
        <View style={[styles.summaryBox, detainedCount > 0 && styles.summaryBoxWarning]}>
          <Text style={[styles.summaryValue, detainedCount > 0 && styles.summaryValueWarning]}>
            {detainedCount}
          </Text>
          <Text style={styles.summaryLabel}>Detained (&lt;75%)</Text>
        </View>
      </View>

      {/* Filter - only show when attendance exists */}
      {totalClasses > 0 && detainedCount > 0 && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowDetainedOnly(!showDetainedOnly)}
        >
          <Text style={styles.filterButtonText}>
            {showDetainedOnly ? 'Show All Students' : `Show Detained Only (${detainedCount})`}
          </Text>
        </TouchableOpacity>
      )}

      {/* No attendance message */}
      {totalClasses === 0 && (
        <View style={styles.noAttendanceContainer}>
          <Text style={styles.noAttendanceIcon}>📋</Text>
          <Text style={styles.noAttendanceTitle}>No Attendance Recorded</Text>
          <Text style={styles.noAttendanceText}>
            Take attendance for at least one day to see student statistics here.
          </Text>
        </View>
      )}

      {/* Student Stats List - only show when attendance exists */}
      {totalClasses > 0 && (
        <FlatList
          data={displayedStats}
          renderItem={renderStudentStat}
          keyExtractor={(item) => item.studentId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                {showDetainedOnly ? 'No detained students' : 'No students in this class'}
              </Text>
            </View>
          }
        />
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
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  exportButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  exportButtonDisabled: {
    opacity: 0.6,
  },
  exportButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  summaryBox: {
    flex: 1,
    alignItems: 'center',
  },
  summaryBoxWarning: {
    backgroundColor: '#fff3e0',
    marginHorizontal: -8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  summaryValueWarning: {
    color: '#ff9800',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  filterButton: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    alignItems: 'center',
  },
  filterButtonText: {
    color: '#1976d2',
    fontWeight: '600',
  },
  warningBanner: {
    backgroundColor: '#fff9c4',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  warningText: {
    color: '#f57f17',
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statCardDetained: {
    borderLeftColor: '#f44336',
    backgroundColor: '#ffebee',
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  rollNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginRight: 8,
  },
  studentName: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  detainedBadge: {
    backgroundColor: '#f44336',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  detainedText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  presentValue: {
    color: '#4CAF50',
  },
  absentValue: {
    color: '#f44336',
  },
  percentageValue: {
    color: '#4A90D9',
  },
  percentageDetained: {
    color: '#f44336',
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  noAttendanceContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  noAttendanceIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noAttendanceTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  noAttendanceText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
  },
});
