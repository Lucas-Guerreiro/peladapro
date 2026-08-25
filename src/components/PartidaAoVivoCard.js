import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import tokens from '../theme/tokens';

const PartidaAoVivoCard = ({
  teamAName = 'Time A',
  teamBName = 'Time B',
  scoreA = 0,
  scoreB = 0,
  timerStr = '14:05',
  periodStr = '1º Tempo',
  proximaReveza = true,
  revezaText = 'PRÓXIMA REVEZA',
  onPause,
  onGoalA,
  onGoalB,
  style,
}) => {
  // Animação de pulso para o ponto vermelho
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.25,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.cardContainer, style]}>
      {/* 1. CABEÇALHO (VERDE PRIMÁRIO #1D9E75 COM BADGE "AO VIVO" E PONTO VERMELHO PULSANTE) */}
      <View style={styles.headerRow}>
        <View style={styles.liveBadge}>
          <Animated.View style={[styles.pulsingDot, { opacity: pulseAnim }]} />
          <Text style={styles.liveBadgeText}>AO VIVO</Text>
        </View>

        <View style={styles.timerContainer}>
          <Ionicons name="time-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
          <Text style={styles.timerText}>{timerStr}</Text>
          <Text style={styles.periodBadge}>{periodStr}</Text>
        </View>

        {onPause && (
          <TouchableOpacity
            style={styles.pauseButton}
            onPress={onPause}
            accessibilityRole="button"
            accessibilityLabel="Pausar ou Retomar Cronômetro"
          >
            <Ionicons name="pause" size={16} color="#FFFFFF" />
          </TouchableOpacity>
        )}
      </View>

      {/* BODY DO CARD */}
      <View style={styles.cardBody}>
        {/* TIMES E PLACAR CENTRAL */}
        <View style={styles.matchRow}>
          {/* TIME A */}
          <View style={styles.teamContainer}>
            <View style={[styles.teamBadgeCircle, styles.teamBadgeA]}>
              <Text style={styles.teamBadgeText}>A</Text>
            </View>
            <Text style={styles.teamNameA} numberOfLines={1}>
              {teamAName}
            </Text>
          </View>

          {/* 3. PLACAR EM CARD CENTRAL ESCURO (#2C3E50) COM NÚMEROS GRANDES BRANCOS */}
          <View style={styles.scoreboardCenterCard}>
            <View style={styles.scoreNumberBox}>
              <Text style={styles.scoreNumber}>{scoreA}</Text>
            </View>
            <Text style={styles.scoreDivider}>x</Text>
            <View style={styles.scoreNumberBox}>
              <Text style={styles.scoreNumber}>{scoreB}</Text>
            </View>
          </View>

          {/* TIME B */}
          <View style={styles.teamContainer}>
            <View style={[styles.teamBadgeCircle, styles.teamBadgeB]}>
              <Text style={styles.teamBadgeText}>B</Text>
            </View>
            <Text style={styles.teamNameB} numberOfLines={1}>
              {teamBName}
            </Text>
          </View>
        </View>

        {/* 5. RODÍZIO: CHIP CENTRALIZADO AMARELO COM ÍCONE DE TROCA (REFRESH) */}
        {proximaReveza && (
          <View style={styles.rotationChipContainer}>
            <View style={styles.rotationChip}>
              <Ionicons name="refresh" size={14} color="#B45309" style={{ marginRight: 6 }} />
              <Text style={styles.rotationChipText}>{revezaText}</Text>
            </View>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: tokens.colors.neutralSurface || '#FFFFFF',
    borderRadius: tokens.radius.lg || 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: tokens.colors.neutralBorder || '#E5E7EB',
  },
  headerRow: {
    backgroundColor: tokens.colors.primary || '#1D9E75', // Verde primário
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: tokens.colors.danger || '#E74C3C', // Ponto vermelho pulsante
    marginRight: 6,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timerText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginRight: 6,
  },
  periodBadge: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 11,
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pauseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: 16,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  teamContainer: {
    flex: 1,
    alignItems: 'center',
  },
  teamBadgeCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  teamBadgeA: {
    backgroundColor: tokens.colors.accent || '#F5A623', // Amarelo para Time A
  },
  teamBadgeB: {
    backgroundColor: tokens.colors.secondary || '#378ADD', // Azul para Time B
  },
  teamBadgeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  teamNameA: {
    color: tokens.colors.accent || '#F5A623', // Nome na cor do time (Amarelo)
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  teamNameB: {
    color: tokens.colors.secondary || '#378ADD', // Nome na cor do time (Azul)
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  scoreboardCenterCard: {
    backgroundColor: tokens.colors.neutralDark || '#2C3E50', // Card central escuro
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  scoreNumberBox: {
    minWidth: 32,
    alignItems: 'center',
  },
  scoreNumber: {
    color: '#FFFFFF', // Números grandes brancos
    fontSize: 32,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  scoreDivider: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 20,
    fontWeight: '700',
    marginHorizontal: 8,
  },
  rotationChipContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  rotationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7', // Fundo amarelo claro
    borderColor: '#FCD34D',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  rotationChipText: {
    color: '#B45309', // Texto escuro em tom amarelo/dourado
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});

export default PartidaAoVivoCard;
