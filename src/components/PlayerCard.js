import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  ClipPath,
  G,
} from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { darken, getContrastColor } from '../utils/colors';

// Constantes de cores metálicas premium e fallbacks
const GOLD_PRIMARY = '#D4AF37';
const GOLD_LIGHT = '#F5D270';
const DEFAULT_PRIMARY = '#1D9E75';
const DEFAULT_SECONDARY = '#0A1F16';

// Proporção do Escudo FUT (300 x 420)
const SHIELD_WIDTH = 300;
const SHIELD_HEIGHT = 420;
const SHIELD_PATH =
  'M 20 0 H 280 Q 300 0 300 20 V 270 C 300 345 200 395 150 420 C 100 395 0 345 0 270 V 20 Q 0 0 20 0 Z';

/**
 * Componente PlayerCard - Brasão/Escudo Estilo FIFA Ultimate Team (FUT)
 * Formato 100% SVG com cores dinâmicas do time e gradiente dinâmico
 */
export default function PlayerCard({
  nome = 'PEDRO SANTOS',
  posicao = 'ATA',
  idade = 27,
  jogos = 45,
  gols = 18,
  rating = 92,
  primaryColor = DEFAULT_PRIMARY,
  secondaryColor = DEFAULT_SECONDARY,
  nacionalidade = { code: 'BRA', flagEmoji: '🇧🇷' },
  timeNome = 'PELADA PRO',
  timeFlagUrl,
  adquirido = false,
  foto,
}) {
  // Animação de brilho pulsante na borda metálica para VIPs
  const glowAnim = useRef(new Animated.Value(0.5)).current;

  // Trata cores dinâmicas nulas com o fallback verde Pelada Pro
  const safePrimary = primaryColor && primaryColor.trim() !== '' ? primaryColor : DEFAULT_PRIMARY;
  const safeSecondary = secondaryColor && secondaryColor.trim() !== '' ? secondaryColor : DEFAULT_SECONDARY;

  // Aplica escurecimento de ~20% na cor secundária em runtime
  const darkSecondary = darken(safeSecondary, 20);

  // Animação contínua de iluminação metálica para cards adquiridos
  useEffect(() => {
    if (adquirido) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(glowAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
          Animated.timing(glowAnim, { toValue: 0.5, duration: 1800, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [adquirido]);

  // Formata a posição para 3 letras maiúsculas
  const posAbbr = (posicao || 'ATA').substring(0, 3).toUpperCase();
  const nacCode = typeof nacionalidade === 'object' ? (nacionalidade.code || 'BRA') : 'BRA';
  const nacEmoji = typeof nacionalidade === 'object' ? (nacionalidade.flagEmoji || '🇧🇷') : '🇧🇷';

  return (
    <View
      style={styles.outerContainer}
      accessibilityLabel={`Card de atleta em formato de escudo de ${nome}`}
      accessibilityRole="summary"
    >
      <Animated.View style={[styles.shieldWrapper, adquirido && { opacity: glowAnim }]}>
        {/* Renderização SVG do Escudo de Fundo + Moldura Metálica */}
        <Svg
          width={SHIELD_WIDTH}
          height={SHIELD_HEIGHT}
          viewBox="0 0 300 420"
          style={StyleSheet.absoluteFill}
        >
          <Defs>
            {/* Gradiente dinâmico com as cores do time */}
            <SvgGradient id="teamGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={darkSecondary} stopOpacity={1} />
              <Stop offset="50%" stopColor={safePrimary} stopOpacity={1} />
              <Stop offset="100%" stopColor={darkSecondary} stopOpacity={1} />
            </SvgGradient>

            {/* Gradiente metálico dourado da borda */}
            <SvgGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FFF2B2" stopOpacity={1} />
              <Stop offset="30%" stopColor="#F5D270" stopOpacity={1} />
              <Stop offset="70%" stopColor={GOLD_PRIMARY} stopOpacity={1} />
              <Stop offset="100%" stopColor="#8A6D1C" stopOpacity={1} />
            </SvgGradient>

            {/* ClipPath para recortar o conteúdo dentro do brasão */}
            <ClipPath id="shieldClip">
              <Path d={SHIELD_PATH} />
            </ClipPath>
          </Defs>

          {/* Preenchimento do brasão com o gradiente do time */}
          <Path d={SHIELD_PATH} fill="url(#teamGradient)" />

          {/* Borda metálica dourada acompanhando o contorno exato do escudo */}
          <Path
            d={SHIELD_PATH}
            fill="none"
            stroke="url(#goldGradient)"
            strokeWidth={7}
          />
          <Path
            d={SHIELD_PATH}
            fill="none"
            stroke="#FFFBEB"
            strokeWidth={1.5}
            opacity={0.7}
          />
        </Svg>

        {/* Conteúdo Interno Posicionado dentro do Escudo */}
        <View style={styles.cardContentContainer}>
          {/* Topo: VIP Badge, Rating, Posição e Bandeiras */}
          <View style={styles.topRow}>
            {/* Canto Esquerdo: Badge VIP + Rating + Posição */}
            <View style={styles.leftInfoStack}>
              {/* Badge VIP */}
              <View style={styles.vipBadge}>
                <Ionicons name="crown" size={10} color={GOLD_LIGHT} />
                <Text style={styles.vipBadgeText}>VIP</Text>
              </View>

              {/* Rating Geral */}
              <Text style={styles.ratingNumber}>{rating}</Text>
              <Text style={styles.posicaoAbbr}>{posAbbr}</Text>
            </View>

            {/* Canto Direito: Bandeira Nacional + Bandeira do Time */}
            <View style={styles.rightFlagsStack}>
              {/* Nacionalidade */}
              <View style={styles.flagBadge}>
                <Text style={styles.flagEmoji}>{nacEmoji}</Text>
                <Text style={styles.flagText}>{nacCode}</Text>
              </View>

              {/* Time */}
              <View style={styles.flagBadge}>
                {timeFlagUrl ? (
                  <Image source={{ uri: timeFlagUrl }} style={styles.timeFlagImg} />
                ) : (
                  <Ionicons name="shield-checkmark" size={12} color={GOLD_LIGHT} />
                )}
                <Text style={styles.flagText} numberOfLines={1}>
                  {timeNome ? timeNome.substring(0, 3).toUpperCase() : 'PEL'}
                </Text>
              </View>
            </View>
          </View>

          {/* Seção Central: Bola de Futebol Dourada + Foto do Atleta */}
          <View style={styles.centerSection}>
            {/* Graphic da Bola Dourada com Glow */}
            <View style={styles.goldenBallContainer}>
              <Ionicons name="football" size={76} color={GOLD_LIGHT} style={styles.goldenBallIcon} />
            </View>

            {/* Moldura circular com foto do atleta */}
            <View style={styles.photoRing}>
              {foto ? (
                <Image source={{ uri: foto }} style={styles.athleteImg} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Text style={styles.initialText}>{nome.charAt(0).toUpperCase()}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Placa do Nome: Nome do Atleta em Caixa Alta Dourada */}
          <View style={styles.nameSection}>
            <View style={styles.nameLineDivider} />
            <Text style={styles.athleteNameText} numberOfLines={1}>
              {nome.toUpperCase()}
            </Text>
            <View style={styles.nameLineDivider} />
          </View>

          {/* Seção de Dados: IDADE | JOGOS | GOLS */}
          <View style={styles.statsRow}>
            {/* IDADE */}
            <View style={styles.statBox}>
              <Ionicons name="calendar-outline" size={18} color={GOLD_LIGHT} />
              <Text style={styles.statLabelText}>IDADE</Text>
              <Text style={styles.statNumText}>{idade}</Text>
            </View>

            <View style={styles.statVerticalLine} />

            {/* JOGOS */}
            <View style={styles.statBox}>
              <Ionicons name="shirt-outline" size={18} color={GOLD_LIGHT} />
              <Text style={styles.statLabelText}>JOGOS</Text>
              <Text style={styles.statNumText}>{jogos}</Text>
            </View>

            <View style={styles.statVerticalLine} />

            {/* GOLS */}
            <View style={styles.statBox}>
              <Ionicons name="football-outline" size={18} color={GOLD_LIGHT} />
              <Text style={styles.statLabelText}>GOLS</Text>
              <Text style={styles.statNumText}>{gols}</Text>
            </View>
          </View>

          {/* Rodapé do Escudo: Marca Pelada Pro + Estrela no V-Bottom */}
          <View style={styles.footerSection}>
            <View style={styles.footerDivider} />
            <Text style={styles.footerBrandText}>PELADA PRO</Text>
            <Ionicons name="star" size={12} color={GOLD_LIGHT} style={styles.footerStarIcon} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

// ── ESTILIZAÇÃO DO COMPONENTE DO BRASÃO ─────────────────────────────────────
const styles = StyleSheet.create({
  outerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  shieldWrapper: {
    width: SHIELD_WIDTH,
    height: SHIELD_HEIGHT,
    shadowColor: GOLD_PRIMARY,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.7,
    shadowRadius: 18,
    elevation: 12,
    position: 'relative',
  },
  cardContentContainer: {
    width: SHIELD_WIDTH,
    height: SHIELD_HEIGHT,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    justifyContent: 'space-between',
    zIndex: 5,
  },

  // Topo do Card
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  leftInfoStack: {
    alignItems: 'center',
  },
  vipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderWidth: 1,
    borderColor: GOLD_PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  vipBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: GOLD_LIGHT,
    letterSpacing: 1,
  },
  ratingNumber: {
    fontSize: 34,
    fontWeight: '900',
    color: GOLD_LIGHT,
    lineHeight: 36,
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  posicaoAbbr: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.8,
  },

  // Bandeiras do Canto Direito
  rightFlagsStack: {
    alignItems: 'flex-end',
    gap: 6,
  },
  flagBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.4)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  flagEmoji: {
    fontSize: 12,
  },
  flagText: {
    fontSize: 10,
    fontWeight: '800',
    color: GOLD_LIGHT,
    letterSpacing: 0.5,
  },
  timeFlagImg: {
    width: 13,
    height: 13,
    borderRadius: 6.5,
  },

  // Centro: Bola Dourada + Foto
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: -10,
    position: 'relative',
  },
  goldenBallContainer: {
    position: 'absolute',
    top: -24,
    zIndex: 1,
  },
  goldenBallIcon: {
    textShadowColor: 'rgba(245, 210, 112, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  photoRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3.5,
    borderColor: GOLD_PRIMARY,
    shadowColor: GOLD_PRIMARY,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'hidden',
    backgroundColor: '#0F172A',
    zIndex: 2,
    marginTop: 18,
  },
  athleteImg: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  initialText: {
    fontSize: 40,
    fontWeight: '900',
    color: GOLD_LIGHT,
  },

  // Nome do Atleta
  nameSection: {
    alignItems: 'center',
    marginVertical: 4,
  },
  nameLineDivider: {
    width: '85%',
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.4)',
    marginVertical: 2,
  },
  athleteNameText: {
    fontSize: 20,
    fontWeight: '900',
    color: GOLD_LIGHT,
    letterSpacing: 1.5,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.9)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },

  // Estatísticas (IDADE, JOGOS, GOLS)
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statLabelText: {
    fontSize: 9,
    fontWeight: '800',
    color: GOLD_LIGHT,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  statNumText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  statVerticalLine: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
  },

  // Rodapé do Brasão (PELADA PRO + Estrela na Ponta)
  footerSection: {
    alignItems: 'center',
    marginBottom: -4,
  },
  footerDivider: {
    width: '40%',
    height: 1,
    backgroundColor: 'rgba(212, 175, 55, 0.4)',
    marginBottom: 3,
  },
  footerBrandText: {
    fontSize: 10,
    fontWeight: '900',
    color: GOLD_LIGHT,
    letterSpacing: 2,
  },
  footerStarIcon: {
    marginTop: 2,
  },
});
