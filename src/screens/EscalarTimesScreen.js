import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Toggle from '../components/Toggle';

const availablePlayers = [
  { id: '1', name: 'Pedro Santos', stars: 5, position: 'Atacante' },
  { id: '2', name: 'João Silva', stars: 4, position: 'Goleiro' },
  { id: '3', name: 'Lucas Lima', stars: 4, position: 'Meia' },
  { id: '4', name: 'Rafael Costa', stars: 3, position: 'Zagueiro' },
  { id: '5', name: 'Diego Souza', stars: 4, position: 'Atacante' },
  { id: '6', name: 'Marcos Silva', stars: 3, position: 'Lateral' },
  { id: '7', name: 'Bruno Alves', stars: 2, position: 'Meia' },
  { id: '8', name: 'Carlos Eduardo', stars: 3, position: 'Zagueiro' },
  { id: '9', name: 'Felipe Rocha', stars: 1, position: 'Lateral' },
  { id: '10', name: 'Gustavo Martins', stars: 2, position: 'Meia' },
  { id: '11', name: 'Pedro Alves', stars: 4, position: 'Atacante' },
  { id: '12', name: 'Thiago Souza', stars: 3, position: 'Zagueiro' },
  { id: '13', name: 'Vinicius Lima', stars: 4, position: 'Meia' },
  { id: '14', name: 'Gabriel Costa', stars: 2, position: 'Lateral' },
];

function renderStars(count) {
  const filled = '⭐'.repeat(count);
  const empty = '☆'.repeat(5 - count);
  return filled + empty;
}

function computeTeams(players, balanceSkill) {
  const shuffled = [...players].sort((a, b) => b.stars - a.stars);
  const teamA = [];
  const teamB = [];
  shuffled.forEach((p, i) => {
    if (balanceSkill) {
      if (i === 0) teamA.push(p);
      else if (i % 2 === 1) teamB.push(p);
      else teamA.push(p);
    } else {
      if (i % 2 === 0) teamA.push(p);
      else teamB.push(p);
    }
  });
  return { teamA, teamB };
}

function averageStars(team) {
  if (team.length === 0) return '0.0';
  const total = team.reduce((sum, p) => sum + p.stars, 0);
  return (total / team.length).toFixed(1);
}

const EscalarTimesScreen = () => {
  const [modo, setModo] = useState('auto');
  const [balanceSkill, setBalanceSkill] = useState(true);

  const { teamA, teamB } = computeTeams(availablePlayers, balanceSkill);
  const teamADisplay = teamA.slice(0, 5);
  const teamBDisplay = teamB.slice(0, 5);

  const renderTeamCard = (team, displayTeam, color, bgColor, label, avg) => (
    <Card style={[styles.teamCard, { borderTopColor: color, marginRight: label === 'A' ? 4 : 0, marginLeft: label === 'B' ? 4 : 0 }]}>
      <View style={[styles.teamHeader, { backgroundColor: bgColor }]}>
        <View style={[styles.teamBadge, { backgroundColor: color }]}>
          <Text style={styles.teamBadgeText}>{label}</Text>
        </View>
        <Text style={styles.teamTitle}>Time {label}</Text>
      </View>
      <View style={styles.teamBody}>
        {displayTeam.map((player, index) => (
          <View
            key={player.id}
            style={[
              styles.playerRow,
              index !== displayTeam.length - 1 && styles.playerRowBorder,
            ]}
          >
            <Avatar name={player.name} size={28} />
            <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
            <Text style={styles.playerStars}>{renderStars(player.stars)}</Text>
          </View>
        ))}
      </View>
      <View style={styles.teamFooter}>
        <Text style={styles.teamAvg}>Média: {avg}</Text>
      </View>
    </Card>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segmentItem, modo === 'auto' && styles.segmentItemActive]}
          onPress={() => setModo('auto')}
        >
          <Text style={[styles.segmentText, modo === 'auto' && styles.segmentTextActive]}>Automático</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentItem, modo === 'random' && styles.segmentItemActive]}
          onPress={() => setModo('random')}
        >
          <Text style={[styles.segmentText, modo === 'random' && styles.segmentTextActive]}>Aleatório</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentItem, modo === 'manual' && styles.segmentItemActive]}
          onPress={() => setModo('manual')}
        >
          <Text style={[styles.segmentText, modo === 'manual' && styles.segmentTextActive]}>Manual</Text>
        </TouchableOpacity>
      </View>

      <Card style={styles.configCard}>
        <Text style={styles.configCount}>14 jogadores disponíveis</Text>
        <View style={styles.configRow}>
          <Text style={styles.configLabel}>Equilibrar por habilidade</Text>
          <Toggle value={balanceSkill} onValueChange={setBalanceSkill} />
        </View>
      </Card>

      <View style={styles.teamsRow}>
        {renderTeamCard(teamA, teamADisplay, '#F5A623', '#FFFAF0', 'A', averageStars(teamA))}
        <View style={styles.vsBadge}>
          <Text style={styles.vsText}>VS</Text>
        </View>
        {renderTeamCard(teamB, teamBDisplay, '#378ADD', '#F0F7FF', 'B', averageStars(teamB))}
      </View>

      <View style={styles.rodizioSection}>
        <View style={styles.rodizioTitleRow}>
          <Text style={styles.rodizioIcon}>🔄</Text>
          <Text style={styles.rodizioTitle}>Preview do Rodízio</Text>
        </View>
        <Card style={styles.rodizioCard}>
          <Text style={styles.rodizioSubtitle}>Próximo Jogo</Text>
          <Text style={styles.rodizioRow}>🟡 Time A: 5 jogadores</Text>
          <Text style={styles.rodizioRow}>🔵 Time B: 5 jogadores</Text>
          <Text style={styles.rodizioNote}>Rodízio a cada 15 min</Text>
        </Card>
      </View>

      <View style={styles.bottomButtonsRow}>
        <TouchableOpacity style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Re-sortear</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Confirmar Times</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F5F5F5',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
    padding: 4,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  segmentItemActive: {
    backgroundColor: '#1D9E75',
  },
  segmentText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  segmentTextActive: {
    color: '#FFFFFF',
  },
  configCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  configCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
    marginBottom: 12,
  },
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  configLabel: {
    flex: 1,
    fontSize: 14,
    color: '#2C3E50',
  },
  teamsRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'center',
  },
  teamCard: {
    flex: 1,
    padding: 0,
    borderTopWidth: 3,
    overflow: 'hidden',
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  teamBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  teamBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  teamTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  teamBody: {
    backgroundColor: '#FFFFFF',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  playerRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#F3F4F6',
  },
  playerName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C3E50',
    marginLeft: 8,
    flex: 1,
  },
  playerStars: {
    fontSize: 10,
    color: '#FFD700',
  },
  teamFooter: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  teamAvg: {
    fontSize: 12,
    color: '#6B7280',
  },
  vsBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  vsText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  rodizioSection: {
    marginBottom: 16,
  },
  rodizioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rodizioIcon: {
    marginRight: 6,
    fontSize: 14,
  },
  rodizioTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
  },
  rodizioCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  rodizioSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  rodizioRow: {
    fontSize: 12,
    color: '#2C3E50',
  },
  rodizioNote: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  bottomButtonsRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderColor: '#378ADD',
    borderWidth: 1.5,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#378ADD',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#1D9E75',
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default EscalarTimesScreen;