import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../types';
import { addStudent, getClassById, getSortPreference, setSortPreference } from '../utils/storage';

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'BulkAddStudents'>;
  route: RouteProp<RootStackParamList, 'BulkAddStudents'>;
};

interface ParsedStudent {
  rollNumber: string;
  name: string;
}

export const BulkAddStudentsScreen: React.FC<Props> = ({ navigation, route }) => {
  const { classId } = route.params;
  const [inputText, setInputText] = useState('');
  const [parsedStudents, setParsedStudents] = useState<ParsedStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [className, setClassName] = useState('');
  const [sortByRoll, setSortByRoll] = useState(false);

  React.useEffect(() => {
    loadClassName();
    loadSortPreference();
  }, []);

  const loadSortPreference = async () => {
    const pref = await getSortPreference();
    setSortByRoll(pref);
  };

  const handleSortToggle = async (value: boolean) => {
    setSortByRoll(value);
    await setSortPreference(value);
  };

  const loadClassName = async () => {
    const cls = await getClassById(classId);
    setClassName(cls?.name || 'Class');
  };

  const parseInput = (text: string): ParsedStudent[] => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    const students: ParsedStudent[] = [];

    for (const line of lines) {
      // Try different separators: tab, comma, multiple spaces
      let parts: string[] = [];
      
      if (line.includes('\t')) {
        // Tab-separated (Excel default)
        parts = line.split('\t').map(p => p.trim()).filter(p => p);
      } else if (line.includes(',')) {
        // Comma-separated
        parts = line.split(',').map(p => p.trim()).filter(p => p);
      } else {
        // Space-separated (first word is roll number, rest is name)
        const match = line.match(/^(\S+)\s+(.+)$/);
        if (match) {
          parts = [match[1], match[2]];
        }
      }

      if (parts.length >= 2) {
        // Assume first part is roll number, rest is name
        const rollNumber = parts[0];
        const name = parts.slice(1).join(' ').trim();
        if (rollNumber && name) {
          students.push({ rollNumber, name });
        }
      }
    }

    return students;
  };

  const handlePreview = () => {
    const students = parseInput(inputText);
    if (students.length === 0) {
      Alert.alert(
        'No Students Found',
        'Could not parse any students from the input.\n\nMake sure each line has:\nRoll Number [TAB or COMMA] Student Name\n\nExample:\n1, John Doe\n2, Jane Smith'
      );
      return;
    }
    setParsedStudents(students);
  };

  const handleSave = async () => {
    if (parsedStudents.length === 0) {
      Alert.alert('Error', 'No students to add. Please preview first.');
      return;
    }

    setLoading(true);
    try {
      let added = 0;
      const totalStudents = parsedStudents.length;
      for (let i = 0; i < totalStudents; i++) {
        const student = parsedStudents[i];
        // Only sort on last student add to avoid multiple sorts
        const shouldSort = sortByRoll && i === totalStudents - 1;
        await addStudent(classId, student.name, student.rollNumber, shouldSort);
        added++;
      }
      Alert.alert(
        'Success',
        `Added ${added} students to ${className}`,
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to add some students');
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setInputText('');
    setParsedStudents([]);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView}>
        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>📋 Paste from Excel</Text>
          <Text style={styles.instructionText}>
            Copy your student data from Excel and paste it below.{'\n'}
            Each row should have: <Text style={styles.bold}>Roll Number</Text> and <Text style={styles.bold}>Name</Text>
          </Text>
          <Text style={styles.formatExample}>
            Supported formats:{'\n'}
            • Tab-separated (copy from Excel){'\n'}
            • Comma-separated (1, John Doe){'\n'}
            • Space-separated (1 John Doe)
          </Text>
        </View>

        {/* Input Area */}
        <Text style={styles.label}>Paste Student Data:</Text>
        <TextInput
          style={styles.textArea}
          value={inputText}
          onChangeText={(text) => {
            setInputText(text);
            setParsedStudents([]); // Clear preview when input changes
          }}
          placeholder={`Example:\n1\tJohn Doe\n2\tJane Smith\n3\tBob Wilson\n\nOr:\n1, John Doe\n2, Jane Smith`}
          placeholderTextColor="#999"
          multiline
          numberOfLines={10}
          textAlignVertical="top"
        />

        {/* Action Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.previewButton} onPress={handlePreview}>
            <Text style={styles.previewButtonText}>👁️ Preview</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        {/* Preview Section */}
        {parsedStudents.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.previewTitle}>
              ✅ Found {parsedStudents.length} students:
            </Text>
            <View style={styles.previewList}>
              {parsedStudents.map((student, index) => (
                <View key={index} style={styles.previewItem}>
                  <Text style={styles.previewRoll}>{student.rollNumber}</Text>
                  <Text style={styles.previewName}>{student.name}</Text>
                </View>
              ))}
            </View>

            <View style={styles.sortOption}>
              <View style={styles.sortOptionText}>
                <Text style={styles.sortLabel}>Sort by Roll Number</Text>
                <Text style={styles.sortHint}>
                  {sortByRoll ? 'Students will be arranged by roll number' : 'Students will be appended at the end'}
                </Text>
              </View>
              <Switch
                value={sortByRoll}
                onValueChange={handleSortToggle}
                trackColor={{ false: '#ddd', true: '#81b0ff' }}
                thumbColor={sortByRoll ? '#4A90D9' : '#f4f3f4'}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Adding...' : `Add ${parsedStudents.length} Students`}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  instructions: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    margin: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  instructionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1976d2',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  bold: {
    fontWeight: 'bold',
  },
  formatExample: {
    fontSize: 12,
    color: '#666',
    marginTop: 8,
    fontStyle: 'italic',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 8,
    padding: 16,
    fontSize: 14,
    minHeight: 200,
    borderWidth: 1,
    borderColor: '#ddd',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  buttonRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
  },
  previewButton: {
    flex: 2,
    backgroundColor: '#4A90D9',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 8,
  },
  previewButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButton: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  previewSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 12,
  },
  previewList: {
    maxHeight: 300,
  },
  previewItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  previewRoll: {
    width: 60,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4A90D9',
  },
  previewName: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  sortOptionText: {
    flex: 1,
    marginRight: 12,
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  sortHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
