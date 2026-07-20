import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Button from '../components/Button';

const PeladaScreen = ({ onNavigate }) => {
  const [peladaInfo] = useState({
    date: 'Quarta, 10/07 às 19:00',
    location: 'Quadra do Parque',
    price: 15.00,
  });

  const [players] = useState([
    { id: 1, name: 'João Silva', position: 'Goleiro', status: 'confirmed', paid: true },
    { id: 2, name: 'Pedro Santos', position: 'Zagueiro', status: 'confirmed', paid: true },
    { id: 3, name: 'Lucas Oliveira', position: 'Zagueiro', status: 'confirmed', paid: false },
    { id: 4, name: 'Carlos Mendes', position: 'Lateral', status: 'confirmed', paid: true },
    { id: 5, name: 'Rafael Costa', position: 'Meia', status: 'confirmed', paid: true },
    { id: 6, name: 'Bruno Alves', position: 'Atacante', status: 'confirmed', paid: false },
    { id: 7, name: 'Diego Fernandes', position: 'Meia', status: 'pending', paid: false },
    { id: 8, name: 'Felipe Rocha', position: 'Atacante', status: 'pending', paid: false },
    { id: 9, name: 'Gustavo Lima', position: 'Lateral', status: 'pending', paid: false },
    { id: 10, name: 'Marcelo Dias', position: 'Zagueiro', status: 'declined', paid: false },
    { id: 11, name: 'Anderson Souza', position: 'Goleiro', status: 'declined', paid: false },
  ]);

  const [waitlist] = useState({
    count: 2,
    subtitle: '2 jogadores aguardando vaga',
  });

  const confirmedPlayers = players.filter((p) => p.status === 'confirmed');
  const pendingPlayers = players.filter((p) => p.status === 'pending');
  const declinedPlayers = players.filter((p) => p.status === 'declined');

  const handlePlayerPress = (player) => {
    onNavigate('perfil', {
      name: player.name,
      position: player.position,
      goals: player.status === 'confirmed' ? 4 : 1,
      games: player.status === 'confirmed' ? 20 : 10,
      presence: player.status === 'confirmed' ? 85 : 60,
      stars: player.status === 'confirmed' ? 4 : 2,
      memberSince: player.status === 'confirmed' ? 'Jan 2025' : 'Mar 2025',
      debtAmount: player.paid ? 0 : 15.00,
      debtEvent: player.paid ? '' : 'Pelada 03/07',
      stats: {
        gols: player.status === 'confirmed' ? 4 : 1,
        assists: 3,
        defesas: player.position === 'Goleiro' ? 23 : 0,
        cartoes: '1 Amarelo',
      },
    });
  };

  const renderPlayerRow = (player, rightElement) => (
    <TouchableOpacity
      key={player.id}
      style={styles.playerRow}
      onPress={() => handlePlayerPress(player)}
      activeOpacity={0.7}
    >
      <Avatar name={player.name} size={32} />
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{player.name}</Text>
        <Text style={styles.playerPosition}>{player.position}</Text>
      </View>
      {rightElement}
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📅</Text>
            <Text style={styles.infoText}>{peladaInfo.date}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={styles.infoText}>{peladaInfo.location}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>💵</Text>
            <Text style={styles.infoText}>R$ {peladaInfo.price.toFixed(2).replace('.', ',')}</Text>
          </View>
        </Card>

        <View style={styles.statsRow}>
          <View style={[styles.statCard, styles.statGreen]}>
            <Text style={styles.statNumberGreen}>12</Text>
            <Text style={styles.statLabel}>Confirmados</Text>
          </View>
          <View style={[styles.statCard, styles.statYellow]}>
            <Text style={styles.statNumberYellow}>4</Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
          <View style={[styles.statCard, styles.statGray]}>
            <Text style={styles.statNumberGray}>2</Text>
            <Text style={styles.statLabel}>Recusaram</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>✅ Confirmados ({confirmedPlayers.length})</Text>
          <Card style={styles.playersCard}>
            {confirmedPlayers.map((player) =>
              renderPlayerRow(player, <Badge text="Confirmado" type="success" />)
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>⏳ Pendentes ({pendingPlayers.length})</Text>
          <Card style={styles.playersCard}>
            {pendingPlayers.map((player) =>
              renderPlayerRow(
                player,
                <Button
                  title="Lembrar"
                  type="outline"
                  size="small"
                  buttonStyle={styles.remindButton}
                  textStyle={styles.remindButtonText}
                  onPress={() => {}}
                />
              )
            )}
          </Card>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionHeader}>❌ Recusaram ({declinedPlayers.length})</Text>
          <Card style={styles.playersCard}>
            {declinedPlayers.map((player) =>
              renderPlayerRow(player, <Badge text="Ausente" type="neutral" />)
            )}
          </Card>
        </View>

        <View style={styles.waitlistBanner}>
          <Text style={styles.waitlistIcon}>👥</Text>
          <View style={styles.waitlistInfo}>
            <Text style={styles.waitlistTitle}>Fila de Espera ({waitlist.count})</Text>
            <Text style={styles.waitlistSubtitle}>{waitlist.subtitle}</Text>
          </View>
        </View>

        <Button
          title="Escalar Times"
          type="primary"
          onPress={() => onNavigate('escalarTimes')}
          buttonStyle={styles.bottomButton}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  infoCard: {
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoRowLast: {
    marginBottom: 0,
  },
  infoIcon: {
    fontSize: 18,
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#2C3E50',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statGreen: {
    backgroundColor: '#F0FFF4',
  },
  statYellow: {
    backgroundColor: '#FFFCF0',
  },
  statGray: {
    backgroundColor: '#F9FAFB',
  },
  statNumberGreen: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  statNumberYellow: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F5A623',
  },
  statNumberGray: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#9CA3AF',
  },
  statLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 4,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginBottom: 8,
  },
  playersCard: {
    padding: 12,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  playerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  playerName: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C3E50',
  },
  playerPosition: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  remindButton: {
    borderColor: '#F5A623',
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  remindButtonText: {
    color: '#F5A623',
    fontSize: 12,
    fontWeight: '600',
  },
  waitlistBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  waitlistIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  waitlistInfo: {
    flex: 1,
  },
  waitlistTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#92400E',
  },
  waitlistSubtitle: {
    fontSize: 12,
    color: '#B45309',
    marginTop: 2,
  },
  bottomButton: {
    marginTop: 8,
  },
});

export default PeladaScreen;