import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Toggle from '../components/Toggle';

const MaisScreen = () => {
  const [autoSort, setAutoSort] = useState(true);
  const [balanceSkill, setBalanceSkill] = useState(true);
  const [reminder24h, setReminder24h] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(true);
  const [autoCharge, setAutoCharge] = useState(true);
  const [rankingNotif, setRankingNotif] = useState(false);

  const renderChevron = (color = '#9CA3AF') => (
    <Text style={[styles.chevron, { color }]}>›</Text>
  );

  const renderRow = ({
    emoji,
    title,
    subtitle,
    right,
    titleColor = '#2C3E50',
    showBorder = true,
  }) => (
    <View style={[styles.row, showBorder && styles.rowBorder]}>
      <Text style={styles.rowEmoji}>{emoji}</Text>
      <View style={styles.rowTextContainer}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <View style={styles.rowRight}>{right}</View>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      {/* GROUP INFO CARD */}
      <Card style={styles.groupCard}>
        <View style={styles.groupRow}>
          <View style={styles.groupAvatar}>
            <Text style={styles.groupAvatarEmoji}>⚽</Text>
          </View>
          <View style={styles.groupInfo}>
            <Text style={styles.groupName}>Pelada da Turma</Text>
            <Text style={styles.groupMeta}>16 jogadores • Futebol Society</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.editLinkWrap}>
          <Text style={styles.editLink}>Editar Grupo</Text>
        </TouchableOpacity>
      </Card>

      {/* REGRAS DO GRUPO */}
      <Text style={styles.sectionHeader}>Regras do Grupo</Text>
      <Card style={styles.sectionCard}>
        {renderRow({
          emoji: '🔀',
          title: 'Sorteio automático de times',
          right: <Toggle value={autoSort} onValueChange={setAutoSort} />,
        })}
        {renderRow({
          emoji: '⭐',
          title: 'Equilibrar por habilidade',
          right: <Toggle value={balanceSkill} onValueChange={setBalanceSkill} />,
        })}
        {renderRow({
          emoji: '⏱️',
          title: 'Duração padrão',
          right: (
            <View style={styles.rowRightInline}>
              <Text style={styles.rowRightText}>60 min</Text>
              {renderChevron()}
            </View>
          ),
        })}
        {renderRow({
          emoji: '👥',
          title: 'Jogadores por time',
          right: (
            <View style={styles.rowRightInline}>
              <Text style={styles.rowRightText}>5</Text>
              {renderChevron()}
            </View>
          ),
          showBorder: false,
        })}
      </Card>

      {/* NOTIFICAÇÕES */}
      <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Notificações</Text>
      <Card style={styles.sectionCard}>
        {renderRow({
          emoji: '🔔',
          title: 'Lembrete de pelada (24h antes)',
          right: <Toggle value={reminder24h} onValueChange={setReminder24h} />,
        })}
        {renderRow({
          emoji: '💬',
          title: 'Lembrete via WhatsApp',
          right: <Toggle value={whatsappReminder} onValueChange={setWhatsappReminder} />,
        })}
        {renderRow({
          emoji: '💰',
          title: 'Cobrança automática de pagamentos',
          right: <Toggle value={autoCharge} onValueChange={setAutoCharge} />,
        })}
        {renderRow({
          emoji: '🏆',
          title: 'Notificação de ranking atualizado',
          right: <Toggle value={rankingNotif} onValueChange={setRankingNotif} />,
          showBorder: false,
        })}
      </Card>

      {/* GESTÃO DE ACESSOS */}
      <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced]}>Gestão de Acessos</Text>
      <Card style={styles.sectionCard}>
        {renderRow({
          emoji: '👤',
          title: 'Convidar jogadores',
          subtitle: 'Link e código de convite',
          right: renderChevron(),
        })}
        {renderRow({
          emoji: '🛡️',
          title: 'Permissões de administrador',
          subtitle: 'Apenas organizador',
          right: renderChevron(),
          showBorder: false,
        })}
      </Card>

      {/* ZONA DE RISCO */}
      <Text style={[styles.sectionHeader, styles.sectionHeaderSpaced, styles.sectionHeaderDanger]}>
        Zona de Risco
      </Text>
      <Card style={[styles.sectionCard, styles.dangerCard]}>
        {renderRow({
          emoji: '🚪',
          title: 'Sair do grupo',
          titleColor: '#6B7280',
          right: renderChevron(),
        })}
        {renderRow({
          emoji: '🗑️',
          title: 'Excluir grupo',
          titleColor: '#E74C3C',
          right: renderChevron('#E74C3C'),
          showBorder: false,
        })}
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F5F5F5',
  },
  groupCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F0FFF4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupAvatarEmoji: {
    fontSize: 28,
  },
  groupInfo: {
    flex: 1,
    marginLeft: 12,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C3E50',
  },
  groupMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  editLinkWrap: {
    marginTop: 12,
  },
  editLink: {
    fontSize: 14,
    color: '#378ADD',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2C3E50',
    marginBottom: 8,
  },
  sectionHeaderSpaced: {
    marginTop: 20,
  },
  sectionHeaderDanger: {
    color: '#E74C3C',
  },
  sectionCard: {
    padding: 4,
    borderRadius: 8,
  },
  dangerCard: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  rowEmoji: {
    fontSize: 16,
    marginRight: 10,
  },
  rowTextContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    color: '#2C3E50',
  },
  rowSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 2,
  },
  rowRight: {
    marginLeft: 8,
  },
  rowRightInline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowRightText: {
    fontSize: 14,
    color: '#6B7280',
    marginRight: 6,
  },
  chevron: {
    fontSize: 18,
    color: '#9CA3AF',
  },
});

export default MaisScreen;