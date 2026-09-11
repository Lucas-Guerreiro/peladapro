import React from 'react';
import { View, Text, TouchableOpacity, Modal as RNModal, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const Modal = ({
  visible,
  title,
  onClose,
  children,
  fullScreen = false,
  animationType = 'slide',
  showCloseButton = true,
  closeOnOverlayTap = true,
}) => {
  const handleOverlayPress = () => {
    if (closeOnOverlayTap && onClose) {
      onClose();
    }
  };

  const renderCloseButton = () => {
    if (!showCloseButton || !onClose) return null;
    return (
      <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.6}>
        <Text style={styles.closeButtonText}>X</Text>
      </TouchableOpacity>
    );
  };

  const renderTitle = () => {
    if (!title) return null;
    return <Text style={styles.title}>{title}</Text>;
  };

  return (
    <RNModal
      visible={visible}
      transparent={!fullScreen}
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent={false}
    >
      <TouchableOpacity
        style={[
          styles.overlay,
          fullScreen && styles.overlayFullScreen,
        ]}
        activeOpacity={1}
        onPress={handleOverlayPress}
      >
        <TouchableOpacity
          style={[
            styles.content,
            fullScreen && styles.contentFullScreen,
          ]}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation?.()}
        >
          {renderCloseButton()}
          {renderTitle()}
          {children}
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayFullScreen: {
    backgroundColor: '#FFFFFF',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginHorizontal: 20,
    maxHeight: '80%',
    width: '100% - 40',
  },
  contentFullScreen: {
    flex: 1,
    borderRadius: 0,
    marginHorizontal: 0,
    maxHeight: '100%',
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 16,
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
    padding: 4,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#9AA0A6',
    fontWeight: '500',
  },
});

export default Modal;