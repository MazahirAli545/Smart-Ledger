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
  folderName = 'sell', // Default to 'sell'
}) => {
  const [loading, setLoading] = React.useState(false);

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleContainer}>
        <MaterialCommunityIcons
          name="file-document-outline"
          size={24}
          color="#222"
        />
        <Text style={styles.cardTitle}>Upload Document</Text>
      </View>
      <View style={styles.uploadRow}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={onUploadDocument}
          // disabled={true}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={28}
            color="#222"
          />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={onVoiceHelper}
          disabled={true}
        >
          <MaterialCommunityIcons name="microphone" size={28} color="#222" />
          <Text style={styles.uploadButtonText}>Voice Helper</Text>
        </TouchableOpacity>
      </View>
      {loading && (
        <ActivityIndicator size="small" color="#222" style={{ marginTop: 8 }} />
      )}
      <Text style={styles.uploadDesc}>
        {`Upload ${
          (folderName || 'sell').toLowerCase() === 'invoice'
            ? 'sell'
            : (folderName || 'sell').toLowerCase()
        }/bill images or PDFs to auto-fill details using OCR`}
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
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
    marginLeft: 8,
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
