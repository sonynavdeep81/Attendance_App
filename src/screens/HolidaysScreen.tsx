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
  Switch,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Holiday } from '../types';
import { getHolidays, addHoliday, deleteHoliday, getTodayDate, formatDate } from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';

const toLocalDateStr = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const HolidaysScreen: React.FC = () => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [isRange, setIsRange] = useState(false);
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [activePicker, setActivePicker] = useState<'start' | 'end' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Holiday | null>(null);
  const [saving, setSaving] = useState(false);

  const loadHolidays = useCallback(async () => {
    const data = await getHolidays();
    setHolidays(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHolidays();
    }, [loadHolidays])
  );

  const resetForm = () => {
    setNewName('');
    setIsRange(false);
    setStartDate(getTodayDate());
    setEndDate(getTodayDate());
    setActivePicker(null);
  };

  const handleAdd = async () => {
    if (!newName.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    if (isRange && endDate < startDate) {
      Alert.alert('Invalid Range', 'End date must be on or after start date.');
      return;
    }
    setSaving(true);
    try {
      await addHoliday(startDate, newName.trim(), isRange ? endDate : undefined);
      setShowAddModal(false);
      resetForm();
      loadHolidays();
    } catch {
      Alert.alert('Error', 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (deleteTarget) {
      await deleteHoliday(deleteTarget.id);
      setDeleteTarget(null);
      loadHolidays();
    }
  };

  const handlePickerChange = (_: any, date?: Date) => {
    setActivePicker(Platform.OS === 'ios' ? activePicker : null);
    if (!date) return;
    const str = toLocalDateStr(date);
    if (activePicker === 'start') setStartDate(str);
    else if (activePicker === 'end') setEndDate(str);
  };

  const renderHoliday = ({ item }: { item: Holiday }) => (
    <View style={styles.card}>
      <View style={styles.cardInfo}>
        {item.endDate ? (
          <>
            <Text style={styles.cardType}>Exam / Holiday Period</Text>
            <Text style={styles.cardDate}>{formatDate(item.date)}  →  {formatDate(item.endDate)}</Text>
          </>
        ) : (
          <Text style={styles.cardDate}>{formatDate(item.date)}</Text>
        )}
        <Text style={styles.cardName}>{item.name}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} onPress={() => setDeleteTarget(item)}>
        <Text style={styles.deleteButtonText}>🗑️</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>
          Global holidays apply to all classes and are excluded from missed attendance calculations. Use a date range for exam periods.
        </Text>
      </View>

      <FlatList
        data={holidays}
        renderItem={renderHoliday}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No holidays recorded</Text>
            <Text style={styles.emptySubtext}>Tap + to add a holiday or exam period</Text>
          </View>
        }
      />

      <TouchableOpacity style={styles.fab} onPress={() => setShowAddModal(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {/* Add Holiday Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Holiday / Exam Period</Text>

            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Mid-Semester Exams"
              value={newName}
              onChangeText={setNewName}
              autoFocus
            />

            <View style={styles.toggleRow}>
              <Text style={styles.label}>Date Range (for exam periods)</Text>
              <Switch
                value={isRange}
                onValueChange={(val) => {
                  setIsRange(val);
                  if (!val) setEndDate(startDate);
                }}
                trackColor={{ false: '#ddd', true: '#4A90D9' }}
                thumbColor="#fff"
              />
            </View>

            <Text style={styles.label}>{isRange ? 'From' : 'Date'}</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setActivePicker('start')}>
              <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>

            {isRange && (
              <>
                <Text style={styles.label}>To</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setActivePicker('end')}>
                  <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
              </>
            )}

            {activePicker !== null && (
              <DateTimePicker
                value={new Date((activePicker === 'end' ? endDate : startDate) + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handlePickerChange}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => { setShowAddModal(false); resetForm(); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAdd}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Delete Holiday"
        message={`Remove "${deleteTarget?.name}"?`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  infoBox: {
    backgroundColor: '#e3f2fd', padding: 12, margin: 12,
    borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#1976d2',
  },
  infoText: { fontSize: 13, color: '#1565c0', lineHeight: 18 },
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  card: {
    backgroundColor: '#fff', borderRadius: 8, padding: 14,
    marginBottom: 8, flexDirection: 'row', alignItems: 'center',
  },
  cardInfo: { flex: 1 },
  cardType: { fontSize: 11, color: '#f57c00', fontWeight: '700', marginBottom: 2, textTransform: 'uppercase' },
  cardDate: { fontSize: 13, color: '#4A90D9', fontWeight: '600' },
  cardName: { fontSize: 15, color: '#333', marginTop: 2 },
  deleteButton: { padding: 8 },
  deleteButtonText: { fontSize: 18 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#666' },
  emptySubtext: { fontSize: 14, color: '#999', marginTop: 4 },
  fab: {
    position: 'absolute', right: 20, bottom: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#4A90D9', alignItems: 'center', justifyContent: 'center', elevation: 4,
  },
  fabText: { fontSize: 32, color: '#fff', lineHeight: 36 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 14,
  },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  dateButton: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
  },
  dateButtonText: { fontSize: 15, color: '#333' },
  modalButtons: { flexDirection: 'row', gap: 10, marginTop: 6 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#4A90D9' },
  saveButtonText: { color: '#fff', fontWeight: '600' },
});
