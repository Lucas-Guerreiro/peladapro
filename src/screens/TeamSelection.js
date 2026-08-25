import React, { useState, useEffect } from 'react';
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
import { gerarSorteioComMemoria } from '../utils/sorteioComMemoria';
import { supabase } from '../lib/supabase';

const DEFAULT_GRUPO_ID = 1;

// 24 Atletas (4 Goleiros + 20 Jogadores de Linha)
const jogadores = [
  { id: 1, nome: 'Lucas', posicao: 'Goleiro', habilidade: 4 },
  { id: 2, nome: 'Carlos', posicao: 'Goleiro', habilidade: 5 },
  { id: 3, nome: 'Vitor', posicao: 'Goleiro', habilidade: 5 },
  { id: 4, nome: 'Chico', posicao: 'Goleiro', habilidade: 4 },
  { id: 5, nome: 'Pedro', posicao: 'Zagueiro', habilidade: 3 },
  { id: 6, nome: 'Mateus', posicao: 'Lateral', habilidade: 5 },
  { id: 7, nome: 'João', posicao: 'Meia', habilidade: 4 },
  { id: 8, nome: 'Rafael', posicao: 'Atacante', habilidade: 5 },
  { id: 9, nome: 'Bruno', posicao: 'Meia', habilidade: 3 },
  { id: 10, nome: 'Gabriel', posicao: 'Zagueiro', habilidade: 2 },
  { id: 11, nome: 'Diego', posicao: 'Atacante', habilidade: 4 },
  { id: 12, nome: 'Felipe', posicao: 'Lateral', habilidade: 3 },
  { id: 13, nome: 'Ronald', posicao: 'Atacante', habilidade: 5 },
  { id: 14, nome: 'Daniel', posicao: 'Meia', habilidade: 4 },
  { id: 15, nome: 'Ruziel', posicao: 'Atacante', habilidade: 5 },
  { id: 16, nome: 'Guedes', posicao: 'Meia', habilidade: 4 },
  { id: 17, nome: 'Jarne', posicao: 'Lateral', habilidade: 4 },
  { id: 18, nome: 'Saulo', posicao: 'Zagueiro', habilidade: 4 },
  { id: 19, nome: 'Rodrigo', posicao: 'Meia', habilidade: 4 },
  { id: 20, nome: 'Samuel', posicao: 'Atacante', habilidade: 5 },
  { id: 21, nome: 'Fernando', posicao: 'Meia', habilidade: 5 },
  { id: 22, nome: 'Marcleive', posicao: 'Atacante', habilidade: 5 },
  { id: 23, nome: 'Fabrício', posicao: 'Zagueiro', habilidade: 5 },
  { id: 24, nome: 'Weslley', posicao: 'Lateral', habilidade: 4 },
];

const TEAM_CONFIGS = [
  { nome: 'Time A', letra: 'A', cor: '#F5A623' }, // Amarelo
  { nome: 'Time B', letra: 'B', cor: '#378ADD' }, // Azul
  { nome: 'Time C', letra: 'C', cor: '#1D9E75' }, // Verde
  { nome: 'Time D', letra: 'D', cor: '#8E44AD' }, // Roxo
];

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
  const total = time.reduce((soma, j) => soma + (j.habilidade || j.nivel || 3), 0);
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

