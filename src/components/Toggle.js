import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const SIZES = {
  sm: {
    trackWidth: 36,
    trackHeight: 20,
    knobSize: 16,
  },
  md: {
    trackWidth: 48,
    trackHeight: 28,
    knobSize: 24,
  },
  lg: {
    trackWidth: 60,
    trackHeight: 34,
    knobSize: 30,
  },
};

const COLOR_OFF = '#D1D5DB';
const COLOR_ON = '#1D9E75';

const Toggle = ({
  value = false,
  onValueChange,
  label,
  disabled = false,
  size = 'md',
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const animatedValue = useRef(new Animated.Value(value ? 1 : 0)).current;

  const sizeConfig = SIZES[size] || SIZES.md;
  const { trackWidth, trackHeight, knobSize } = sizeConfig;
  const padding = (trackHeight - knobSize) / 2;
  const maxTranslate = trackWidth - knobSize - padding * 2;

  useEffect(() => {
    if (value !== internalValue) {
      setInternalValue(value);
    }
    Animated.spring(animatedValue, {
      toValue: value ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handlePress = () => {
    if (disabled) return;
    const newValue = !internalValue;
    setInternalValue(newValue);
    Animated.spring(animatedValue, {
      toValue: newValue ? 1 : 0,
      friction: 8,
      tension: 40,
      useNativeDriver: false,
    }).start();
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  const trackBackgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [COLOR_OFF, COLOR_ON],
  });

  const knobTranslateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTranslate],
  });

  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handlePress}
        disabled={disabled}
        accessibilityRole="switch"
        accessibilityState={{ checked: internalValue, disabled }}
        accessible
      >
        <Animated.View
          style={[
            styles.track,
            {
              width: trackWidth,
              height: trackHeight,
              borderRadius: trackHeight / 2,
              backgroundColor: trackBackgroundColor,
              paddingHorizontal: padding,
              paddingVertical: padding,
            },
          ]}
        >
          <Animated.View
            style={[
              styles.knob,
              {
                width: knobSize,
                height: knobSize,
                borderRadius: knobSize / 2,
                transform: [{ translateX: knobTranslateX }],
              },
            ]}
          />
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginRight: tokens.spacing.sm,
  },
  track: {
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  knob: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Toggle;