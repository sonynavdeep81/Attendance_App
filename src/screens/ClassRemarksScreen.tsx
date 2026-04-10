import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList, ClassRemark } from '../types';
import {
  getRemarksByClass,
  addRemark,
  deleteRemark,
  getClassById,
  formatDate,
} from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClassRemarks'>;
  route: RouteProp<RootStackParamList, 'ClassRemarks'>;
};

export const ClassRemarksScreen: React.FC<Props> = ({ route }) => {
  const { classId } = route.params;
  const [className, setClassName] = useState('');
  const [remarks, setRemarks] = useState<ClassRemark[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarkText, setRemarkText] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClassRemark | null>(null);

  const loadData = useCallback(async () => {
    const cls = await getClassById(classId);
    setClassName(cls?.name || 'Class');
    const data = await getRemarksByClass(classId);
    setRemarks(data);
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

  const handleAdd = async () => {
    if (!remarkText.trim()) {
      Alert.alert('Error', 'Please enter a remark.');
      return;
    }
    await addRemark(classId, selectedDate, remarkText.trim());
    setRemarkText('');
    setSelectedDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(false);
    loadData();
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteRemark(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    }
  };

  const handleWebDateChange = (dateString: string) => {
    if (dateString && /^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      setSelectedDate(dateString);
    }
  };

  const renderRemarkItem = ({ item }: { item: ClassRemark }) => (
    <View style={styles.remarkCard}>
      <View style={styles.remarkContent}>
        <Text style={styles.remarkDate}>{formatDate(item.date)}</Text>
        <Text style={styles.remarkText}>{item.remark}</Text>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => setDeleteTarget(item)}
      >
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{className}</Text>
        <Text style={styles.headerSubtitle}>Remarks</Text>
      </View>

      <FlatList
        data={remarks}
        renderItem={renderRemarkItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📝</Text>
            <Text style={styles.emptyText}>No remarks yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add holidays, notes, etc.</Text>
          </View>
        }
      />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setSelectedDate(new Date().toISOString().split('T')[0]);
          setRemarkText('');
          setShowAddModal(true);
        }}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Remark Modal */}
      <Modal
        visible={showAddModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlayTouchable}
            activeOpacity={1}
            onPress={() => setShowAddModal(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Remark</Text>

            {/* Date picker */}
            <Text style={styles.fieldLabel}>Date</Text>
            {Platform.OS === 'web' ? (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleWebDateChange(e.target.value)}
                style={{
                  fontSize: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  backgroundColor: '#f5f5f5',
                  width: '100%',
                  cursor: 'pointer',
                }}
              />
            ) : (
              <>
                {!showDatePicker ? (
                  <TouchableOpacity
                    style={styles.dateDisplay}
                    onPress={() => setShowDatePicker(true)}
                  >
                    <Text style={styles.dateDisplayText}>{formatDate(selectedDate)}</Text>
                    <Text style={styles.dateDisplayHint}>📅 Tap to change</Text>
                  </TouchableOpacity>
                ) : (
                  <DateTimePicker
                    value={new Date(selectedDate + 'T12:00:00')}
                    mode="date"
                    display="calendar"
                    onChange={(event, date) => {
                      setShowDatePicker(false);
                      if (date) {
                        setSelectedDate(date.toISOString().split('T')[0]);
                      }
                    }}
                  />
                )}
              </>
            )}

            {/* Remark text */}
            <Text style={styles.fieldLabel}>Remark</Text>
            <TextInput
              style={styles.remarkInput}
              value={remarkText}
              onChangeText={setRemarkText}
              placeholder="e.g., Holiday - Diwali"
              placeholderTextColor="#999"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            {/* Buttons */}
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowAddModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleAdd}
              >
                <Text style={styles.saveButtonText}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Remark"
        message={`Delete remark for ${deleteTarget ? formatDate(deleteTarget.date) : ''}?`}
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
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  remarkCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: '#4A90D9',
  },
  remarkContent: {
    flex: 1,
  },
  remarkDate: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A90D9',
    marginBottom: 4,
  },
  remarkText: {
    fontSize: 16,
    color: '#333',
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  deleteButtonText: {
    fontSize: 18,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
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
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 6,
    marginTop: 12,
  },
  dateDisplay: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  dateDisplayText: {
    fontSize: 16,
    color: '#333',
  },
  dateDisplayHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  remarkInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    minHeight: 80,
    paddingTop: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#4A90D9',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
