import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {
  Button,
  Card,
  SegmentedControl,
  Toggle,
  Avatar,
  useToast,
  BottomNav,
} from '../components';
import Tokens from '../theme/tokens';

const jogadores = [
  { id: 1, nome: 'Lucas', posicao: 'Goleiro', habilidade: 4 },
  { id: 2, nome: 'Pedro', posicao: 'Zagueiro', habilidade: 3 },
  { id: 3, nome: 'Mateus', posicao: 'Lateral', habilidade: 5 },
  { id: 4, nome: 'João', posicao: 'Meia', habilidade: 4 },
  { id: 5, nome: 'Rafael', posicao: 'Atacante', habilidade: 5 },
  { id: 6, nome: 'Bruno', posicao: 'Meia', habilidade: 3 },
  { id: 7, nome: 'Gabriel', posicao: 'Zagueiro', habilidade: 2 },
  { id: 8, nome: 'Diego', posicao: 'Atacante', habilidade: 4 },
  { id: 9, nome: 'Felipe', posicao: 'Lateral', habilidade: 3 },
  { id: 10, nome: 'Carlos', posicao: 'Goleiro', habilidade: 2 },
];

const timeA = jogadores.filter((_, index) => index % 2 === 0);
const timeB = jogadores.filter((_, index) => index % 2 !== 0);

const COLOR_AMARELO = '#F5A623';
const COLOR_AZUL = '#378ADD';

const modoSegments = [
  { key: 'automatico', label: 'Automatico' },
  { key: 'aleatorio', label: 'Aleatorio' },
  { key: 'manual', label: 'Manual' },
];

const navTabs = [
  { key: 'inicio', label: 'Inicio' },
  { key: 'pelada', label: 'Pelada' },
  { key: 'jogadores', label: 'Jogadores' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'mais', label: 'Mais' },
];

function renderStars(habilidade) {
  const max = 5;
  let stars = '';
  for (let i = 0; i < max; i++) {
    stars += i < habilidade ? '★' : '☆';
  }
  return stars;
}

function mediaHabilidade(time) {
  if (!time || time.length === 0) return 0;
  const total = time.reduce((soma, j) => soma + j.habilidade, 0);
  return (total / time.length).toFixed(1);
}

function TeamHeader({ cor, letra, nome }) {
  return (
    <View style={styles.teamHeader}>
      <View style={[styles.teamCircle, { backgroundColor: cor }]}>
        <Text style={styles.teamCircleText}>{letra}</Text>
      </View>
      <Text style={styles.teamName}>{nome}</Text>
    </View>
  );
}

function TeamCard({ cor, letra, nome, jogadores: time }) {
  return (
    <Card style={[styles.teamCard, { borderTopColor: cor, borderTopWidth: 3 }]}>
      <TeamHeader cor={cor} letra={letra} nome={nome} />
      {time.map((jogador, index) => (
        <View key={jogador.id} style={styles.playerRow}>
          <Avatar uri={index % 2 === 0 ? jogador.nome : null} size={32} />
          <View style={styles.playerInfo}>
            <Text style={styles.playerName}>{jogador.nome}</Text>
            <Text style={styles.playerPosicao}>{jogador.posicao}</Text>
          </View>
          <Text style={styles.playerStars}>{renderStars(jogador.habilidade)}</Text>
        </View>
      ))}
      <View style={[styles.teamFooter, { borderTopColor: cor }] }>
        <Text style={styles.footerLabel}>Media</Text>
        <Text style={styles.footerValue}>{mediaHabilidade(time)}</Text>
      </View>
    </Card>
  );
}

