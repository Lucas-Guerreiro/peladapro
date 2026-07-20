import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SectionList } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';

const Dashboard = ({ onNavigate }) => {
  const [ranking] = useState([
    { id: 1, name: 'Carlos Silva', gols: 12 },
    { id: 2, name: 'Pedro Santos', gols: 9 },
    { id: 3, name: 'Lucas Oliveira', gols: 7 },
  ]);

  const quickActions = [
    { id: 'novapelada', label: 'Nova Pelada', icon: '⚽', color: '#1D9E75' },
    { id: 'escalarTimes', label: 'Escalar Times', icon: '👥', color: '#378ADD' },
    { id: 'financeiro', label: 'Cobranças', icon: '💰', color: '#F5A623' },
    { id: 'quadras', label: 'Quadras', icon: '🏟️', color: '#1D9E75' },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* HERO CARD */}
      <View style={styles.heroCard}>
        <Text style={styles.heroSubtitle}>Próxima Pelada</Text>
        <Text style={styles.heroTitle}>Quarta, 10/07 às 19:00</Text>
        <Text style={styles.heroLocation}>📍 Quadra do Parque</Text>
        <View style={styles.pillsRow}>
          <View style={styles.pillConfirmed}>
            <Text style={styles.pillConfirmedText}>12 Confirmados ✅</Text>
          </View>
          <View style={styles.pillPending}>
            <Text style={styles.pillPendingText}>4 Pendentes ⏳</Text>
          </View>
        </View>
      </View>

      {/* QUICK ACTIONS ROW */}
      <View style={styles.quickActionsRow}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.quickActionItem}
            onPress={() => onNavigate(action.id)}
            activeOpacity={0.7}
          >
            <View style={[styles.quickActionCircle, { backgroundColor: action.color }]}>
              <Text style={styles.quickActionIcon}>{action.icon}</Text>
            </View>
            <Text style={styles.quickActionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* FINANCE CARD */}
      <Card padding={16} marginBottom={16}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.cardTitle}>💰 Financeiro</Text>
          <TouchableOpacity onPress={() => onNavigate('financeiro')}>
            <Text style={styles.linkText}>Ver detalhes →</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.financeColumns}>
          <View style={styles.financeColumn}>
            <Text style={styles.financeLabel}>Caixa</Text>
            <Text style={styles.financeValue}>R$ 320,00</Text>
          </View>
          <View style={styles.financeColumn}>
            <Text style={styles.financeLabel}>Pendências</Text>
            <Text style={styles.financePending}>3 jogadores</Text>
          </View>
        </View>
      </Card>

      {/* RANKING CARD */}
      <Card padding={16} marginBottom={24}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.rankingTitle}>🏆 Artilheiros</Text>
          <TouchableOpacity onPress={() => onNavigate('ranking')}>
            <Text style={styles.linkText}>Ver ranking →</Text>
          </TouchableOpacity>
        </View>
        {ranking.map((player) => (
          <View key={player.id} style={styles.rankingRow}>
            <Avatar name={player.name} size={32} />
            <Text style={styles.rankingName}>{player.name}</Text>
            <Text style={styles.rankingGols}>{player.gols} gols</Text>
          </View>
        ))}
        <TouchableOpacity
          style={styles.fullRankingLink}
          onPress={() => onNavigate('ranking')}
        >
          <Text style={styles.fullRankingText}>Ver ranking completo →</Text>
        </TouchableOpacity>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  heroCard: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  heroSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  heroTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginTop: 4,
  },
  heroLocation: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  pillsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  pillConfirmed: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillConfirmedText: {
    color: '#1D9E75',
    fontSize: 12,
    fontWeight: '600',
  },
  pillPending: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  pillPendingText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  quickActionItem: {
    alignItems: 'center',
    width: 60,
  },
  quickActionCircle: {
    width: 55,
    height: 55,
    borderRadius: 27.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionIcon: {
    fontSize: 26,
  },
  quickActionLabel: {
    fontSize: 10,
    color: '#2C3E50',
    marginTop: 4,
    textAlign: 'center',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  linkText: {
    fontSize: 12,
    color: '#378ADD',
  },
  financeColumns: {
    flexDirection: 'row',
    marginTop: 12,
  },
  financeColumn: {
    flex: 1,
  },
  financeLabel: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  financeValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1D9E75',
    marginTop: 2,
  },
  financePending: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E74C3C',
    marginTop: 2,
  },
  rankingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  rankingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  rankingName: {
    fontSize: 13,
    color: '#2C3E50',
    marginLeft: 10,
    flex: 1,
  },
  rankingGols: {
    fontSize: 13,
    color: '#1D9E75',
    fontWeight: '600',
  },
  fullRankingLink: {
    marginTop: 14,
    alignItems: 'flex-end',
  },
  fullRankingText: {
    fontSize: 12,
    color: '#378ADD',
  },
});

export default Dashboard;