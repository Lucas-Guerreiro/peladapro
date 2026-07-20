import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const Button = ({
  title,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  disabled = false,
  loading = false,
  onPress,
  icon,
}) => {
  const variantStyle = styles[variant] || styles.primary;
  const sizeStyle = styles[`size_${size}`] || styles.size_md;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        variantStyle,
        sizeStyle,
        fullWidth && styles.fullWidth,
        disabled && styles.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.color} size="small" />
      ) : (
        <>
          {icon ? <span style={styles.icon}>{icon}</span> : null}
          <Text style={[styles.text, { color: variantStyle.color, fontSize: sizeStyle.fontSize }]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: '#1D9E75',
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#378ADD',
    color: '#378ADD',
  },
  ghost: {
    backgroundColor: 'transparent',
    color: '#888888',
  },
  danger: {
    backgroundColor: '#E74C3C',
    color: '#FFFFFF',
  },
  size_sm: {
    height: 36,
    fontSize: 12,
  },
  size_md: {
    height: 44,
    fontSize: 14,
  },
  size_lg: {
    height: 52,
    fontSize: 16,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: '600',
  },
  icon: {
    marginRight: 8,
  },
});

export default Button;