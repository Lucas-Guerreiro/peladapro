import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Dashboard from './Dashboard';
import PeladaScreen from './PeladaScreen';
import JogadoresScreen from './JogadoresScreen';
import RankingScreen from './RankingScreen';
import MaisScreen from './MaisScreen';
import EscalarTimesScreen from './EscalarTimesScreen';
import FinanceiroScreen from './FinanceiroScreen';
import NovaPeladaScreen from './NovaPeladaScreen';
import PerfilScreen from './PerfilScreen';
import AoVivoScreen from './AoVivoScreen';
import PosJogoScreen from './PosJogoScreen';
import OnboardingScreen from './OnboardingScreen';
import QuadrasScreen from './QuadrasScreen';
import BottomNav from '../components/BottomNav';

const tabs = [
  { key: 'inicio', label: 'Início', icon: '🏠' },
  { key: 'pelada', label: 'Pelada', icon: '⚽' },
  { key: 'jogadores', label: 'Jogadores', icon: '👥' },
  { key: 'ranking', label: 'Ranking', icon: '🏆' },
  { key: 'mais', label: 'Mais', icon: '⚙️' }
];

const HomeScreen = () => {
  const [onboardingComplete, setOnboardingComplete] = useState(false);
  const [activeTab, setActiveTab] = useState('inicio');
  const [detailScreen, setDetailScreen] = useState(null);
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const onNavigate = (key, data) => {
    setDetailScreen(key);
    if (data) setSelectedPlayer(data);
  };

  const goBack = () => {
    setDetailScreen(null);
    setSelectedPlayer(null);
  };

  const renderHeader = (title) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 }}>
      <TouchableOpacity onPress={goBack}>
        <Text style={{ fontSize: 16, fontWeight: '500', color: '#378ADD' }}>← Voltar</Text>
      </TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: '600', color: '#2C3E50', textAlign: 'center' }}>{title}</Text>
      </View>
      <View style={{ width: 60 }} />
    </View>
  );

  if (!onboardingComplete) {
    return <OnboardingScreen onComplete={() => setOnboardingComplete(true)} />;
  }

  if (detailScreen) {
    switch (detailScreen) {
      case 'aovivo':
        return (
          <View style={{ flex: 1, backgroundColor: '#1A1F2E' }}>
            <AoVivoScreen />
          </View>
        );
      case 'escalarTimes':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {renderHeader('Escalar Times')}
            <EscalarTimesScreen />
          </View>
        );
      case 'financeiro':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {renderHeader('Financeiro')}
            <FinanceiroScreen />
          </View>
        );
      case 'novapelada':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {renderHeader('Nova Pelada')}
            <NovaPeladaScreen onNavigate={onNavigate} />
          </View>
        );
      case 'perfil':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {renderHeader('Meu Perfil')}
            <PerfilScreen player={selectedPlayer} />
          </View>
        );
      case 'posjogo':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {renderHeader('Pós-Jogo')}
            <PosJogoScreen />
          </View>
        );
      case 'quadras':
        return (
          <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            {renderHeader('Quadras')}
            <QuadrasScreen onNavigate={onNavigate} goBack={goBack} />
          </View>
        );
      default:
        return null;
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 }}>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#1D9E75' }}>Pelada Pro</Text>
      </View>
      <View style={{ flex: 1 }}>
        {activeTab === 'inicio' && <Dashboard onNavigate={onNavigate} />}
        {activeTab === 'pelada' && <PeladaScreen onNavigate={onNavigate} />}
        {activeTab === 'jogadores' && <JogadoresScreen onNavigate={onNavigate} />}
        {activeTab === 'ranking' && <RankingScreen onNavigate={onNavigate} />}
        {activeTab === 'mais' && <MaisScreen />}
      </View>
      <BottomNav tabs={tabs} activeTab={activeTab} onTabPress={setActiveTab} />
    </View>
  );
};

export default HomeScreen;