import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const SIZES = {
  sm: 13,
  md: 14,
  lg: 15,
};

const SegmentedControl = ({
  segments = [],
  selectedKey,
  onSelect,
  size = 'md',
}) => {
  const fontSize = SIZES[size] ?? SIZES.md;

  const renderSegment = (segment) => {
    const isSelected = segment.key === selectedKey;

    return (
      <TouchableOpacity
        key={segment.key}
        style={[
          styles.segment,
          isSelected ? styles.segmentSelected : styles.segmentUnselected,
        ]}
        activeOpacity={0.7}
        onPress={() => onSelect && onSelect(segment.key)}
      >
        <Text
          style={[
            styles.label,
            { fontSize },
            isSelected ? styles.labelSelected : styles.labelUnselected,
          ]}
          numberOfLines={1}
        >
          {segment.label}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {segments.map(renderSegment)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 999,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentSelected: {
    backgroundColor: '#1D9E75',
  },
  segmentUnselected: {
    backgroundColor: 'transparent',
  },
  label: {
    textAlign: 'center',
  },
  labelSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  labelUnselected: {
    color: '#6B7280',
    fontWeight: '500',
  },
});

export default SegmentedControl;