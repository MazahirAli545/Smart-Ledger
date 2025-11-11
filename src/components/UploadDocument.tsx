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

const SCALE = 0.9;
const scale = (value: number) => Math.round(value * SCALE);

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
          size={scale(24)}
          color="#222"
        />
        <Text style={styles.cardTitle}>Upload Document</Text>
      </View>
      <View style={styles.uploadRow}>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={onUploadDocument}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={scale(28)}
            color="#222"
          />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={onVoiceHelper}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          disabled={false}
        >
          <MaterialCommunityIcons
            name="microphone"
            size={scale(28)}
            color="#222"
          />
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
    borderRadius: scale(12),
    padding: scale(20),
    marginBottom: scale(20),
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: scale(5),
    shadowOffset: { width: 0, height: scale(2) },
    elevation: 2,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  cardTitle: {
    fontSize: scale(19),
    color: '#222',
    marginLeft: scale(8),

    fontFamily: 'Roboto-Medium',
  },

  uploadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: scale(20),
    marginBottom: scale(12),
  },
  uploadButton: {
    flex: 1,
    backgroundColor: '#f9f9f9',
    borderRadius: scale(12),
    borderWidth: 1,
    borderColor: '#e0e0e0',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(28),
    marginHorizontal: scale(8),
  },
  uploadButtonText: {
    color: '#222',
    fontSize: scale(16),
    marginTop: scale(8),

    fontFamily: 'Roboto-Medium',
  },

  uploadDesc: {
    color: '#666',
    fontSize: scale(14),
    textAlign: 'center',
    marginTop: scale(8),

    fontFamily: 'Roboto-Medium',
  },
});

export default UploadDocument;