function TeamCard({ cor, letra, nome, jogadores: time = [] }) {
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
          <Text style={styles.playerStars}>{renderStars(jogador.habilidade || jogador.nivel)}</Text>
        </View>
      ))}
      <View style={[styles.teamFooter, { borderTopColor: cor }]}>
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
  const [historico, setHistorico] = useState([]);
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const showToast = useToast();

  useEffect(() => {
    async function carregarHistoricoEGerar() {
      setLoading(true);
      let hist = [];
      try {
        const { data, error } = await supabase
          .from('sorteios')
          .select('times')
          .eq('grupo_id', DEFAULT_GRUPO_ID)
          .order('criado_em', { ascending: false })
          .limit(4);

        if (error) {
          console.warn('Aviso Supabase ao carregar historico:', error.message);
          showToast('Aviso: Histórico de sorteios não carregado.');
        } else if (data && data.length > 0) {
          // Inverte a ordem para alimentar do mais antigo para o mais recente (cronológico)
          hist = [...data].reverse();
          setHistorico(hist);
        }
      } catch (err) {
        console.warn('Erro de rede ao conectar no Supabase:', err);
        showToast('Aviso: Erro de conexão. Histórico não carregado.');
      } finally {
        setLoading(false);
      }

      const sorteioInicial = gerarSorteioComMemoria(jogadores, 6, hist);
      setTimes(sorteioInicial);

      if (sorteioInicial.duplasNaoSeparadas && sorteioInicial.duplasNaoSeparadas.length > 0) {
        showToast(`Aviso: ${sorteioInicial.duplasNaoSeparadas.length} duplas mantidas por limite matemático.`);
      }
    }

    carregarHistoricoEGerar();
  }, []);

  const handleSortear = () => {
    if (loading) return;
    const novosTimes = gerarSorteioComMemoria(jogadores, 6, historico);
    setTimes(novosTimes);

    if (novosTimes.duplasNaoSeparadas && novosTimes.duplasNaoSeparadas.length > 0) {
      showToast(`Aviso: ${novosTimes.duplasNaoSeparadas.length} duplas mantidas por limite matemático.`);
    } else {
      showToast('Times re-sorteados com sucesso!');
    }
  };

  const handleConfirmar = async () => {
    if (loading || !times || times.length === 0) return;

    const timesIds = times.map(t => t.map(j => j.id));

    try {
      const { error } = await supabase.from('sorteios').insert({
        grupo_id: DEFAULT_GRUPO_ID,
        times: timesIds,
        criado_em: new Date().toISOString(),
      });

      if (error) {
        console.error('Erro Supabase ao salvar sorteio:', error);
        showToast('Erro ao salvar no banco. Times confirmados localmente.');
      } else {
        showToast('Times confirmados e salvos com sucesso!');
        setHistorico(prev => [...prev, { times: timesIds }].slice(-4));
      }
    } catch (err) {
      console.error('Erro de rede ao confirmar times:', err);
      showToast('Falha na conexao ao salvar os times.');
    }
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
          <Text style={styles.configTitle}>
            {jogadores.length} jogadores disponiveis (4 times de 6) {loading ? ' - Carregando historico...' : ''}
          </Text>
          <Toggle
            label="Equilibrar por habilidade"
            value={equilibrarHabilidade}
            onValueChange={(value) => setEquilibrarHabilidade(value)}
          />
        </Card>

        <View style={styles.teamsRow}>
          {times.map((time, idx) => {
            const config = TEAM_CONFIGS[idx] || {
              nome: `Time ${String.fromCharCode(65 + idx)}`,
              letra: String.fromCharCode(65 + idx),
              cor: '#378ADD',
            };
            return (
              <View key={idx} style={styles.teamCol}>
                <TeamCard
                  cor={config.cor}
                  letra={config.letra}
                  nome={config.nome}
                  jogadores={time}
                />
              </View>
            );
          })}
        </View>

        <Card style={styles.rodizioCard}>
          <Text style={styles.rodizioTitle}>Proximo Jogo</Text>
          <View style={styles.rodizioDots}>
            {times.map((time, idx) => {
              const config = TEAM_CONFIGS[idx] || { nome: `Time ${idx + 1}`, cor: '#378ADD' };
              return (
                <React.Fragment key={idx}>
                  <View style={[styles.dot, { backgroundColor: config.cor, marginLeft: idx > 0 ? 12 : 0 }]} />
                  <Text style={styles.rodizioText}>{config.nome}: {time.length}</Text>
                </React.Fragment>
              );
            })}
          </View>
        </Card>

        <View style={styles.buttonsRow}>
          <Button
            title={loading ? "Carregando..." : "Re-sortear"}
            variant="secondary"
            onPress={handleSortear}
            disabled={loading}
            style={styles.button}
          />
          <Button
            title={loading ? "Carregando..." : "Confirmar Times"}
            variant="primary"
            onPress={handleConfirmar}
            disabled={loading}
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
    backgroundColor: Tokens.colors.background || Tokens.colors.neutralBg || '#F5F7FA',
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
    color: Tokens.colors.primary || '#1D9E75',
    letterSpacing: 0.5,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
  },
  configCard: {
    marginVertical: 12,
    padding: 16,
  },
  configTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
    marginBottom: 12,
  },
  teamsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginVertical: 12,
  },
  teamCol: {
    width: '48%',
    marginBottom: 8,
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
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
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
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
  },
  playerPosicao: {
    fontSize: 10,
    color: Tokens.colors.muted || Tokens.colors.neutralMuted || '#888',
  },
  playerStars: {
    fontSize: 12,
    color: '#F5A623',
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
    color: Tokens.colors.muted || Tokens.colors.neutralMuted || '#888',
  },
  footerValue: {
    fontSize: 13,
    fontWeight: '700',
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
  },
  rodizioCard: {
    padding: 16,
    marginVertical: 12,
  },
  rodizioTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
    marginBottom: 12,
  },
  rodizioDots: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    color: Tokens.colors.text || Tokens.colors.neutralDark || '#1A1A1A',
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