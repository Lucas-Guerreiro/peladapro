import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const sizeValueFont = {
  sm: 16,
  md: 20,
  lg: 24,
};

const sizeLabelFont = {
  sm: 10,
  md: 11,
  lg: 12,
};

const StatCard = ({
  value,
  label,
  color = '#1D9E75',
  icon,
  size = 'md',
}) => {
  const valueFontSize = sizeValueFont[size] ?? sizeValueFont.md;
  const labelFontSize = sizeLabelFont[size] ?? sizeLabelFont.md;

  return (
    <View style={styles.container}>
      {icon ? (
        <Text
          style={[
            styles.icon,
            { fontSize: valueFontSize, marginBottom: 4 },
          ]}
        >
          {icon}
        </Text>
      ) : null}
      <Text
        style={[
          styles.value,
          { fontSize: valueFontSize, color },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          styles.label,
          { fontSize: labelFontSize },
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    ...((tokens && tokens.shadows && tokens.shadows.card) || {}),
  },
  icon: {
    textAlign: 'center',
  },
  value: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  label: {
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default StatCard;