function TeamSelection() {
  const [modoSorteio, setModoSorteio] = useState('automatico');
  const [equilibrarHabilidade, setEquilibrarHabilidade] = useState(true);
  const [activeTab, setActiveTab] = useState('pelada');
  const showToast = useToast();

  const handleSortear = () => {
    showToast('Times re-sorteados com sucesso!');
  };

  const handleConfirmar = () => {
    showToast('Times confirmados! Boa partida.');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarSide} onPress={() => showToast('Voltar')}>
            <Text style={styles.topBarText}>VOLTAR</Text>
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>Escalar Times</Text>
          <TouchableOpacity style={styles.topBarSide} onPress={() => showToast('Opcoes')}>
            <Text style={styles.topBarText}>OPCOES</Text>
          </TouchableOpacity>
        </View>

        <SegmentedControl
          segments={modoSegments}
          selectedKey={modoSorteio}
          onSelect={(key) => setModoSorteio(key)}
        />

        <Card style={styles.configCard}>
          <Text style={styles.configTitle}>14 jogadores disponiveis</Text>
          <Toggle
            label="Equilibrar por habilidade"
            value={equilibrarHabilidade}
            onValueChange={(value) => setEquilibrarHabilidade(value)}
          />
        </Card>

        <View style={styles.teamsRow}>
          <View style={styles.teamCol}>
            <TeamCard
n              cor={COLOR_AMARELO}
              letra="A"
              nome="Time A"
              jogadores={timeA}
            />
          </View>
          <View style={styles.teamCol}>
            <TeamCard
              cor={COLOR_AZUL}
              letra="B"
              nome="Time B"
              jogadores={timeB}
            />
          </View>
        </View>

        <Card style={styles.rodizioCard}>
          <Text style={styles.rodizioTitle}>Proximo Jogo</Text>
          <View style={styles.rodizioDots}>
            <View style={[styles.dot, { backgroundColor: COLOR_AMARELO }]} />
            <Text style={styles.rodizioText}>Time A: {timeA.length}</Text>
            <View style={[styles.dot, { backgroundColor: COLOR_AZUL, marginLeft: 12 }]} />
            <Text style={styles.rodizioText}>Time B: {timeB.length}</Text>
          </View>
        </Card>

        <View style={styles.buttonsRow}>
          <Button
            title="Re-sortear"
            variant="secondary"
            onPress={handleSortear}
            style={styles.button}
          />
          <Button
            title="Confirmar Times"
            variant="primary"
            onPress={handleConfirmar}
            style={styles.button}
          />
        </View>
      </ScrollView>

      <BottomNav
        tabs={navTabs}
        activeTab={activeTab}
        onTabPress={(key) => setActiveTab(key)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Tokens.colors.background || '#F5F7FA',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 96,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 12,
  },
  topBarSide: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  topBarText: {
    fontSize: 12,
    fontWeight: '700',
    color: Tokens.colors.primary || '#378ADD',
    letterSpacing: 0.5,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Tokens.colors.text || '#1A1A1A',
  },
  configCard: {
    marginVertical: 12,
    padding: 16,
  },
  configTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Tokens.colors.text || '#1A1A1A',
    marginBottom: 12,
  },
  teamsRow: {
    flexDirection: 'row',
    gap: 8,
    marginVertical: 12,
  },
  teamCol: {
    flex: 1,
  },
  teamCard: {
    padding: 12,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  teamCircleText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  teamName: {
    fontSize: 14,
    fontWeight: '700',
    color: Tokens.colors.text || '#1A1A1A',
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
  },
  playerInfo: {
    flex: 1,
    marginLeft: 8,
  },
  playerName: {
    fontSize: 12,
    fontWeight: '600',
    color: Tokens.colors.text || '#1A1A1A',
  },
  playerPosicao: {
    fontSize: 10,
    color: Tokens.colors.muted || '#888',
  },
  playerStars: {
    fontSize: 12,
    color: COLOR_AMARELO,
  },
  teamFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  footerLabel: {
    fontSize: 11,
    color: Tokens.colors.muted || '#888',
  },
  footerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Tokens.colors.text || '#1A1A1A',
  },
  rodizioCard: {
    padding: 16,
    marginVertical: 12,
  },
  rodizioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Tokens.colors.text || '#1A1A1A',
    marginBottom: 12,
  },
  rodizioDots: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  rodizioText: {
    fontSize: 12,
    fontWeight: '600',
    color: Tokens.colors.text || '#1A1A1A',
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    flex: 1,
  },
});

export default TeamSelection;