import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Toggle from '../components/Toggle';

const PosJogoScreen = () => {
  const [payments, setPayments] = useState({
    pedro: true,
    lucas: true,
    marcos: false,
    joao: false,
  });

  const togglePayment = (key) => {
    setPayments((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const paidCount = Object.values(payments).filter(Boolean).length;
  const totalPlayers = 4;
  const perPlayer = 15;
  const totalAmount = totalPlayers * perPlayer;
  const receivedAmount = paidCount * perPlayer;

  const renderGoalRow = (player, minute, dotColor, isLast) => (
    <View
      key={`${player}-${minute}`}
      style={[styles.goalRow, !isLast && styles.rowSeparator]}
    >
      <View style={[styles.goalDot, { backgroundColor: dotColor }]} />
      <View style={styles.goalInfo}>
        <Text style={styles.goalPlayer}>{player}</Text>
        <Text style={styles.goalLabel}>Gol</Text>
      </View>
      <Text style={styles.goalMinute}>{minute}</Text>
    </View>
  );

  const renderPaymentRow = (name, value, onToggle, isLast) => (
    <View
      key={name}
      style={[styles.paymentRow, !isLast && styles.rowSeparator]}
    >
      <Avatar name={name} size={28} radius={14} />
      <Text style={styles.paymentName}>{name}</Text>
      <Toggle value={value} onValueChange={onToggle} />
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* RESULT CARD */}
      <Card style={styles.resultCard}>
        <View style={styles.resultTopRow}>
          <Text style={styles.resultStatus}>✅ Partida Finalizada</Text>
          <Text style={styles.resultDate}>10/07 • 19:00</Text>
        </View>

        <View style={styles.scoreContainer}>
          <View style={styles.teamColumn}>
            <View style={styles.teamBadgeYellow}>
              <Text style={styles.teamBadgeText}>A</Text>
            </View>
            <Text style={styles.teamNameYellow}>Time A</Text>
            <Text style={styles.teamScore}>3</Text>
          </View>

          <Text style={styles.scoreX}>x</Text>

          <View style={[styles.teamColumn, styles.teamColumnRight]}>
            <View style={styles.teamBadgeBlue}>
              <Text style={styles.teamBadgeText}>B</Text>
            </View>
            <Text style={styles.teamNameBlue}>Time B</Text>
            <Text style={styles.teamScore}>2</Text>
          </View>
        </View>

        <Text style={styles.resultLocation}>📍 Quadra do Parque • ⏱ 60 min</Text>
      </Card>

      {/* MVP CARD */}
      <Card style={styles.mvpCard}>
        <Text style={styles.sectionTitle}>🏆 MVP da Partida</Text>
        <View style={styles.mvpContent}>
          <Avatar name="Pedro Santos" size={56} radius={28} />
          <View style={styles.mvpInfo}>
            <Text style={styles.mvpName}>Pedro Santos</Text>
            <Text style={styles.mvpStats}>⚽ 2 gols • 👟 1 assistência</Text>
          </View>
          <View style={styles.mvpRating}>
            <Text style={styles.mvpScore}>9.5</Text>
            <Text style={styles.mvpStar}>⭐</Text>
          </View>
        </View>
      </Card>

      {/* GOLS SECTION */}
      <View style={styles.sectionWrapper}>
        <Text style={styles.sectionTitle}>⚽ Gols da Partida</Text>
        <Card style={styles.listCard}>
          {renderGoalRow('Pedro Santos (A)', "12'", '#F5A623', false)}
          {renderGoalRow('Pedro Santos (A)', "28'", '#F5A623', false)}
          {renderGoalRow('Marcos Silva (B)', "18'", '#378ADD', false)}
          {renderGoalRow('João Oliveira (B)', "35'", '#378ADD', false)}
          {renderGoalRow('Diego Souza (A)', "52'", '#F5A623', true)}
        </Card>
      </View>

      {/* PAGAMENTOS SECTION */}
      <View style={styles.sectionWrapper}>
        <Text style={styles.sectionTitle}>💰 Pagamentos</Text>
        <Text style={styles.sectionSubtitle}>Rateio: R$ 15,00 por jogador</Text>
        <Card style={styles.listCard}>
          {renderPaymentRow('Pedro Santos', payments.pedro, () => togglePayment('pedro'), false)}
          {renderPaymentRow('Lucas Lima', payments.lucas, () => togglePayment('lucas'), false)}
          {renderPaymentRow('Marcos Silva', payments.marcos, () => togglePayment('marcos'), false)}
          {renderPaymentRow('João Oliveira', payments.joao, () => togglePayment('joao'), true)}

          <View style={styles.paymentsSummary}>
            <Text style={styles.paymentsSummaryText}>
              {paidCount} de {totalPlayers} pagamentos recebidos
            </Text>
            <Text style={styles.paymentsSummaryAmount}>
              R$ {receivedAmount.toFixed(2).replace('.', ',')} de R$ {totalAmount.toFixed(2).replace('.', ',')}
            </Text>
          </View>
        </Card>
      </View>

      {/* BOTTOM BUTTON */}
      <TouchableOpacity style={styles.bottomButton} activeOpacity={0.85}>
        <Text style={styles.bottomButtonText}>✅ Concluir</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  resultCard: {
    backgroundColor: '#1D9E75',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
  },
  resultTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  resultStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultDate: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
  },
  scoreContainer: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamColumn: {
    alignItems: 'center',
    marginRight: 16,
  },
  teamColumnRight: {
    marginLeft: 16,
    marginRight: 0,
  },
  teamBadgeYellow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamBadgeBlue: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#378ADD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 2,
  },
  teamNameYellow: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F5A623',
    marginTop: 4,
  },
  teamNameBlue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#378ADD',
    marginTop: 4,
  },
  teamScore: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  scoreX: {
    fontSize: 20,
    color: '#FFFFFF',
    opacity: 0.7,
    marginHorizontal: 12,
  },
  resultLocation: {
    marginTop: 12,
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.7,
    textAlign: 'center',
  },
  mvpCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  mvpContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  mvpInfo: {
    flex: 1,
    marginLeft: 12,
  },
  mvpName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2C3E50',
  },
  mvpStats: {
    fontSize: 12,
    color: '#1D9E75',
    marginTop: 4,
  },
  mvpRating: {
    alignItems: 'center',
  },
  mvpScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#F5A623',
  },
  mvpStar: {
    fontSize: 16,
  },
  sectionWrapper: {
    marginBottom: 16,
  },
  listCard: {
    borderRadius: 8,
    padding: 4,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  goalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  goalInfo: {
    flex: 1,
  },
  goalPlayer: {
    fontSize: 13,
    fontWeight: '500',
    color: '#2C3E50',
  },
  goalLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },
  goalMinute: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  rowSeparator: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  paymentName: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: '500',
    color: '#2C3E50',
  },
  paymentsSummary: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 6,
  },
  paymentsSummaryText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  paymentsSummaryAmount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1D9E75',
    marginTop: 2,
  },
  bottomButton: {
    marginTop: 8,
    marginBottom: 32,
    backgroundColor: '#1D9E75',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default PosJogoScreen;