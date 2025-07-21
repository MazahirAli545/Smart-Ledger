import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
// import DocumentPicker from 'react-native-document-picker';
// import TextRecognition from 'react-native-text-recognition';

interface UploadDocumentProps {
  onUploadDocument?: () => void;
  onVoiceHelper?: () => void;
  onOcrExtracted?: (data: { text: string }) => void;
  folderName?: string; // Add folderName prop
}

const UploadDocument: React.FC<UploadDocumentProps> = ({
  onUploadDocument,
  onVoiceHelper,
  onOcrExtracted,
  folderName = 'invoice', // Default to 'invoice'
}) => {
  const [loading, setLoading] = React.useState(false);

  //   const handlePickFile = async () => {
  //     try {
  //       setLoading(true);
  //       const res = await DocumentPicker.pickSingle({
  //         type: [DocumentPicker.types.images],
  //       });
  //       if (res.uri) {
  //         // Run OCR on the selected image
  //         const result = await TextRecognition.recognize(res.uri);
  //         const text = result.join(' ');
  //         if (onOcrExtracted) {
  //           on
  //         O crExtracted({ text });

  //               }
  //         Alert.al
  //         ert('OCR Result', text.length > 0 ?
  //  t          ext : 'No text fo
  //  u          nd.');

  //                 }
  //     }
  //           catch (err: any) {
  //       if (!DocumentPicker.isCancel(err)) {
  //         Alert.alert('Error', 'Failed to pick or process the file.');
  //       }
  //     } finally {
  //       setLoading(false);
  //     }
  //   };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>
        <MaterialCommunityIcons
          name="file-document-outline"
          size={24}
          color="#222"
        />{' '}
        Upload Document
      </Text>
      <View style={styles.uploadRow}>
        <TouchableOpacity style={styles.uploadButton}>
          <MaterialCommunityIcons
            name="file-document-outline"
            size={28}
            color="#222"
          />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.uploadButton} onPress={onVoiceHelper}>
          <MaterialCommunityIcons name="microphone" size={28} color="#222" />
          <Text style={styles.uploadButtonText}>Voice Helper</Text>
        </TouchableOpacity>
      </View>
      {loading && (
        <ActivityIndicator size="small" color="#222" style={{ marginTop: 8 }} />
      )}
      <Text style={styles.uploadDesc}>
        {`Upload ${folderName.toLowerCase()}/bill images or PDFs to auto-fill details using OCR`}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 16,
  },
  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    marginHorizontal: 8,
  },
  uploadButtonText: {
    color: '#222',
    fontWeight: 'bold',
    fontSize: 16,
    marginTop: 8,
  },
  uploadDesc: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default UploadDocument;
