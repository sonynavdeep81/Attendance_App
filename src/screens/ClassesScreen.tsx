import React, { useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
  InteractionManager,
  Modal,
} from 'react-native';
import { Text } from '../components/AppText';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import JSZip from 'jszip';
import { Class, RootStackParamList } from '../types';
import { getClasses, deleteClass, getStudentsByClass, getAttendanceByClass, exportAllClassesToXLS, exportAllDetaineeLists, exportData, importData, clearAllData } from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';

const todayDateStr = () => {
  const today = new Date();
  return `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
};

// Writes (mobile) or downloads (web) a single file and shares it.
const shareOrDownloadFile = async (content: string, filename: string, mimeType: string, dialogTitle: string) => {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Alert.alert('Export Successful', `File "${filename}" downloaded!`);
  } else {
    const fileUri = FileSystem.documentDirectory + filename;
    await FileSystem.writeAsStringAsync(fileUri, content, { encoding: FileSystem.EncodingType.UTF8 });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, { mimeType, dialogTitle });
    } else {
      Alert.alert('Success', `File saved to: ${fileUri}`);
    }
  }
};

// Bundles multiple files into one .zip and shares/downloads it in a single step.
const shareOrDownloadZip = async (files: { filename: string; content: string }[], zipFilename: string) => {
  const zip = new JSZip();
  files.forEach((f) => zip.file(f.filename, f.content));

  if (Platform.OS === 'web') {
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFilename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Alert.alert('Export Successful', `File "${zipFilename}" downloaded!`);
  } else {
    const base64Zip = await zip.generateAsync({ type: 'base64' });
    const fileUri = FileSystem.documentDirectory + zipFilename;
    await FileSystem.writeAsStringAsync(fileUri, base64Zip, { encoding: FileSystem.EncodingType.Base64 });
    const isAvailable = await Sharing.isAvailableAsync();
    if (isAvailable) {
      await Sharing.shareAsync(fileUri, { mimeType: 'application/zip', dialogTitle: 'Save Export Files' });
    } else {
      Alert.alert('Success', `File saved to: ${fileUri}`);
    }
  }
};

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList>;
};

type ExportType = 'all' | 'detainedOnly' | 'detaineeList' | 'backup';

export const ClassesScreen: React.FC<Props> = ({ navigation }) => {
  const [classes, setClasses] = useState<Class[]>([]);
  const [classInfo, setClassInfo] = useState<{ [key: string]: { students: number; classes: number } }>({});
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedExportTypes, setSelectedExportTypes] = useState<Set<ExportType>>(new Set());

  const loadClasses = useCallback(async () => {
    const data = await getClasses();
    setClasses(data);

    // Load additional info for each class in parallel
    const infoEntries = await Promise.all(
      data.map(async (cls) => {
        const [students, attendance] = await Promise.all([
          getStudentsByClass(cls.id),
          getAttendanceByClass(cls.id),
        ]);
        return [cls.id, { students: students.length, classes: attendance.length }] as const;
      })
    );
    setClassInfo(Object.fromEntries(infoEntries));
  }, []);

  // Generates the content for one export type, without writing/sharing it yet.
  const buildExportContent = async (type: ExportType): Promise<{ filename: string; content: string; mimeType: string }> => {
    switch (type) {
      case 'all': {
        const { xls, filename } = await exportAllClassesToXLS(false);
        return { filename, content: xls, mimeType: 'application/vnd.ms-excel' };
      }
      case 'detainedOnly': {
        const { xls, filename } = await exportAllClassesToXLS(true);
        return { filename, content: xls, mimeType: 'application/vnd.ms-excel' };
      }
      case 'detaineeList': {
        const { xls, filename } = await exportAllDetaineeLists();
        return { filename, content: xls, mimeType: 'application/vnd.ms-excel' };
      }
      case 'backup': {
        const jsonData = await exportData();
        return { filename: `Backup_${todayDateStr()}.json`, content: jsonData, mimeType: 'application/json' };
      }
    }
  };

  const performRestoreFromBackup = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      if (!file || !file.uri) return;

      setImporting(true);

      let content: string;
      if (Platform.OS === 'web') {
        const response = await fetch(file.uri);
        content = await response.text();
      } else {
        content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
      }

      let data: any;
      try {
        data = JSON.parse(content);
      } catch {
        Alert.alert('Invalid File', 'Please select a JSON backup file generated by this app.');
        return;
      }

      if (!data.classes || !data.students || !data.attendance) {
        Alert.alert('Invalid File', 'Please select a JSON backup file generated by this app.');
        return;
      }

      Alert.alert(
        'Restore Backup',
        'This will replace all current data (classes, students, attendance, holidays, schedule, cancellations) with the backup. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: async () => {
              try {
                await importData(content);
                loadClasses();
                Alert.alert('Success', 'All data restored from backup.');
              } catch {
                Alert.alert('Error', 'Failed to restore backup.');
              }
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to read backup file.');
    } finally {
      setImporting(false);
    }
  }, [loadClasses]);

  const performFullReset = useCallback(() => {
    Alert.alert(
      '⚠️ Full Reset',
      'This will permanently delete ALL data — classes, students, attendance, holidays, schedules, and remarks. This cannot be undone.\n\nAre you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes, Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Final Confirmation',
              'Last chance. All your data will be gone forever. Proceed?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'RESET',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await clearAllData();
                      loadClasses();
                      Alert.alert('Done', 'All data has been cleared.');
                    } catch {
                      Alert.alert('Error', 'Failed to reset data.');
                    }
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }, [loadClasses]);

  const handleExportAll = useCallback(() => {
    if (classes.length === 0) {
      Alert.alert('No Classes', 'There are no classes to export.');
      return;
    }
    setSelectedExportTypes(new Set<ExportType>(['all', 'detainedOnly', 'detaineeList', 'backup']));
    setShowExportModal(true);
  }, [classes]);

  const toggleExportType = (type: ExportType) => {
    setSelectedExportTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const runSelectedExports = useCallback(async () => {
    if (selectedExportTypes.size === 0) {
      Alert.alert('Nothing Selected', 'Select at least one export option.');
      return;
    }
    setShowExportModal(false);
    setExporting(true);
    try {
      const order: ExportType[] = ['all', 'detainedOnly', 'detaineeList', 'backup'];
      const chosen = order.filter((t) => selectedExportTypes.has(t));
      const files = await Promise.all(chosen.map(buildExportContent));

      if (files.length === 1) {
        const { filename, content, mimeType } = files[0];
        await shareOrDownloadFile(content, filename, mimeType, 'Save Export File');
      } else {
        await shareOrDownloadZip(files, `Attendance_Export_${todayDateStr()}.zip`);
      }
    } catch (error) {
      console.error('Export error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to export data.';
      Alert.alert('Error', errorMessage);
    } finally {
      setExporting(false);
    }
  }, [selectedExportTypes]);

  const handleImport = useCallback(() => {
    setShowImportModal(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadClasses();
      });
      return () => task.cancel();
    }, [loadClasses])
  );

  React.useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.headerButtonText}>⚙️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.navigate('Holidays')}
          >
            <Text style={styles.headerButtonText}>🗓️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleImport}
            disabled={importing}
          >
            <Text style={styles.headerButtonText}>
              {importing ? '⏳' : '📥'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleExportAll}
            disabled={exporting}
          >
            <Text style={styles.headerButtonText}>
              {exporting ? '⏳' : '📤'}
            </Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, exporting, handleExportAll, importing, handleImport]);

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

      {/* Export Modal */}
      <Modal visible={showExportModal} transparent animationType="fade" onRequestClose={() => setShowExportModal(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowExportModal(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Export / Backup</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => toggleExportType('all')}>
              <Text style={styles.checkboxRowText}>
                {selectedExportTypes.has('all') ? '☑️' : '⬜'}  All Students (XLS)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => toggleExportType('detainedOnly')}>
              <Text style={styles.checkboxRowText}>
                {selectedExportTypes.has('detainedOnly') ? '☑️' : '⬜'}  Detained Only (XLS)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => toggleExportType('detaineeList')}>
              <Text style={styles.checkboxRowText}>
                {selectedExportTypes.has('detaineeList') ? '☑️' : '⬜'}  Detainee List (XLS)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => toggleExportType('backup')}>
              <Text style={styles.checkboxRowText}>
                {selectedExportTypes.has('backup') ? '☑️' : '⬜'}  Full Backup (JSON)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={runSelectedExports}>
              <Text style={[styles.menuItemText, styles.menuItemPrimary]}>Export Selected</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setShowExportModal(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Import Modal */}
      <Modal visible={showImportModal} transparent animationType="fade" onRequestClose={() => setShowImportModal(false)}>
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setShowImportModal(false)}>
          <View style={styles.menuSheet}>
            <Text style={styles.menuTitle}>Import / Restore</Text>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowImportModal(false); performRestoreFromBackup(); }}>
              <Text style={styles.menuItemText}>Restore JSON Backup</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setShowImportModal(false); performFullReset(); }}>
              <Text style={[styles.menuItemText, styles.menuItemDestructive]}>⚠️ Full Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.menuCancel]} onPress={() => setShowImportModal(false)}>
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

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
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  menuItem: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuItemText: {
    fontSize: 16,
    color: '#333',
  },
  menuItemDestructive: {
    color: '#d32f2f',
  },
  menuCancel: {
    borderBottomWidth: 0,
    backgroundColor: '#f5f5f5',
  },
  menuCancelText: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  menuItemPrimary: {
    color: '#1976d2',
    fontWeight: '700',
  },
  checkboxRowText: {
    fontSize: 16,
    color: '#333',
  },
  headerButtons: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  headerButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 4,
  },
  headerButtonText: {
    color: '#4A90D9',
    fontSize: 14,
    fontWeight: '600',
  },
});
