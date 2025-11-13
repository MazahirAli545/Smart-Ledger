import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Platform,
  PermissionsAndroid,
  Linking,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import {
  pick as pickDocument,
  types as DocumentTypes,
  isErrorWithCode,
  errorCodes,
} from '@react-native-documents/picker';
import { useAlert } from '../context/AlertContext';

interface AttachedDocument {
  name: string;
  type: 'image' | 'pdf';
  uri: string;
  size?: number;
}

interface AttachDocumentProps {
  attachedDocument: AttachedDocument | null;
  onDocumentAttached: (document: AttachedDocument) => void;
  onDocumentRemoved: () => void;
  label?: string;
  required?: boolean;
}

const AttachDocument: React.FC<AttachDocumentProps> = ({
  attachedDocument,
  onDocumentAttached,
  onDocumentRemoved,
  label = 'Attach Document (Optional)',
  required = false,
}) => {
  const { showAlert } = useAlert();
  const [showDocumentModal, setShowDocumentModal] = useState(false);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const res = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn('Camera permission error', e);
      return false;
    }
  };

  const requestMediaPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;
    try {
      const readImages = (PermissionsAndroid as any).PERMISSIONS
        ?.READ_MEDIA_IMAGES;
      const permissionToAsk = readImages
        ? readImages
        : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
      const res = await PermissionsAndroid.request(permissionToAsk);
      return res === PermissionsAndroid.RESULTS.GRANTED;
    } catch (e) {
      console.warn('Media permission error', e);
      return false;
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleAttachDocument = () => {
    requestPermissionsProactively();
    setShowDocumentModal(true);
  };

  const requestPermissionsProactively = async () => {
    if (Platform.OS === 'android') {
      try {
        const cameraPermission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        const readImages = (PermissionsAndroid as any).PERMISSIONS
          ?.READ_MEDIA_IMAGES;
        const permissionToAsk =
          readImages || PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
        const mediaPermission = await PermissionsAndroid.request(
          permissionToAsk,
        );
        console.log('Permissions status:', {
          camera: cameraPermission,
          media: mediaPermission,
        });
      } catch (e) {
        console.warn('Permission request error:', e);
      }
    }
  };

  const handleCameraCapture = async () => {
    try {
      const granted = await requestCameraPermission();
      if (!granted) {
        showAlert({
          title: 'Permission Required',
          message:
            'Camera permission is needed to take photos. Please grant camera permission in your device settings.',
          type: 'confirm',
          confirmText: 'Open Settings',
          cancelText: 'Cancel',
          onConfirm: () => openAppSettings(),
        });
        return;
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      });

      if (result.assets && result.assets[0]) {
        const asset = result.assets[0];
        const document: AttachedDocument = {
          name: asset.fileName || 'Camera_Photo.jpg',
          type: 'image',
          uri: asset.uri || '',
          size: asset.fileSize,
        };
        onDocumentAttached(document);
        setShowDocumentModal(false);
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      if (error.code !== 'E_PICKER_CANCELLED') {
        showAlert({
          title: 'Error',
          message: 'Failed to capture photo. Please try again.',
          type: 'error',
          confirmText: 'OK',
        });
      }
    }
  };

  const handleGalleryPick = async () => {
    try {
      const permissionStatus = await PermissionsAndroid.request(
        Platform.OS === 'android'
          ? (PermissionsAndroid.PERMISSIONS as any).READ_MEDIA_IMAGES
          : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      );

      if (permissionStatus === PermissionsAndroid.RESULTS.GRANTED) {
        await launchImageLibraryAndSetDocument();
      } else if (permissionStatus === PermissionsAndroid.RESULTS.DENIED) {
        showAlert({
          title: 'Permission Denied',
          message:
            'Storage permission is needed to access your gallery. Please grant it in your app settings to proceed.',
          type: 'error',
          confirmText: 'OK',
          onConfirm: () => Linking.openSettings(),
        });
      } else if (
        permissionStatus === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
      ) {
        showAlert({
          title: 'Permission Denied',
          message:
            'You have previously denied storage permission with "Don\'t ask again". Please go to your app settings to grant it manually.',
          type: 'error',
          confirmText: 'OK',
          onConfirm: () => Linking.openSettings(),
        });
      }
    } catch (error: any) {
      console.error('Gallery error:', error);
      if (error.code !== 'E_PICKER_CANCELLED') {
        showAlert({
          title: 'Error',
          message: 'Failed to pick image from gallery. Please try again.',
          type: 'error',
          confirmText: 'OK',
        });
      }
    }
  };

  const launchImageLibraryAndSetDocument = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
      includeBase64: false,
    });

    if (result.assets && result.assets[0]) {
      const asset = result.assets[0];
      const document: AttachedDocument = {
        name: asset.fileName || 'Gallery_Image.jpg',
        type: 'image',
        uri: asset.uri || '',
        size: asset.fileSize,
      };
      onDocumentAttached(document);
      setShowDocumentModal(false);
    }
  };

  const handlePdfPick = async () => {
    try {
      const res = await pickDocument({
        type: [DocumentTypes.pdf],
        allowMultiSelection: false,
        allowVirtualFiles: true,
      });

      const file = res && res[0];
      if (file) {
        const document: AttachedDocument = {
          name: file.name || 'Document.pdf',
          type: 'pdf',
          uri: file.uri || '',
          size: file.size ?? undefined,
        };
        onDocumentAttached(document);
        setShowDocumentModal(false);
      }
    } catch (error: any) {
      console.error('PDF picker error:', error);
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      showAlert({
        title: 'Error',
        message: 'Failed to pick PDF document. Please try again.',
        type: 'error',
        confirmText: 'OK',
      });
    }
  };

  const openAppSettings = () => {
    Linking.openSettings();
  };

  const removeAttachedDocument = () => {
    onDocumentRemoved();
  };

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>

      {attachedDocument ? (
        <View style={styles.attachedDocumentContainer}>
          <View style={styles.documentInfo}>
            {attachedDocument.type === 'image' ? (
              <Image
                source={{ uri: attachedDocument.uri }}
                style={styles.attachedImagePreview}
              />
            ) : (
              <MaterialCommunityIcons
                name="file-pdf-box"
                size={28}
                color="#dc3545"
              />
            )}
            <View style={styles.documentDetails}>
              <Text style={styles.documentName} numberOfLines={1}>
                {attachedDocument.name}
              </Text>
              {attachedDocument.size && (
                <Text style={styles.documentSize}>
                  {formatFileSize(attachedDocument.size)}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.documentActions}>
            <TouchableOpacity
              style={styles.removeDocumentButton}
              onPress={removeAttachedDocument}
              testID="remove-document-button"
            >
              <MaterialCommunityIcons name="close" size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.attachDocumentButton}
          onPress={handleAttachDocument}
        >
          <MaterialCommunityIcons
            name="cloud-upload"
            size={36}
            color="#4f8cff"
          />
          <Text style={styles.attachDocumentText}>Click to upload</Text>
          <Text style={styles.attachDocumentSubtext}>
            Only PNG, JPG or PDF file format supported
          </Text>
        </TouchableOpacity>
      )}

      {/* Document Selection Modal */}
      <Modal
        visible={showDocumentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDocumentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Attach Document</Text>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowDocumentModal(false)}
              >
                <MaterialCommunityIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalOptions}>
              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleCameraCapture}
              >
                <View style={styles.optionIconContainer}>
                  <MaterialCommunityIcons
                    name="camera"
                    size={30}
                    color="#4f8cff"
                  />
                </View>
                <Text style={styles.optionTitle}>Camera</Text>
                <Text style={styles.optionSubtitle}>Take a photo</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handleGalleryPick}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    styles.optionIconContainerGallery,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="image"
                    size={30}
                    color="#28a745"
                  />
                </View>
                <Text style={styles.optionTitle}>Gallery</Text>
                <Text style={styles.optionSubtitle}>Choose from gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalOption}
                onPress={handlePdfPick}
              >
                <View
                  style={[
                    styles.optionIconContainer,
                    styles.optionIconContainerPdf,
                  ]}
                >
                  <MaterialCommunityIcons
                    name="file-pdf-box"
                    size={30}
                    color="#dc3545"
                  />
                </View>
                <Text style={styles.optionTitle}>PDF</Text>
                <Text style={styles.optionSubtitle}>Select PDF document</Text>
              </TouchableOpacity>
            </View>

            {attachedDocument && (
              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>Current Document</Text>
                <View style={styles.previewDocumentInfo}>
                  <MaterialCommunityIcons
                    name={
                      attachedDocument.type === 'pdf' ? 'file-pdf-box' : 'image'
                    }
                    size={24}
                    color={
                      attachedDocument.type === 'pdf' ? '#dc3545' : '#28a745'
                    }
                  />
                  <View style={styles.previewDocumentDetails}>
                    <Text style={styles.previewDocumentName} numberOfLines={1}>
                      {attachedDocument.name}
                    </Text>
                    {attachedDocument.size && (
                      <Text style={styles.previewDocumentSize}>
                        {formatFileSize(attachedDocument.size)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowDocumentModal(false)}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,

    fontFamily: 'Roboto-Medium',
  },

  required: {
    color: '#dc3545',

    fontFamily: 'Roboto-Medium',
  },
  attachedDocumentContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  documentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  documentDetails: {
    flex: 1,
  },
  documentName: {
    fontSize: 14,
    color: '#333',

    fontFamily: 'Roboto-Medium',
  },

  documentSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },

  removeDocumentButton: {
    padding: 8,
  },
  documentActions: {
    flexDirection: 'row',
    gap: 8,
  },
  attachDocumentButton: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: 22,
    marginBottom: 60,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    borderStyle: 'dashed',
    backgroundColor: '#f8f9fa',
  },
  attachedImagePreview: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#eaeaea',
  },
  attachDocumentText: {
    fontSize: 16,
    color: '#4f8cff',
    marginTop: 8,

    fontFamily: 'Roboto-Medium',
  },

  attachDocumentSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,

    fontFamily: 'Roboto-Medium',
  },

  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 10,
    width: '80%',
    padding: 20,
    alignItems: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  modalTitle: {
    fontSize: 20,
    color: '#333',

    fontFamily: 'Roboto-Medium',
  },

  modalCloseButton: {
    padding: 5,
  },
  modalOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 8,
    marginBottom: 16,
  },
  modalOption: {
    alignItems: 'center',
    width: '31%',
  },
  optionIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  optionTitle: {
    fontSize: 14,
    color: '#333',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  optionSubtitle: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',

    fontFamily: 'Roboto-Medium',
  },

  modalCancelButton: {
    backgroundColor: '#f0f0f0',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  modalCancelButtonText: {
    color: '#333',
    fontSize: 16,

    fontFamily: 'Roboto-Medium',
  },

  optionIconContainerGallery: {
    backgroundColor: '#e0f7e0',
  },
  optionIconContainerPdf: {
    backgroundColor: '#ffe0e0',
  },
  previewSection: {
    width: '100%',
    marginTop: 20,
    paddingHorizontal: 10,
    paddingVertical: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  previewSectionTitle: {
    fontSize: 16,
    color: '#333',
    marginBottom: 10,

    fontFamily: 'Roboto-Medium',
  },

  previewDocumentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  previewDocumentDetails: {
    flex: 1,
  },
  previewDocumentName: {
    fontSize: 14,
    color: '#333',

    fontFamily: 'Roboto-Medium',
  },

  previewDocumentSize: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,

    fontFamily: 'Roboto-Medium',
  },
});

export default AttachDocument;
