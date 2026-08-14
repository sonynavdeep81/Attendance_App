import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Platform,
  Alert,
} from 'react-native';
import { Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { RootStackParamList, ClassAttendanceStats } from '../types';
import { getClasses, getStudentsByClass, calculateClassStats, formatRollNumberRanges } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

type RollSummaryEntry = {
  classId: string;
  className: string;
  rollNos: string;
};

export const StatisticsScreen: React.FC<Props> = ({ navigation }) => {
  const [classStats, setClassStats] = useState<ClassAttendanceStats[]>([]);
  const [theoryClassIds, setTheoryClassIds] = useState<Set<string>>(new Set());
  const [rollSummary, setRollSummary] = useState<RollSummaryEntry[]>([]);
  const [showRollSummary, setShowRollSummary] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const classes = await getClasses();
    const statsPromises = classes.map((cls) => calculateClassStats(cls.id));
    const allStats = await Promise.all(statsPromises);
    setClassStats(allStats.filter((s): s is ClassAttendanceStats => s !== null));

    const theoryClasses = classes.filter((c) => (c.classType || 'theory') === 'theory');
    setTheoryClassIds(new Set(theoryClasses.map((c) => c.id)));
    const summaryPromises = theoryClasses.map(async (cls) => {
      const students = await getStudentsByClass(cls.id, true);
      return {
        classId: cls.id,
        className: cls.name,
        rollNos: formatRollNumberRanges(students.map((s) => s.rollNumber)),
      };
    });
    setRollSummary(await Promise.all(summaryPromises));
  }, []);

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

  const handleShareRollSummary = async () => {
    const content = rollSummary
      .filter((entry) => entry.rollNos)
      .map((entry) => `Class ${entry.className}\n\nRoll nos: ${entry.rollNos}`)
      .join('\n\n\n');
    const filename = `roll_numbers_${Date.now()}.txt`;

    if (Platform.OS === 'web') {
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const fileUri = FileSystem.documentDirectory + filename;
      await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, { mimeType: 'text/plain', dialogTitle: 'Share Roll Numbers' });
      } else {
        Alert.alert('Success', `File saved to: ${fileUri}`);
      }
    }
  };

  // Only count theory classes — the same students also appear in their lab sections,
  // so including labs here would double-count students in these totals.
  const theoryStats = classStats.filter((cs) => theoryClassIds.has(cs.classId));
  const totalStudents = theoryStats.reduce((sum, cs) => sum + cs.totalStudents, 0);

  const renderClassStat = ({ item }: { item: ClassAttendanceStats }) => {
    const avgAttendance = item.studentStats.length > 0
      ? item.studentStats.reduce((sum, s) => sum + s.attendancePercentage, 0) / item.studentStats.length
      : 100;

    return (
      <TouchableOpacity
        style={styles.statCard}
        onPress={() => navigation.navigate('ClassStats', { classId: item.classId })}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.className}>{item.className}</Text>
          {item.detainedCount > 0 && (
            <View style={styles.detainedBadge}>
              <Text style={styles.detainedText}>{item.detainedCount} Detained</Text>
            </View>
          )}
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.totalStudents}</Text>
            <Text style={styles.statLabel}>Students</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{item.totalClassesConducted}</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[
              styles.statValue,
              avgAttendance < 75 && styles.statValueWarning
            ]}>
              {item.totalClassesConducted > 0 ? `${avgAttendance.toFixed(1)}%` : '—'}
            </Text>
            <Text style={styles.statLabel}>Avg Attendance</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderRollSummary = ({ item }: { item: RollSummaryEntry }) => (
    <View style={styles.statCard}>
      <Text style={styles.className}>Class {item.className}</Text>
      <Text style={styles.rollNosText}>
        Roll nos: {item.rollNos || '—'}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Overall Summary */}
      <View style={styles.summaryHeader}>
        <Text style={styles.summaryTitle}>Overall Statistics</Text>
        <View style={styles.summaryStats}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{classStats.length}</Text>
            <Text style={styles.summaryLabel}>Classes</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{totalStudents}</Text>
            <Text style={styles.summaryLabel}>Total Students</Text>
          </View>
        </View>
      </View>

      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>
          {showRollSummary ? 'Roll No. Summary (Theory Classes)' : 'Class-wise Statistics'}
        </Text>
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setShowRollSummary((prev) => !prev)}
        >
          <Text style={styles.toggleButtonText}>
            {showRollSummary ? 'Show Stats' : 'Roll No. List'}
          </Text>
        </TouchableOpacity>
      </View>

      {showRollSummary && rollSummary.length > 0 && (
        <TouchableOpacity style={styles.shareButton} onPress={handleShareRollSummary}>
          <Text style={styles.shareButtonText}>Share Roll No. List</Text>
        </TouchableOpacity>
      )}

      {showRollSummary ? (
        <FlatList
          data={rollSummary}
          renderItem={renderRollSummary}
          keyExtractor={(item) => item.classId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No theory classes yet</Text>
              <Text style={styles.emptySubtext}>Mark classes as "Theory" to see them here</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={classStats}
          renderItem={renderClassStat}
          keyExtractor={(item) => item.classId}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No classes created yet</Text>
              <Text style={styles.emptySubtext}>Go to Classes tab to add classes</Text>
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
  summaryHeader: {
    backgroundColor: '#4A90D9',
    padding: 20,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  summaryStats: {
    flexDirection: 'row',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    flex: 1,
  },
  toggleButton: {
    backgroundColor: '#4A90D9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  shareButton: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#e8f0fb',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '600',
  },
  rollNosText: {
    fontSize: 14,
    color: '#444',
    marginTop: 6,
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  detainedBadge: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  detainedText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  statValueWarning: {
    color: '#ff9800',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
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
