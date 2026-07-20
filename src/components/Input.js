import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const Input = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  multiline = false,
  leftIcon,
  rightIcon,
  keyboardType = 'default',
  disabled = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const getBorderColor = () => {
    if (error) return '#E74C3C';
    if (isFocused) return '#1D9E75';
    return '#D1D5DB';
  };

  return (
    <View style={styles.wrapper}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.container,
          { borderColor: getBorderColor() },
          multiline && styles.containerMultiline,
          disabled && styles.containerDisabled,
        ]}
      >
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#9CA3AF"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          editable={!disabled}
          multiline={multiline}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          textAlignVertical={multiline ? 'top' : 'center'}
        />
        {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: { width: '100%', marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 4 },
  container: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderRadius: 8,
    paddingHorizontal: 12, backgroundColor: '#FFFFFF', minHeight: 44,
  },
  containerMultiline: { minHeight: 80, alignItems: 'flex-start', paddingVertical: 8 },
  containerDisabled: { backgroundColor: '#F5F5F5' },
  input: { flex: 1, fontSize: 14, paddingVertical: 0, color: '#2C3E50' },
  inputMultiline: { minHeight: 70 },
  iconLeft: { marginRight: 8 },
  iconRight: { marginLeft: 8 },
  errorText: { fontSize: 12, color: '#E74C3C', marginTop: 4, marginLeft: 4 },
});

export default Input;