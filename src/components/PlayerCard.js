import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { darken, getContrastColor } from '../utils/colors';

// Constantes de cores premium do sistema
const GOLD_PRIMARY = '#D4AF37';
const GOLD_LIGHT = '#F5D270';
const DEFAULT_PRIMARY = '#1D9E75';
const DEFAULT_SECONDARY = '#0A1F16';

/**
 * Componente Reutilizável PlayerCard - Estilo FIFA Ultimate Team (FUT)
 * Suporta cores 100% dinâmicas do time do atleta vindas do Supabase
 */
export default function PlayerCard({
  nome = 'ATLETA',
  posicao = 'MEI',
  idade = 25,
  jogos = 0,
  gols = 0,
  rating = 99,
  primaryColor = DEFAULT_PRIMARY,
  secondaryColor = DEFAULT_SECONDARY,
  nacionalidade = { code: 'BRA', flagEmoji: '🇧🇷' },
  timeNome = 'PELADA PRO',
  timeFlagUrl,
  adquirido = false,
  foto,
}) {
  // Animação de brilho pulsante para card adquirido VIP
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  // Trata cores nulas ou vazias utilizando o fallback obrigatório
  const safePrimary = primaryColor && primaryColor.trim() !== '' ? primaryColor : DEFAULT_PRIMARY;
  const safeSecondary = secondaryColor && secondaryColor.trim() !== '' ? secondaryColor : DEFAULT_SECONDARY;

  // Gera a cor escura de borda aplicando o escurecimento de ~20% em runtime
  const darkSecondary = darken(safeSecondary, 20);

  // Determina contraste de cor de texto para os rótulos internos
  const textColor = getContrastColor(safePrimary);

  // Efeito de pulso de brilho metálico se o card estiver adquirido
  useEffect(() => {
    if (adquirido) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.4, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [adquirido]);

  // Formata abreviação da posição para padrão 3 letras
  const posAbbr = (posicao || 'MEI').substring(0, 3).toUpperCase();

  // Código da nacionalidade (default BRA)
  const nacCode = typeof nacionalidade === 'object' ? (nacionalidade.code || 'BRA') : 'BRA';
  const nacEmoji = typeof nacionalidade === 'object' ? (nacionalidade.flagEmoji || '🇧🇷') : '🇧🇷';

  return (
    <View
      style={styles.outerContainer}
      accessibilityLabel={`Card de atleta FUT de ${nome}`}
      accessibilityRole="summary"
    >
      {/* Moldura externa metálica dourada com gradiente do time */}
      <Animated.View
        style={[
          styles.glowBorder,
          adquirido && { opacity: glowAnim, borderColor: GOLD_LIGHT },
        ]}
      >
        <LinearGradient
          colors={[darkSecondary, safePrimary, darkSecondary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.cardFrame}
        >
          {/* Textura de pontos sutil (Dot Matrix Matrix Overlay) */}
          <View style={styles.dotMatrixOverlay} pointerEvents="none">
            {[...Array(6)].map((_, r) => (
              <View key={r} style={styles.dotRow}>
                {[...Array(8)].map((_, c) => (
                  <View key={c} style={styles.dotPoint} />
                ))}
              </View>
            ))}
          </View>

          {/* Topo do Card: Rating + Posição (Esquerda) e Bandeiras (Direita) */}
          <View style={styles.topHeader}>
            {/* Canto Esquerdo: Rating 0-99 + Posição */}
            <View style={styles.ratingStack}>
              <Text style={styles.ratingValue}>{rating}</Text>
              <Text style={styles.posicaoText}>{posAbbr}</Text>
            </View>

            {/* Canto Direito: Nacionalidade + Escudo do Time */}
            <View style={styles.flagsStack}>
              {/* Bandeira e código da Nacionalidade */}
              <View style={styles.flagItem}>
                <Text style={styles.flagEmoji}>{nacEmoji}</Text>
                <Text style={styles.flagCode}>{nacCode}</Text>
              </View>

              {/* Ícone e nome curto do Time */}
              <View style={styles.flagItem}>
                {timeFlagUrl ? (
                  <Image source={{ uri: timeFlagUrl }} style={styles.timeLogoImg} />
                ) : (
                  <Ionicons name="shield-checkmark" size={14} color={GOLD_LIGHT} />
                )}
                <Text style={styles.flagCode} numberOfLines={1}>
                  {timeNome ? timeNome.substring(0, 3).toUpperCase() : 'PEL'}
                </Text>
              </View>
            </View>
          </View>

          {/* Elemento Central: Foto do Atleta com anel metálico ou Bola Dourada */}
          <View style={styles.centerSection}>
            <View style={styles.avatarGlowRing}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.avatarImg} />
              ) : (
                <View style={styles.ballFallback}>
                  <Ionicons name="football" size={42} color={GOLD_PRIMARY} style={styles.footballIcon} />
                </View>
              )}
            </View>
          </View>

          {/* Faixa Central: Nome do Atleta em Caixa Alta Dourada */}
          <View style={styles.namePlate}>
            <Text style={styles.athleteName} numberOfLines={1}>
              {nome.toUpperCase()}
            </Text>
          </View>

          {/* Estatísticas Exibidas: IDADE | JOGOS | GOLS */}
          <View style={styles.statsContainer}>
            {/* IDADE */}
            <View style={styles.statCol}>
              <View style={styles.statHeaderRow}>
                <Ionicons name="calendar-outline" size={12} color={GOLD_LIGHT} />
                <Text style={styles.statLabel}>IDADE</Text>
              </View>
              <Text style={styles.statValue}>{idade}</Text>
            </View>

            <View style={styles.statDivider} />

            {/* JOGOS */}
            <View style={styles.statCol}>
              <View style={styles.statHeaderRow}>
                <Ionicons name="shirt-outline" size={12} color={GOLD_LIGHT} />
                <Text style={styles.statLabel}>JOGOS</Text>
              </View>
              <Text style={styles.statValue}>{jogos}</Text>
            </View>

            <View style={styles.statDivider} />

            {/* GOLS */}
            <View style={styles.statCol}>
              <View style={styles.statHeaderRow}>
                <Ionicons name="football-outline" size={12} color={GOLD_LIGHT} />
                <Text style={styles.statLabel}>GOLS</Text>
              </View>
              <Text style={styles.statValue}>{gols}</Text>
            </View>
          </View>

          {/* Selo de Status: ATIVO/VIP para adquiridos vs Bloqueado para não adquiridos */}
          {adquirido ? (
            <View style={styles.vipBadgeContainer}>
              <Ionicons name="checkmark-circle" size={14} color="#FFF" />
              <Text style={styles.vipBadgeText}>VIP ATIVO</Text>
            </View>
          ) : (
            <View style={styles.lockedOverlay}>
              <Ionicons name="lock-closed" size={14} color={GOLD_LIGHT} />
              <Text style={styles.lockedText}>Card Desbloqueável</Text>
            </View>
          )}
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

// ── ESTILOS ESTÁTICOS DO COMPONENTE ─────────────────────────────────────────
const { width } = Dimensions.get('window');
const CARD_WIDTH = Math.min(width - 48, 320);
const CARD_HEIGHT = CARD_WIDTH * 1.35; // Proporção ~3:4

const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  glowBorder: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: GOLD_PRIMARY,
    shadowColor: GOLD_PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
  },
  cardFrame: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between',
    position: 'relative',
  },
  dotMatrixOverlay: {
    position: 'absolute',
    inset: 0,
    padding: 20,
    justifyContent: 'space-around',
    opacity: 0.12,
  },
  dotRow: {
    flexDirection: 'row',
    justify-content: 'space-around',
  },
  dotPoint: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#FFF',
  },
  topHeader: {
    flexDirection: 'row',
    justify-content: 'space-between',
    alignItems: 'flex-start',
    zIndex: 2,
  },
  ratingStack: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
  },
  ratingValue: {
    fontSize: 26,
    fontWeight: '900',
    color: GOLD_LIGHT,
    lineHeight: 28,
  },
  posicaoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
  flagsStack: {
    alignItems: 'flex-end',
    gap: 6,
  },
  flagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.3)',
  },
  flagEmoji: {
    fontSize: 12,
  },
  flagCode: {
    fontSize: 10,
    fontWeight: '800',
    color: GOLD_LIGHT,
    letterSpacing: 0.5,
  },
  timeLogoImg: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
    zIndex: 2,
  },
  avatarGlowRing: {
    width: 86,
    height: 86,
    borderRadius: 43,
    borderWidth: 3,
    borderColor: GOLD_PRIMARY,
    shadowColor: GOLD_PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  ballFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  footballIcon: {
    textShadowColor: 'rgba(212, 175, 55, 0.8)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  namePlate: {
    alignItems: 'center',
    borderBottomWidth: 1.5,
    borderBottomColor: 'rgba(212, 175, 55, 0.5)',
    paddingBottom: 4,
    marginHorizontal: 12,
    zIndex: 2,
  },
  athleteName: {
    fontSize: 20,
    fontWeight: '900',
    color: GOLD_LIGHT,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  statsContainer: {
    flexDirection: 'row',
    justify-content: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: 6,
    marginHorizontal: 4,
    zIndex: 2,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: GOLD_LIGHT,
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFF',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
  },
  vipBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(212, 175, 55, 0.3)',
    borderWidth: 1,
    borderColor: GOLD_PRIMARY,
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'center',
    zIndex: 2,
  },
  vipBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
  },
  lockedOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    zIndex: 2,
  },
  lockedText: {
    fontSize: 10,
    fontWeight: '700',
    color: GOLD_LIGHT,
  },
});
