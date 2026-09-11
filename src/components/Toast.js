import React, { useState, useEffect, useRef, createContext, useContext } from 'react';
import { View, Text, Animated, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const ToastContext = createContext({
  showToast: () => {},
});

const VARIANTS = {
  success: {
    borderColor: '#1D9E75',
  },
  warning: {
    borderColor: '#F5A623',
  },
  error: {
    borderColor: '#E74C3C',
  },
};

const ToastProvider = ({ children }) => {
  const [message, setMessage] = useState('');
  const [variant, setVariant] = useState('success');
  const [visible, setVisible] = useState(false);
  const translateY = useRef(new Animated.Value(-100)).current;
  const hideTimeout = useRef(null);

  const showToast = (newMessage, newVariant = 'success') => {
    if (hideTimeout.current) {
      clearTimeout(hideTimeout.current);
      hideTimeout.current = null;
    }

    setMessage(newMessage);
    setVariant(newVariant);
    setVisible(true);

    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();

    hideTimeout.current = setTimeout(() => {
      Animated.spring(translateY, {
        toValue: -100,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start(() => {
        setVisible(false);
      });
      hideTimeout.current = null;
    }, 3000);
  };

  useEffect(() => {
    return () => {
      if (hideTimeout.current) {
        clearTimeout(hideTimeout.current);
      }
    };
  }, []);

  const activeVariant = VARIANTS[variant] || VARIANTS.success;

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {visible && (
        <Animated.View
          style={[
            styles.container,
            { transform: [{ translateY }] },
          ]}
        >
          <View style={[styles.leftBorder, { backgroundColor: activeVariant.borderColor }]} />
          <Text style={styles.message} numberOfLines={4}>
            {message}
          </Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: tokens.spacing.lg || 16,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    flexDirection: 'row',
    padding: 16,
    minHeight: 48,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  leftBorder: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginLeft: 8,
  },
});

export default ToastProvider;
export { useToast };