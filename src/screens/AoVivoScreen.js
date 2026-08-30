import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import Card from '../components/Card';
import Avatar from '../components/Avatar';
import PartidaAoVivoCard from '../components/PartidaAoVivoCard';

const AoVivoScreen = () => {
  const [scoreA, setScoreA] = useState(2);
  const [scoreB, setScoreB] = useState(1);
  const [timer, setTimer] = useState(1445);
  const [period, setPeriod] = useState(1);
  const [isRunning, setIsRunning] = useState(true);
  const [events, setEvents] = useState([
    { id: '1', type: 'goal', team: 'A', playerName: 'Pedro Santos', description: 'Gol - Time A', minute: "12'" },
    { id: '2', type: 'assist', team: 'A', playerName: 'Lucas Lima', description: 'Assistência - Time A', minute: "12'" },
    { id: '3', type: 'goal', team: 'B', playerName: 'Marcos Silva', description: 'Gol - Time B', minute: "18'" },
  ]);
  const [rodizioQueue, setRodizioQueue] = useState(['Rafael', 'Diego', 'Bruno', 'Carlos']);
  const [nextSubTime, setNextSubTime] = useState(365);

  const intervalRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        setTimer((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const getEventColor = (type) => {
    switch (type) {
      case 'goal':
        return '#22C55E';
      case 'assist':
        return '#378ADD';
      case 'card':
        return '#F5A623';
      default:
        return '#7F8C8D';
    }
  };

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <ScrollView style={styles.container}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.topBarSide} accessibilityRole="button" accessibilityLabel="Voltar">
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.topBarCenter}>
          <Text style={styles.screenTitleText}>ACOMPANHAMENTO</Text>
        </View>
        <TouchableOpacity style={styles.topBarSide} accessibilityRole="button" accessibilityLabel={isRunning ? "Pausar" : "Iniciar"} onPress={() => setIsRunning(!isRunning)}>
          <Text style={styles.pauseIcon}>{isRunning ? '⏸️' : '▶️'}</Text>
        </TouchableOpacity>
      </View>

      {/* CARD DE PARTIDA AO VIVO REDESENHADO */}
      <PartidaAoVivoCard
        teamAName="Time A"
        teamBName="Time B"
        scoreA={scoreA}
        scoreB={scoreB}
        timerStr={formatTime(timer)}
        periodStr={period === 1 ? '1º Tempo' : '2º Tempo'}
        proximaReveza={true}
        revezaText="PRÓXIMA REVEZA"
        onPause={() => setIsRunning(!isRunning)}
        style={{ marginHorizontal: 16, marginTop: 8 }}
      />

      {/* QUICK ACTIONS */}
      <View style={styles.quickActionsRow}>
        <TouchableOpacity style={[styles.actionButton, styles.actionGoal]}>
          <Text style={styles.actionIcon}>⚽</Text>
          <Text style={styles.actionLabel}>Gol</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionAssist]}>
          <Text style={styles.actionIcon}>👟</Text>
          <Text style={styles.actionLabel}>Assist.</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionCard]}>
          <Text style={styles.actionIcon}>🟨</Text>
          <Text style={[styles.actionLabel, styles.actionLabelDark]}>Cartão</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionButton, styles.actionSub]}>
          <Text style={styles.actionIcon}>🔄</Text>
          <Text style={styles.actionLabel}>Subst.</Text>
        </TouchableOpacity>
      </View>

      {/* TIMELINE CARD */}
      <Card style={styles.timelineCard}>
        <Text style={styles.cardTitle}>📋 Eventos</Text>
        {events.map((event, index) => (
          <View
            key={event.id}
            style={[
              styles.eventRow,
              index === events.length - 1 && styles.eventRowLast,
            ]}
          >
            <View style={[styles.eventDot, { backgroundColor: getEventColor(event.type) }]} />
            <View style={styles.eventCenter}>
              <Text style={styles.eventPlayer}>{event.playerName}</Text>
              <Text style={styles.eventDescription}>{event.description}</Text>
            </View>
            <Text style={styles.eventMinute}>{event.minute}</Text>
          </View>
        ))}
      </Card>

      {/* RODÍZIO CARD */}
      <Card style={styles.rodizioCard}>
        <Text style={styles.cardTitle}>🔄 Fila de Rodízio</Text>
        <Text style={styles.rodizioLabel}>Próxima troca em</Text>
        <Text style={styles.rodizioTime}>{formatTime(nextSubTime)}</Text>
        <View style={styles.rodizioRow}>
          {rodizioQueue.map((name) => (
            <View key={name} style={styles.rodizioPlayer}>
              <View style={styles.rodizioAvatar}>
                <Text style={styles.rodizioInitials}>{getInitials(name)}</Text>
              </View>
              <Text style={styles.rodizioName}>{name}</Text>
            </View>
          ))}
        </View>
      </Card>

      {/* BOTTOM BUTTON */}
      <View style={styles.bottomButtonContainer}>
        <TouchableOpacity style={styles.finishButton}>
          <Text style={styles.finishButtonText}>🏁 Finalizar Partida</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A1F2E',
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A1F2E',
    flexDirection: 'row',
    alignItems: 'center',
  },
  topBarSide: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E74C3C',
    marginRight: 8,
  },
  liveText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
  pauseIcon: {
    fontSize: 20,
  },
  scoreboardCard: {
    backgroundColor: '#242B3D',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  scoresRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamColumn: {
    flex: 1,
    alignItems: 'center',
  },
  teamCircleA: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5A623',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamCircleB: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#378ADD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamCircleText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  teamNameA: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F5A623',
    marginTop: 4,
  },
  teamNameB: {
    fontSize: 14,
    fontWeight: '600',
    color: '#378ADD',
    marginTop: 4,
  },
  scoreText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 4,
  },
  versusText: {
    fontSize: 24,
    color: '#7F8C8D',
    marginHorizontal: 16,
  },
  timerSection: {
    alignItems: 'center',
    marginTop: 16,
  },
  timerText: {
    fontSize: 54,
    fontWeight: '900',
    fontFamily: 'monospace',
    color: '#1D9E75',
    letterSpacing: 2,
  },
  timerBar: {
    height: 8,
    backgroundColor: '#3D4659',
    borderRadius: 4,
    width: '85%',
    marginTop: 10,
  },
  timerBarFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: 4,
    backgroundColor: '#1D9E75',
    borderRadius: 2,
    width: '45%',
  },
  periodText: {
    fontSize: 12,
    color: '#7F8C8D',
    marginTop: 4,
  },
  quickActionsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    height: 72,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionGoal: {
    backgroundColor: '#1D9E75',
  },
  actionAssist: {
    backgroundColor: '#378ADD',
  },
  actionCard: {
    backgroundColor: '#F5A623',
  },
  actionSub: {
    backgroundColor: '#3D4659',
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 4,
  },
  actionLabelDark: {
    color: '#2C3E50',
  },
  timelineCard: {
    backgroundColor: '#242B3D',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#3D4659',
  },
  eventRowLast: {
    borderBottomWidth: 0,
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
  },
  eventCenter: {
    flex: 1,
  },
  eventPlayer: {
    fontSize: 13,
    color: '#FFFFFF',
  },
  eventDescription: {
    fontSize: 11,
    color: '#7F8C8D',
  },
  eventMinute: {
    fontSize: 12,
    color: '#7F8C8D',
  },
  rodizioCard: {
    backgroundColor: '#242B3D',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 16,
    marginBottom: 24,
  },
  rodizioLabel: {
    fontSize: 11,
    color: '#7F8C8D',
    marginTop: 8,
  },
  rodizioTime: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#F5A623',
  },
  rodizioRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 12,
  },
  rodizioPlayer: {
    alignItems: 'center',
  },
  rodizioAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3D4659',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rodizioInitials: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  rodizioName: {
    fontSize: 10,
    color: '#FFFFFF',
    marginTop: 4,
  },
  bottomButtonContainer: {
    marginHorizontal: 16,
    marginBottom: 32,
  },
  finishButton: {
    backgroundColor: '#E74C3C',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  finishButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default AoVivoScreen;