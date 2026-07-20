import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Avatar from '../components/Avatar';
import Badge from '../components/Badge';
import Card from '../components/Card';

const JogadoresScreen = ({ onNavigate }) => {
  const [players] = useState([
    { id: 1, name: 'Pedro Santos', position: 'Atacante', confirmed: true, paid: true },
    { id: 2, name: 'João Silva', position: 'Goleiro', confirmed: true, paid: false },
    { id: 3, name: 'Lucas Lima', position: 'Meia', confirmed: false, paid: true },
    { id: 4, name: 'Rafael Costa', position: 'Zagueiro', confirmed: true, paid: true },
    { id: 5, name: 'Diego Souza', position: 'Lateral', confirmed: false, paid: false },
    { id: 6, name: 'Marcos Silva', position: 'Atacante', confirmed: true, paid: true },
    { id: 7, name: 'Bruno Alves', position: 'Meia', confirmed: false, paid: true },
    { id: 8, name: 'Carlos Eduardo', position: 'Zagueiro', confirmed: true, paid: false },
  ]);

  const handlePlayerPress = (player) => {
    const positionMap = {
      'Atacante': 'Atacante',
      'Goleiro': 'Goleiro',
      'Meia': 'Meia',
      'Zagueiro': 'Zagueiro',
      'Lateral': 'Lateral',
    };
    onNavigate('perfil', {
      name: player.name,
      position: positionMap[player.position] || player.position,
      goals: player.confirmed ? 3 : 1,
      games: player.confirmed ? 15 : 8,
      presence: player.confirmed ? 85 : 60,
      stars: player.confirmed ? 4 : 2,
      memberSince: player.confirmed ? 'Jan 2025' : 'Mar 2025',
      debtAmount: player.paid ? 0 : 15.00,
      debtEvent: player.paid ? '' : 'Pelada 03/07',
      stats: {
        gols: player.confirmed ? 3 : 1,
        assists: player.confirmed ? 5 : 2,
        defesas: player.position === 'Goleiro' ? 23 : 0,
        cartoes: '2 Amarelos',
      },
    });
  };

  const renderStars = (count) => {
    const stars = [];
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Text key={i} style={[styles.star, i < count && styles.starActive]}>
          ★
        </Text>
      );
    }
    return <View style={styles.starsRow}>{stars}</View>;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Jogadores</Text>

      <Card style={styles.card}>
        {players.map((player, index) => (
          <View key={player.id}>
            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => handlePlayerPress(player)}
            >
              <Avatar name={player.name} size={44} />

              <View style={styles.info}>
                <Text style={styles.name}>{player.name}</Text>
                <Text style={styles.position}>{player.position}</Text>
                {renderStars(player.confirmed ? 4 : 2)}
              </View>

              <View style={styles.badges}>
                <Badge
                  label={player.confirmed ? 'Confirmado' : 'Pendente'}
                  variant={player.confirmed ? 'success' : 'warning'}
                />
                <Badge
                  label={player.paid ? 'Em dia' : 'Devedor'}
                  variant={player.paid ? 'success' : 'danger'}
                />
              </View>
            </TouchableOpacity>

            {index < players.length - 1 && <View style={styles.separator} />}
          </View>
        ))}
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F7A3D',
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E6F4EA',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  name: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1F7A3D',
  },
  position: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  starsRow: {
    flexDirection: 'row',
    marginTop: 4,
  },
  star: {
    fontSize: 12,
    color: '#D1D5DB',
    marginRight: 1,
  },
  starActive: {
    color: '#F5B301',
  },
  badges: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 4,
  },
  separator: {
    height: 1,
    backgroundColor: '#E6F4EA',
    marginHorizontal: 4,
  },
});

export default JogadoresScreen;