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
import { RootStackParamList, ClassAttendanceStats } from '../types';
import { getClasses, calculateClassStats } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export const StatisticsScreen: React.FC<Props> = ({ navigation }) => {
  const [classStats, setClassStats] = useState<ClassAttendanceStats[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const classes = await getClasses();
    const statsPromises = classes.map((cls) => calculateClassStats(cls.id));
    const allStats = await Promise.all(statsPromises);
    setClassStats(allStats.filter((s): s is ClassAttendanceStats => s !== null));
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

  const totalDetained = classStats.reduce((sum, cs) => sum + cs.detainedCount, 0);
  const totalStudents = classStats.reduce((sum, cs) => sum + cs.totalStudents, 0);

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
              {avgAttendance.toFixed(1)}%
            </Text>
            <Text style={styles.statLabel}>Avg Attendance</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          <View style={[styles.summaryItem, totalDetained > 0 && styles.summaryItemWarning]}>
            <Text style={[styles.summaryValue, totalDetained > 0 && styles.summaryValueWarning]}>
              {totalDetained}
            </Text>
            <Text style={styles.summaryLabel}>Detained</Text>
          </View>
        </View>
      </View>

      {/* Class List */}
      <Text style={styles.sectionTitle}>Class-wise Statistics</Text>
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
  summaryItemWarning: {
    backgroundColor: 'rgba(255,152,0,0.3)',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryValueWarning: {
    color: '#ffeb3b',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    padding: 16,
    paddingBottom: 8,
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
