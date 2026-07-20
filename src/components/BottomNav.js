import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import tokens from '../theme/tokens';

const SIZE_CONFIG = {
  sm: { icon: 18, label: 9 },
  md: { icon: 22, label: 10 },
  lg: { icon: 26, label: 11 },
};

const BottomNav = ({ tabs = [], activeTab, onTabPress, size = 'md' }) => {
  const config = SIZE_CONFIG[size] || SIZE_CONFIG.md;

  const renderIcon = (tab, isActive) => {
    const color = isActive ? '#1D9E75' : '#9CA3AF';

    if (tab.icon) {
      return (
        <Text style={[styles.icon, { fontSize: config.icon, color }]}>
          {tab.icon}
        </Text>
      );
    }

    return (
      <View
        style={[
          styles.fallbackCircle,
          { width: config.icon, height: config.icon, borderColor: color },
        ]}
      />
    );
  };

  return (
    <View style={styles.container}>
      {tabs.map((tab) => {
        const isActive = tab.key === activeTab;
        const color = isActive ? '#1D9E75' : '#9CA3AF';

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => onTabPress && onTabPress(tab.key)}
            activeOpacity={0.7}
          >
            {renderIcon(tab, isActive)}
            <Text
              style={[
                styles.label,
                { fontSize: config.label, color },
              ]}
              numberOfLines={1}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 8,
    paddingBottom: 20,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  icon: {
    textAlign: 'center',
  },
  fallbackCircle: {
    borderRadius: 999,
    borderWidth: 1.5,
  },
  label: {
    marginTop: 2,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default BottomNav;