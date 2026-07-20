import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#1D9E75',
      tabBarInactiveTintColor: '#7F8C8D',
      tabBarStyle: { backgroundColor: '#FFFFFF', height: 60, borderTopWidth: 1, borderTopColor: '#E5E5E5' },
      tabBarLabelStyle: { fontSize: 11, marginBottom: 4 },
    }}>
      <Tabs.Screen name="home" options={{ title: 'Início', tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="pelada" options={{ title: 'Pelada', tabBarIcon: ({ color, size }) => <Ionicons name="calendar" size={size} color={color} /> }} />
      <Tabs.Screen name="jogadores" options={{ title: 'Jogadores', tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="ranking" options={{ title: 'Ranking', tabBarIcon: ({ color, size }) => <Ionicons name="trophy" size={size} color={color} /> }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais', tabBarIcon: ({ color, size }) => <Ionicons name="menu" size={size} color={color} /> }} />
    </Tabs>
  );
}