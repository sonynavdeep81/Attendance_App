import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { RootStackParamList, Class, ClassCancellation } from '../types';
import {
  getClassById,
  addSchedulePeriod,
  getMissedDates,
  getCancellationsByClass,
  addCancellation,
  deleteCancellation,
  getTodayDate,
  formatDate,
} from '../utils/storage';
import { ConfirmDialog } from '../components/ConfirmDialog';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ClassSchedule'>;
  route: RouteProp<RootStackParamList, 'ClassSchedule'>;
};

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const ClassScheduleScreen: React.FC<Props> = ({ route }) => {
  const { classId } = route.params;
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [missedDates, setMissedDates] = useState<string[]>([]);
  const [cancellations, setCancellations] = useState<ClassCancellation[]>([]);

  // Add period modal
  const [showAddPeriod, setShowAddPeriod] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [periodStartDate, setPeriodStartDate] = useState(getTodayDate());
  const [showPeriodDatePicker, setShowPeriodDatePicker] = useState(false);
  const [savingPeriod, setSavingPeriod] = useState(false);

  // Add cancellation modal
  const [showAddCancellation, setShowAddCancellation] = useState(false);
  const [cancelDate, setCancelDate] = useState(getTodayDate());
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelDatePicker, setShowCancelDatePicker] = useState(false);
  const [savingCancellation, setSavingCancellation] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ClassCancellation | null>(null);

  const loadData = useCallback(async () => {
    const cls = await getClassById(classId);
    setClassInfo(cls || null);
    const missed = await getMissedDates(classId);
    setMissedDates(missed);
    const cans = await getCancellationsByClass(classId);
    setCancellations(cans);
  }, [classId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const toggleDay = (day: string) => {
    setSelectedDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleAddPeriod = async () => {
    if (selectedDays.size === 0) {
      Alert.alert('Required', 'Select at least one day.');
      return;
    }
    setSavingPeriod(true);
    try {
      const orderedDays = ALL_DAYS.filter((d) => selectedDays.has(d));
      await addSchedulePeriod(classId, orderedDays, periodStartDate);
      setShowAddPeriod(false);
      setSelectedDays(new Set());
      setPeriodStartDate(getTodayDate());
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to save schedule.');
    } finally {
      setSavingPeriod(false);
    }
  };

  const handleAddCancellation = async () => {
    setSavingCancellation(true);
    try {
      await addCancellation(classId, cancelDate, cancelReason.trim() || undefined);
      setShowAddCancellation(false);
      setCancelDate(getTodayDate());
      setCancelReason('');
      loadData();
    } catch {
      Alert.alert('Error', 'Failed to save cancellation.');
    } finally {
      setSavingCancellation(false);
    }
  };

  const confirmDeleteCancellation = async () => {
    if (deleteTarget) {
      await deleteCancellation(deleteTarget.id);
      setDeleteTarget(null);
      loadData();
    }
  };

  const DAY_NAMES_OF_WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* ── Schedule Periods ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Schedule Periods</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddPeriod(true)}>
            <Text style={styles.addButtonText}>+ Add Period</Text>
          </TouchableOpacity>
        </View>

        {!classInfo?.schedulePeriods || classInfo.schedulePeriods.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No schedule set yet.</Text>
            <Text style={styles.emptySubtext}>Tap "Add Period" to set the days this class meets.</Text>
          </View>
        ) : (
          [...classInfo.schedulePeriods]
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
            .map((period, idx, arr) => (
              <View key={idx} style={styles.periodCard}>
                <Text style={styles.periodDays}>{period.days.join(', ')}</Text>
                <Text style={styles.periodDate}>
                  From: {formatDate(period.startDate)}
                  {idx + 1 < arr.length ? `  →  Until: ${formatDate(arr[idx + 1].startDate)}` : '  →  Present'}
                </Text>
              </View>
            ))
        )}
      </View>

      {/* ── Missed Attendance Dates ── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Missed Attendance Dates</Text>
        {(!classInfo?.schedulePeriods || classInfo.schedulePeriods.length === 0) ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Set a schedule to see missed dates.</Text>
          </View>
        ) : missedDates.length === 0 ? (
          <View style={[styles.emptyCard, styles.successCard]}>
            <Text style={styles.successText}>No missed dates</Text>
          </View>
        ) : (
          <View style={styles.missedCard}>
            <Text style={styles.missedCount}>{missedDates.length} missed date{missedDates.length > 1 ? 's' : ''}</Text>
            {missedDates.map((dateStr) => {
              const d = new Date(dateStr + 'T00:00:00');
              return (
                <View key={dateStr} style={styles.missedRow}>
                  <Text style={styles.missedDay}>{DAY_NAMES_OF_WEEK[d.getDay()]}</Text>
                  <Text style={styles.missedDate}>{formatDate(dateStr)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>

      {/* ── Per-Class Cancellations ── */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Class Cancellations</Text>
          <TouchableOpacity style={styles.addButton} onPress={() => setShowAddCancellation(true)}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.sectionSubtext}>
          Dates when this specific class was cancelled (excluded from missed dates).
        </Text>

        {cancellations.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No cancellations recorded.</Text>
          </View>
        ) : (
          cancellations.map((c) => (
            <View key={c.id} style={styles.cancellationCard}>
              <View style={styles.cancellationInfo}>
                <Text style={styles.cancellationDate}>{formatDate(c.date)}</Text>
                {c.reason ? <Text style={styles.cancellationReason}>{c.reason}</Text> : null}
              </View>
              <TouchableOpacity style={styles.deleteButton} onPress={() => setDeleteTarget(c)}>
                <Text style={styles.deleteButtonText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* ── Add Period Modal ── */}
      <Modal visible={showAddPeriod} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Schedule Period</Text>
            <Text style={styles.label}>Days this class meets</Text>
            <View style={styles.daysRow}>
              {ALL_DAYS.map((day, i) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, selectedDays.has(day) && styles.dayChipSelected]}
                  onPress={() => toggleDay(day)}
                >
                  <Text style={[styles.dayChipText, selectedDays.has(day) && styles.dayChipTextSelected]}>
                    {DAY_SHORT[i]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Effective from</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowPeriodDatePicker(true)}>
              <Text style={styles.dateButtonText}>{formatDate(periodStartDate)}</Text>
            </TouchableOpacity>
            {showPeriodDatePicker && (
              <DateTimePicker
                value={new Date(periodStartDate + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowPeriodDatePicker(Platform.OS === 'ios');
                  if (date) setPeriodStartDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
                }}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => { setShowAddPeriod(false); setSelectedDays(new Set()); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddPeriod}
                disabled={savingPeriod}
              >
                <Text style={styles.saveButtonText}>{savingPeriod ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Add Cancellation Modal ── */}
      <Modal visible={showAddCancellation} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Cancel a Class Date</Text>

            <Text style={styles.label}>Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowCancelDatePicker(true)}>
              <Text style={styles.dateButtonText}>{formatDate(cancelDate)}</Text>
            </TouchableOpacity>
            {showCancelDatePicker && (
              <DateTimePicker
                value={new Date(cancelDate + 'T00:00:00')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(_, date) => {
                  setShowCancelDatePicker(Platform.OS === 'ios');
                  if (date) setCancelDate(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`);
                }}
              />
            )}

            <Text style={styles.label}>Reason (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Teacher absent"
              value={cancelReason}
              onChangeText={setCancelReason}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => { setShowAddCancellation(false); setCancelReason(''); }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleAddCancellation}
                disabled={savingCancellation}
              >
                <Text style={styles.saveButtonText}>{savingCancellation ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={deleteTarget !== null}
        title="Remove Cancellation"
        message={`Remove the cancellation for ${deleteTarget ? formatDate(deleteTarget.date) : ''}?`}
        onConfirm={confirmDeleteCancellation}
        onCancel={() => setDeleteTarget(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 12, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  sectionSubtext: { fontSize: 12, color: '#888', marginBottom: 8, marginTop: -4 },
  addButton: {
    backgroundColor: '#e3f2fd', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
  },
  addButtonText: { color: '#1976d2', fontSize: 13, fontWeight: '600' },
  emptyCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 16, alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#888' },
  emptySubtext: { fontSize: 12, color: '#aaa', marginTop: 4, textAlign: 'center' },
  successCard: { backgroundColor: '#e6f4ea' },
  successText: { fontSize: 14, color: '#137333', fontWeight: '600' },
  periodCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8,
    borderLeftWidth: 4, borderLeftColor: '#4A90D9',
  },
  periodDays: { fontSize: 15, fontWeight: '600', color: '#333' },
  periodDate: { fontSize: 12, color: '#888', marginTop: 4 },
  missedCard: {
    backgroundColor: '#fff3e0', borderRadius: 8, padding: 12,
    borderLeftWidth: 4, borderLeftColor: '#f57c00',
  },
  missedCount: { fontSize: 14, fontWeight: '700', color: '#e65100', marginBottom: 8 },
  missedRow: { flexDirection: 'row', marginBottom: 4 },
  missedDay: { fontSize: 13, fontWeight: '600', color: '#555', width: 90 },
  missedDate: { fontSize: 13, color: '#333' },
  cancellationCard: {
    backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center',
  },
  cancellationInfo: { flex: 1 },
  cancellationDate: { fontSize: 14, fontWeight: '600', color: '#4A90D9' },
  cancellationReason: { fontSize: 13, color: '#666', marginTop: 2 },
  deleteButton: { padding: 8 },
  deleteButtonText: { fontSize: 18 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20,
  },
  modalContent: { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: '#333', marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 8 },
  daysRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  dayChip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: '#ddd', backgroundColor: '#f5f5f5',
  },
  dayChipSelected: { backgroundColor: '#4A90D9', borderColor: '#4A90D9' },
  dayChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  dayChipTextSelected: { color: '#fff' },
  dateButton: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  dateButtonText: { fontSize: 15, color: '#333' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 16,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  cancelButton: { backgroundColor: '#f0f0f0' },
  cancelButtonText: { color: '#666', fontWeight: '600' },
  saveButton: { backgroundColor: '#4A90D9' },
  saveButtonText: { color: '#fff', fontWeight: '600' },
});
