import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import Toggle from '../components/Toggle';

const DEFAULT_PLAYER = {
  name: 'João Silva',
  position: 'Goleiro',
  stars: 4,
  memberSince: 'Jan 2025',
  games: 28,
  goals: 2,
  presence: 85,
  debtAmount: 15.00,
  debtEvent: 'Pelada 03/07',
  stats: {
    gols: 2,
    assists: 5,
    defesas: 23,
    cartoes: '3 Amarelos, 0 Vermelhos',
  },
};

const COLORS = {
  white: '#FFFFFF',
  bg: '#F5F5F5',
  primary: '#1D9E75',
  secondary: '#378ADD',
  accent: '#F5A623',
  danger: '#E74C3C',
  text: '#2C3E50',
  gray: '#6B7280',
  border: '#F3F4F6',
  avatarBg: '#F0FFF4',
};

function renderStars(count) {
  const full = '★'.repeat(count);
  const empty = '☆'.repeat(Math.max(0, 5 - count));
  return full + empty;
}

function formatCurrency(value) {
  return 'R$ ' + Number(value).toFixed(2).replace('.', ',');
}

const PerfilScreen = ({ player = DEFAULT_PLAYER }) => {
  const p = { ...DEFAULT_PLAYER, ...player, stats: { ...DEFAULT_PLAYER.stats, ...(player && player.stats) } };
  const [going, setGoing] = useState(null);

  return (
    <ScrollView style={styles.container}>
      {/* 1. PROFILE HEADER */}
      <Card style={styles.headerCard}>
        <View style={styles.headerCenter}>
          <Avatar
            name={p.name}
            size={80}
            radius={40}
            backgroundColor={COLORS.avatarBg}
            style={styles.avatar}
          />
          <Text style={styles.name}>{p.name}</Text>
          <View style={styles.positionRow}>
            <View style={styles.positionBadge}>
              <Text style={styles.positionText}>{p.position}</Text>
            </View>
            <Text style={styles.stars}>{renderStars(p.stars)}</Text>
          </View>
          <Text style={styles.memberSince}>Membro desde {p.memberSince}</Text>
        </View>
      </Card>

      {/* 2. STAT CARDS ROW */}
      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.primary }]}>{p.games}</Text>
          <Text style={styles.statLabel}>Jogos</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.accent }]}>{p.goals}</Text>
          <Text style={styles.statLabel}>Gols</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={[styles.statValue, { color: COLORS.secondary }]}>{p.presence}%</Text>
          <Text style={styles.statLabel}>Presença</Text>
        </Card>
      </View>

      {/* 3. PRÓXIMA PELADA */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📅 Próxima Pelada</Text>
        <Text style={styles.eventDate}>Quarta, 10/07 às 19:00</Text>
        <Text style={styles.eventLocation}>📍 Quadra do Parque</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.goButton,
              going === true && styles.goButtonActive,
            ]}
            onPress={() => setGoing(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.goButtonText}>✅ Vou Jogar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.actionButton,
              styles.noButton,
              going === false && styles.noButtonActive,
            ]}
            onPress={() => setGoing(false)}
            activeOpacity={0.8}
          >
            <Text style={styles.noButtonText}>❌ Não Vou</Text>
          </TouchableOpacity>
        </View>
      </Card>

      {/* 4. SITUAÇÃO FINANCEIRA */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💰 Situação Financeira</Text>
        <Text style={styles.debtLabel}>Você deve</Text>
        <Text style={styles.debtAmount}>{formatCurrency(p.debtAmount)}</Text>
        <TouchableOpacity style={styles.payButton} activeOpacity={0.8}>
          <Text style={styles.payButtonText}>Pagar via PIX</Text>
        </TouchableOpacity>
        <Text style={styles.debtRef}>Ref. {p.debtEvent}</Text>
      </Card>

      {/* 5. ESTATÍSTICAS */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>📊 Minhas Estatísticas</Text>

        <View style={styles.statItemBorder}>
          <Text style={styles.statItemLabel}>⚽ Gols</Text>
          <Text style={styles.statItemValue}>{p.stats.gols}</Text>
        </View>

        <View style={styles.statItemBorder}>
          <Text style={styles.statItemLabel}>👟 Assistências</Text>
          <Text style={styles.statItemValue}>{p.stats.assists}</Text>
        </View>

        <View style={styles.statItemBorder}>
          <Text style={styles.statItemLabel}>🧤 Defesas</Text>
          <Text style={styles.statItemValue}>{p.stats.defesas}</Text>
        </View>

        <View style={styles.statItemLast}>
          <Text style={styles.statItemLabel}>🟨 Cartões</Text>
          <Text style={styles.statItemValueSmall}>{p.stats.cartoes}</Text>
        </View>
      </Card>

      <View style={{ marginBottom: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  headerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerCenter: {
    alignItems: 'center',
  },
  avatar: {
    marginBottom: 12,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    fontFamily: 'Inter',
  },
  positionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  positionBadge: {
    borderColor: COLORS.secondary,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginRight: 8,
  },
  positionText: {
    fontSize: 12,
    color: COLORS.secondary,
    fontFamily: 'Inter',
  },
  stars: {
    fontSize: 14,
    color: COLORS.accent,
    fontFamily: 'Inter',
  },
  memberSince: {
    fontSize: 12,
    color: COLORS.gray,
    textAlign: 'center',
    marginTop: 8,
    fontFamily: 'Inter',
  },
  statRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'Inter',
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 4,
    fontFamily: 'Inter',
  },
  sectionCard: {
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Inter',
  },
  eventDate: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 8,
    fontFamily: 'Inter',
  },
  eventLocation: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 2,
    fontFamily: 'Inter',
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  goButton: {
    backgroundColor: COLORS.primary,
  },
  goButtonActive: {
    opacity: 0.85,
  },
  goButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  noButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.danger,
  },
  noButtonActive: {
    opacity: 0.85,
  },
  noButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  debtLabel: {
    fontSize: 12,
    color: COLORS.gray,
    marginTop: 8,
    fontFamily: 'Inter',
  },
  debtAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.danger,
    fontFamily: 'Inter',
  },
  payButton: {
    backgroundColor: COLORS.primary,
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  payButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  debtRef: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 8,
    fontFamily: 'Inter',
  },
  statItemBorder: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statItemLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statItemLabel: {
    fontSize: 13,
    color: COLORS.gray,
    fontFamily: 'Inter',
  },
  statItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: 'Inter',
  },
  statItemValueSmall: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
});

export default PerfilScreen;