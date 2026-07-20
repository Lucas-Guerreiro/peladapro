import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';

const topPlayers = [
  { id: 1, name: 'Pedro Santos', goals: 12, games: 10, presence: 95 },
  { id: 2, name: 'Lucas Lima', goals: 8, games: 9, presence: 90 },
  { id: 3, name: 'Diego Souza', goals: 6, games: 8, presence: 85 },
  { id: 4, name: 'Rafael Costa', goals: 5, games: 7, presence: 80 },
  { id: 5, name: 'Bruno Alves', goals: 4, games: 6, presence: 75 },
  { id: 6, name: 'Felipe Rocha', goals: 3, games: 5, presence: 70 },
  { id: 7, name: 'Gustavo Nunes', goals: 3, games: 4, presence: 65 },
  { id: 8, name: 'Marcelo Dias', goals: 2, games: 3, presence: 60 },
  { id: 9, name: 'André Pinto', goals: 1, games: 2, presence: 55 },
  { id: 10, name: 'Carlos Eduardo', goals: 1, games: 1, presence: 50 },
];

function RankingScreen({ onNavigate }) {
  const [period, setPeriod] = useState('Mês');
  const [category, setCategory] = useState('Artilheiros');

  function handlePlayerPress(player) {
    onNavigate('perfil', {
      name: player.name,
      goals: player.goals,
      games: player.games,
      presence: player.presence,
      position: 'Atacante',
      stars: 4,
      memberSince: 'Jan 2025',
      debtAmount: 15.00,
      debtEvent: 'Pelada 03/07',
      stats: {
        gols: player.goals,
        assists: Math.floor(player.games / 5),
        defesas: 0,
        cartoes: '2 Amarelos',
      },
    });
  }

  const periods = ['Mês', 'Ano', 'Todos'];
  const categories = ['Artilheiros', 'Presença', 'Goleiros'];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Ranking</Text>

      <View style={styles.periodRow}>
        {periods.map((p) => (
          <TouchableOpacity
            key={p}
            style={[styles.chip, period === p && styles.chipSelected]}
            onPress={() => setPeriod(p)}
          >
            <Text style={[styles.chipText, period === p && styles.chipTextSelected]}>
              {p}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.tabsContainer}>
        {categories.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.tab, category === c && styles.tabSelected]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.tabText, category === c && styles.tabTextSelected]}>
              {c}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.podium}>
        <View style={styles.podiumColumn}>
          <TouchableOpacity onPress={() => handlePlayerPress(topPlayers[1])} activeOpacity={0.7}>
            <View style={styles.podiumAvatar}>
              <Avatar name="Lucas Lima" size={48} />
            </View>
            <Text style={styles.podiumName}>Lucas Lima</Text>
            <Text style={styles.podiumStat}>8 gols</Text>
          </TouchableOpacity>
          <View style={[styles.podiumBlock, styles.silverBlock]}>
            <Text style={styles.podiumPosition}>2</Text>
          </View>
        </View>

        <View style={styles.podiumColumnCenter}>
          <TouchableOpacity onPress={() => handlePlayerPress(topPlayers[0])} activeOpacity={0.7}>
            <View style={styles.podiumAvatar}>
              <Avatar name="Pedro Santos" size={56} />
            </View>
            <Text style={styles.podiumName}>Pedro Santos</Text>
            <Text style={styles.podiumStat}>12 gols</Text>
          </TouchableOpacity>
          <View style={[styles.podiumBlock, styles.goldBlock, styles.goldBlockTall]}>
            <Text style={styles.podiumPosition}>1</Text>
          </View>
        </View>

        <View style={styles.podiumColumn}>
          <TouchableOpacity onPress={() => handlePlayerPress(topPlayers[2])} activeOpacity={0.7}>
            <View style={styles.podiumAvatar}>
              <Avatar name="Diego Souza" size={40} />
            </View>
            <Text style={styles.podiumName}>Diego Souza</Text>
            <Text style={styles.podiumStat}>6 gols</Text>
          </TouchableOpacity>
          <View style={[styles.podiumBlock, styles.bronzeBlock]}>
            <Text style={styles.podiumPosition}>3</Text>
          </View>
        </View>
      </View>

      <Card style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={[styles.headerCell, styles.colPosition]}>#</Text>
          <Text style={[styles.headerCell, styles.colPlayer]}>Jogador</Text>
          <Text style={[styles.headerCell, styles.colGoals]}>Gols</Text>
          <Text style={[styles.headerCell, styles.colGames]}>Jogos</Text>
          <Text style={[styles.headerCell, styles.colPresence]}>Presença%</Text>
        </View>

        {topPlayers.map((player, index) => (
          <TouchableOpacity
            key={player.id}
            onPress={() => handlePlayerPress(player)}
            activeOpacity={0.7}
            style={[styles.tableRow, index % 2 === 0 && styles.tableRowAlt]}
          >
            <Text style={[styles.cell, styles.colPosition, styles.positionText]}>
              {index + 1}
            </Text>
            <View style={[styles.cell, styles.colPlayer, styles.playerCell]}>
              <Avatar name={player.name} size={28} />
              <Text style={styles.playerName} numberOfLines={1}>
                {player.name}
              </Text>
            </View>
            <Text style={[styles.cell, styles.colGoals, styles.goalsText]}>
              {player.goals}
            </Text>
            <Text style={[styles.cell, styles.colGames, styles.gamesText]}>
              {player.games}
            </Text>
            <View style={[styles.cell, styles.colPresence, styles.presenceCell]}>
              <View style={styles.presenceBar}>
                <View
                  style={[styles.presenceFill, { width: `${player.presence}%` }]}
                />
              </View>
              <Text style={styles.presenceText}>{player.presence}%</Text>
            </View>
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1D9E75',
    marginBottom: 16,
  },
  periodRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
  },
  chipSelected: {
    backgroundColor: '#1D9E75',
  },
  chipText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  tabSelected: {
    backgroundColor: '#1D9E75',
  },
  tabText: {
    fontSize: 13,
    color: '#666666',
    fontWeight: '500',
  },
  tabTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  podium: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    marginTop: 8,
    marginBottom: 8,
  },
  podiumColumn: {
    alignItems: 'center',
    marginRight: 8,
  },
  podiumColumnCenter: {
    alignItems: 'center',
    marginHorizontal: 4,
  },
  podiumAvatar: {
    marginBottom: 4,
  },
  podiumName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 2,
  },
  podiumStat: {
    fontSize: 11,
    color: '#1D9E75',
    textAlign: 'center',
    marginBottom: 6,
  },
  podiumBlock: {
    width: 64,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  goldBlock: {
    backgroundColor: '#F5A623',
    height: 80,
  },
  goldBlockTall: {
    height: 100,
  },
  silverBlock: {
    backgroundColor: '#E5E7EB',
    height: 64,
  },
  bronzeBlock: {
    backgroundColor: '#D35400',
    height: 52,
  },
  podiumPosition: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tableCard: {
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    borderRadius: 8,
    padding: 4,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerCell: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999999',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderRadius: 6,
  },
  tableRowAlt: {
    backgroundColor: '#F9FAFB',
  },
  cell: {
    fontSize: 13,
  },
  colPosition: {
    width: 28,
    textAlign: 'center',
  },
  colPlayer: {
    flex: 1,
  },
  colGoals: {
    width: 44,
    textAlign: 'center',
  },
  colGames: {
    width: 44,
    textAlign: 'center',
  },
  colPresence: {
    width: 80,
  },
  positionText: {
    fontWeight: '600',
    color: '#666666',
  },
  playerCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playerName: {
    marginLeft: 8,
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
    flex: 1,
  },
  goalsText: {
    color: '#1D9E75',
    fontWeight: '700',
  },
  gamesText: {
    color: '#999999',
  },
  presenceCell: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  presenceBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 3,
    marginRight: 6,
    overflow: 'hidden',
  },
  presenceFill: {
    height: '100%',
    backgroundColor: '#1D9E75',
    borderRadius: 3,
  },
  presenceText: {
    fontSize: 11,
    color: '#666666',
    width: 32,
  },
});

export default RankingScreen;