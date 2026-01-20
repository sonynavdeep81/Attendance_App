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
import { Class, RootStackParamList } from '../types';
import { getClasses, deleteClass, getStudentsByClass, getAttendanceByClass } from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

export const ClassesScreen: React.FC<Props> = ({ navigation }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classInfo, setClassInfo] = useState<{ [key: string]: { students: number; classes: number } }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null);

  const loadClasses = useCallback(async () => {
    const data = await getClasses();
    setClasses(data);

    // Load additional info for each class
    const info: { [key: string]: { students: number; classes: number } } = {};
    for (const cls of data) {
      const students = await getStudentsByClass(cls.id);
      const attendance = await getAttendanceByClass(cls.id);
      info[cls.id] = { students: students.length, classes: attendance.length };
    }
    setClassInfo(info);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadClasses();
    }, [loadClasses])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadClasses();
    setRefreshing(false);
  };

  const handleDeleteClass = (classItem: Class) => {
    setDeleteTarget(classItem);
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteClass(deleteTarget.id);
      setDeleteTarget(null);
      loadClasses();
    }
  };

  const renderClassItem = ({ item }: { item: Class }) => {
    const info = classInfo[item.id] || { students: 0, classes: 0 };
    
    return (
      <View style={styles.classCard}>
        <TouchableOpacity
          style={styles.classContent}
          onPress={() => navigation.navigate('ClassDetails', { classId: item.id })}
        >
          <View style={styles.classHeader}>
            <Text style={styles.className}>{item.name}</Text>
            {item.subject && <Text style={styles.classSubject}>{item.subject}</Text>}
          </View>
          <View style={styles.classStats}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{info.students}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{info.classes}</Text>
              <Text style={styles.statLabel}>Classes</Text>
            </View>
          </View>
        </TouchableOpacity>
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate('EditClass', { classId: item.id })}
          >
            <Text style={styles.editButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteClass(item)}
          >
            <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={classes}
        renderItem={renderClassItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No classes yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add a class</Text>
          </View>
        }
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('AddClass')}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Class"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This will also delete all students and attendance records.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  classCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    overflow: 'hidden',
  },
  classContent: {
    padding: 16,
  },
  classHeader: {
    marginBottom: 12,
  },
  className: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  classSubject: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  classStats: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#f9f9f9',
  },
  editButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#eee',
  },
  editButtonText: {
    color: '#4A90D9',
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#f44336',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 32,
    color: '#fff',
    lineHeight: 36,
  },
});
