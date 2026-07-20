import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const Card = ({
  children,
  padding = 16,
  noPadding = false,
  margin,
  marginHorizontal,
  marginVertical,
  style,
  onPress,
}) => {
  const computedStyle = [
    styles.card,
    !noPadding && { padding },
    margin !== undefined && { margin },
    marginHorizontal !== undefined && { marginHorizontal },
    marginVertical !== undefined && { marginVertical },
    style,
  ];

  if (onPress) {
    return (
      <TouchableOpacity style={computedStyle} onPress={onPress} activeOpacity={0.9}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={computedStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    ...tokens.shadows.card,
  },
});

export default Card;