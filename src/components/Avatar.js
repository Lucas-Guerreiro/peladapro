import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import tokens from '../theme/tokens';

const PALETTE = ['#1D9E75', '#378ADD', '#F5A623', '#E74C3C', '#9B59B6'];

function hashName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getColorForName(name) {
  return PALETTE[hashName(name) % PALETTE.length];
}

function getInitials(name) {
  const trimmed = name.trim();
  if (trimmed.includes(' ')) {
    const parts = trimmed.split(/\s+/);
    const first = parts[0] ? parts[0][0] : '';
    const last = parts[parts.length - 1] ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }
  return trimmed.slice(0, 2).toUpperCase();
}

const Avatar = ({
  name,
  uri,
  size = 40,
  borderColor,
  borderWidth = 0,
  onPress,
}) => {
  const containerStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: borderColor ? borderWidth : 0,
    borderColor: borderColor || 'transparent',
    overflow: 'hidden',
  };

  const renderContent = () => {
    if (uri) {
      return (
        <Image
          source={{ uri }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      );
    }

    return (
      <View
        style={[
          styles.fallback,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: getColorForName(name),
          },
        ]}
      >
        <Text
          style={{
            fontSize: size * 0.4,
            fontWeight: 'bold',
            color: 'white',
          }}
        >
          {getInitials(name)}
        </Text>
      </View>
    );
  };

  if (onPress) {
    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return <View style={containerStyle}>{renderContent()}</View>;
};

const styles = StyleSheet.create({
  fallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default Avatar;