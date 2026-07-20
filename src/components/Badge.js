import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const VARIANTS = {
  confirmed: {
    backgroundColor: '#1D9E75',
    color: '#FFFFFF',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  pending: {
    backgroundColor: '#F5A623',
    color: '#1F2937',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  absent: {
    backgroundColor: '#9CA3AF',
    color: '#FFFFFF',
    borderWidth: 0,
    borderColor: 'transparent',
  },
  goalkeeper: {
    backgroundColor: 'transparent',
    color: '#378ADD',
    borderWidth: 1,
    borderColor: '#378ADD',
  },
  debtor: {
    backgroundColor: '#E74C3C',
    color: '#FFFFFF',
    borderWidth: 0,
    borderColor: 'transparent',
  },
};

const SIZES = {
  sm: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 10,
  },
  md: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 11,
  },
  lg: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    fontSize: 12,
  },
};

const Badge = ({ variant = 'confirmed', label, size = 'md' }) => {
  const variantStyle = VARIANTS[variant] || VARIANTS.confirmed;
  const sizeStyle = SIZES[size] || SIZES.md;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variantStyle.backgroundColor,
          borderWidth: variantStyle.borderWidth,
          borderColor: variantStyle.borderColor,
          paddingHorizontal: sizeStyle.paddingHorizontal,
          paddingVertical: sizeStyle.paddingVertical,
        },
      ]}
    >
      <Text
        style={[
          styles.text,
          {
            color: variantStyle.color,
            fontSize: sizeStyle.fontSize,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    borderRadius: 999,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: tokens?.fontWeights?.semibold || '600',
    textAlign: 'center',
  },
});

export default Badge;