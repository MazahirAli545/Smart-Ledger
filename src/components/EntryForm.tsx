// EntryForm.tsx
// React Native component for adding entries with audio recording, file upload, and NLP auto-fill.
// Dependencies: @react-native-picker/picker, @react-native-community/datetimepicker, react-native-audio-recorder-player, react-native-document-picker, words-to-numbers
// Usage: import EntryForm from './EntryForm';
//
// Make sure to handle permissions for microphone and file access in your app.
//
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import DocumentPicker from '@react-native-documents/picker';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { wordsToNumbers } from 'words-to-numbers';
import { BASE_URL } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const categories = [
  'client income',
  'freelancer income',
  'staff salary',
  'attendance',
  'other',
];

// AudioRecorderPlayer instantiation (fix for TS):
const audioRecorderPlayer = new AudioRecorderPlayer();

interface EntryFormProps {
  onEntryAdded?: () => void;
}

export default function EntryForm({ onEntryAdded }: EntryFormProps) {
  const [type, setType] = useState('income');
  const [category, setCategory] = useState('client income');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordedFilePath, setRecordedFilePath] = useState('');
  const [provider, setProvider] = useState('google');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  // Audio recording
  const startRecording = async () => {
    setError('');
    setSuccess('');
    setText('');
    try {
      // Request permission on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message:
              'This app needs access to your microphone to record audio.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setError('Microphone permission denied');
          setIsRecording(false);
          return;
        }
      }
      setIsRecording(true);
      const result = await audioRecorderPlayer.startRecorder();
      setRecordedFilePath(result);
    } catch (err) {
      setError(
        'Failed to start recording: ' +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      const result = await audioRecorderPlayer.stopRecorder();
      setIsRecording(false);
      setRecordedFilePath(result);
      if (result) {
        await sendAudioForTranscription(result);
      }
    } catch (err) {
      setError(
        'Failed to stop recording: ' +
          (err instanceof Error ? err.message : String(err)),
      );
      setIsRecording(false);
    }
  };

  // File upload
  const handleFileUpload = async () => {
    setError('');
    setSuccess('');
    setText('');
    try {
      const res = await DocumentPicker.pick({
        type: [DocumentPicker.types.audio],
      });
      if (res && res[0] && res[0].uri) {
        await sendAudioForTranscription(
          res[0].uri,
          res[0].type ?? 'audio/wav',
          res[0].name ?? 'audio.wav',
        );
      }
    } catch (err) {
      // Fallback: check error code for cancellation
      if (
        !(
          err &&
          typeof err === 'object' &&
          'code' in err &&
          (err as any).code === 'DOCUMENT_PICKER_CANCELED'
        )
      ) {
        setError(
          'File upload failed: ' +
            (err instanceof Error ? err.message : String(err)),
        );
      }
    }
  };

  // Send audio to backend
  const sendAudioForTranscription = async (
    uri: string,
    mimeType: string = 'audio/wav',
    fileName: string = 'audio.wav',
  ) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: Platform.OS === 'android' ? uri : uri.replace('file://', ''),
        name: fileName,
        type: mimeType,
      } as any); // RN FormData file type
      // formData.append('languageCode', 'hi-IN'); // If your API expects this, uncomment
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');
      const url = `${BASE_URL}/api/whisper/transcribe`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Speech recognition failed');
      if (data.amount) setAmount(data.amount);
      if (data.type) setType(data.type);
      if (data.category) setCategory(data.category);
      if (data.text) setDescription(data.text);
      if (data.englishText) setText(data.englishText);
      else if (data.text) setText(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setLoading(false);
  };

  // NLP auto-fill
  function autoFillFormFromText(text: string) {
    const lower = text.toLowerCase();
    const normalizedRaw = wordsToNumbers(text);
    const normalized =
      typeof normalizedRaw === 'string' ? normalizedRaw : String(normalizedRaw);
    const detected = {
      type:
        lower.includes('received') ||
        lower.includes('credited') ||
        lower.includes('income')
          ? 'income'
          : 'expense',
      amount: '',
      description: '',
      category: 'other',
    };
    const amountMatch = normalized.match(/([\d,]+(?:\.\d+)?)/);
    if (amountMatch) detected.amount = amountMatch[1].replace(/,/g, '');
    const partyMatch = text.match(/\b(?:from|by|to|via)\s(.+?)(?:\.|$)/i);
    if (partyMatch) detected.description = partyMatch[1].trim();
    if (lower.includes('salary') || lower.includes('wage'))
      detected.category = 'staff salary';
    else if (lower.includes('attendance')) detected.category = 'attendance';
    else if (lower.includes('client')) detected.category = 'client income';
    else if (lower.includes('freelancer') || lower.includes('contractor'))
      detected.category = 'freelancer income';
    return detected;
  }

  useEffect(() => {
    if (text) {
      const { type, amount, description, category } =
        autoFillFormFromText(text);
      setType(type);
      setAmount(amount);
      setDescription(description);
      setCategory(category);
    }
  }, [text]);

  // Submit
  const handleSubmit = async () => {
    setError('');
    setSuccess('');
    // Replace with your auth logic
    const token = 'your_token_here'; // Use SecureStore or Context in real app
    if (!token) {
      setError('Not authenticated');
      return;
    }
    try {
      const res = await fetch('https://utility-apis.vercel.app/openai-speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token,
        },
        body: JSON.stringify({
          type,
          category,
          amount,
          description,
          date: date.toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Entry failed');
      setSuccess('Entry added!');
      setAmount('');
      setDescription('');
      if (onEntryAdded) onEntryAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Entry</Text>
      <Picker
        selectedValue={type}
        onValueChange={setType}
        style={styles.picker}
      >
        <Picker.Item label="Income" value="income" />
        <Picker.Item label="Expense" value="expense" />
      </Picker>
      <Picker
        selectedValue={category}
        onValueChange={setCategory}
        style={styles.picker}
      >
        {categories.map(cat => (
          <Picker.Item key={cat} label={cat} value={cat} />
        ))}
      </Picker>
      <TextInput
        style={styles.input}
        placeholder="Amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
      />
      <View style={styles.row}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Description"
          value={description}
          onChangeText={setDescription}
        />
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          style={styles.voiceBtn}
        >
          <Text>{isRecording ? '⏹️ Stop' : '🎤 Voice'}</Text>
        </TouchableOpacity>
        <Picker
          selectedValue={provider}
          onValueChange={setProvider}
          style={styles.providerPicker}
        >
          <Picker.Item label="Google" value="google" />
          <Picker.Item label="Whisper" value="whisper" />
        </Picker>
        <TouchableOpacity onPress={handleFileUpload} style={styles.voiceBtn}>
          <Text>Upload Audio</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        onPress={() => setShowDatePicker(true)}
        style={styles.input}
      >
        <Text>{date.toISOString().slice(0, 10)}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={date}
          mode="date"
          display="default"
          onChange={(_, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setDate(selectedDate);
          }}
        />
      )}
      <Button title="Add Entry" onPress={handleSubmit} />
      {loading && <ActivityIndicator />}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      {text ? (
        <View style={styles.translated}>
          <Text style={{ fontWeight: 'bold' }}>
            📝 Translated Text (English):
          </Text>
          <Text>{text}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 400,
    alignSelf: 'center',
    margin: 20,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
  },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 8,
    marginVertical: 6,
    minWidth: 100,
  },
  picker: { marginVertical: 6 },
  providerPicker: { width: 100, marginLeft: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voiceBtn: {
    backgroundColor: '#eee',
    padding: 8,
    borderRadius: 6,
    marginLeft: 6,
  },
  error: { color: 'red', marginTop: 8 },
  success: { color: 'green', marginTop: 8 },
  translated: {
    marginTop: 16,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
  },
});
