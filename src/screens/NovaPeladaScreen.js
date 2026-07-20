import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal } from 'react-native';
import Card from '../components/Card';
import Toggle from '../components/Toggle';
import Button from '../components/Button';

const monthNames = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const getDaysInMonth = (month, year) => {
  return new Date(year, month, 0).getDate();
};

const getFirstDayOfMonth = (month, year) => {
  return new Date(year, month, 1).getDay();
};

const generateCalendarDays = (month, year) => {
  const days = [];
  const firstDay = getFirstDayOfMonth(month, year);
  const daysInMonth = getDaysInMonth(month + 1, year);
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }
  return days;
};

const formatDate = (day, month, year) => {
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${dd}/${mm}/${year}`;
};

const NovaPeladaScreen = ({ onNavigate }) => {
  const [selectedDate, setSelectedDate] = useState('10/07/2026');
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(7);
  const [calendarYear, setCalendarYear] = useState(2026);
  const [selectedDay, setSelectedDay] = useState(10);

  const [selectedTime, setSelectedTime] = useState('19:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timeHours, setTimeHours] = useState(19);
  const [timeMinutes, setTimeMinutes] = useState(0);

  const [location, setLocation] = useState('');
  const [value, setValue] = useState('');
  const [playersPerTeam, setPlayersPerTeam] = useState(5);
  const [duration, setDuration] = useState(60);
  const [selectedDurationChip, setSelectedDurationChip] = useState(null);

  const [recorrente, setRecorrente] = useState(false);
  const [inviteLink] = useState('https://peladapro.app/convite/PEL4521');
  const [inviteCode] = useState('PEL4521');
  const [invitedPlayers, setInvitedPlayers] = useState(['Pedro Santos', 'Lucas Lima', 'Diego Souza']);

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();
  const todayYear = today.getFullYear();

  const prevMonth = () => {
    if (calendarMonth === 0) {
      setCalendarMonth(11);
      setCalendarYear(calendarYear - 1);
    } else {
      setCalendarMonth(calendarMonth - 1);
    }
  };

  const nextMonth = () => {
    if (calendarMonth === 11) {
      setCalendarMonth(0);
      setCalendarYear(calendarYear + 1);
    } else {
      setCalendarMonth(calendarMonth + 1);
    }
  };

  const handleSelectDay = (day) => {
    if (day) {
      setSelectedDay(day);
    }
  };

  const handleConfirmTime = () => {
    const hh = String(timeHours).padStart(2, '0');
    const mm = String(timeMinutes).padStart(2, '0');
    setSelectedTime(`${hh}:${mm}`);
    setShowTimePicker(false);
  };

  const handleConfirmDate = () => {
    setSelectedDate(formatDate(selectedDay, calendarMonth + 1, calendarYear));
    setShowCalendar(false);
  };

  const decrementPlayers = () => {
    setPlayersPerTeam((prev) => (prev > 3 ? prev - 1 : prev));
  };

  const incrementPlayers = () => {
    setPlayersPerTeam((prev) => (prev < 10 ? prev + 1 : prev));
  };

  const decrementDuration = () => {
    setDuration((prev) => (prev > 1 ? prev - 1 : prev));
  };

  const incrementDuration = () => {
    setDuration((prev) => (prev < 999 ? prev + 1 : prev));
  };

  const handleDurationText = (text) => {
    const numeric = text.replace(/[^0-9]/g, '');
    if (numeric === '') {
      setDuration(0);
      return;
    }
    const parsed = parseInt(numeric, 10);
    if (parsed <= 999) {
      setDuration(parsed);
    }
  };

  const getInitials = (name) => {
    const parts = name.trim().split(' ');
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const removePlayer = (index) => {
    setInvitedPlayers((prev) => prev.filter((_, i) => i !== index));
  };

  const calendarDays = generateCalendarDays(calendarMonth, calendarYear);

  const hours = [];
  for (let h = 6; h <= 23; h++) {
    hours.push(h);
  }
  const minutes = [0, 15, 30, 45];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Nova Pelada</Text>

      {/* Data */}
      <Text style={styles.sectionLabel}>📅 Data</Text>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShowCalendar(true)}>
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardValue}>{selectedDate}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      {/* Horário */}
      <Text style={styles.sectionLabel}>⏰ Horário</Text>
      <TouchableOpacity activeOpacity={0.7} onPress={() => setShowTimePicker(true)}>
        <Card style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardValue}>{selectedTime}</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Card>
      </TouchableOpacity>

      {/* Local + Valor */}
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.sectionLabel}>📍 Local</Text>
          <Card style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Quadra"
              value={location}
              onChangeText={setLocation}
              placeholderTextColor="#999"
            />
          </Card>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.sectionLabel}>💰 Valor</Text>
          <Card style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="R$ 0"
              value={value}
              onChangeText={setValue}
              placeholderTextColor="#999"
              keyboardType="numeric"
            />
          </Card>
        </View>
      </View>

      {/* Jogadores + Duração */}
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.sectionLabel}>👥 Jogadores/time</Text>
          <Card style={styles.card}>
            <View style={styles.stepperRow}>
              <TouchableOpacity onPress={decrementPlayers} style={styles.stepButton}>
                <Text style={styles.stepMinus}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{playersPerTeam}</Text>
              <TouchableOpacity onPress={incrementPlayers} style={styles.stepButton}>
                <Text style={styles.stepPlus}>+</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
        <View style={styles.flex1}>
          <Text style={styles.sectionLabel}>⏱ Duração (min)</Text>
          <Card style={styles.card}>
            <View style={styles.stepperRow}>
              <TouchableOpacity onPress={decrementDuration} style={styles.stepButton}>
                <Text style={styles.stepMinusSmall}>−</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.durationInput}
                value={String(duration)}
                onChangeText={handleDurationText}
                keyboardType="numeric"
                selectTextOnFocus
              />
              <TouchableOpacity onPress={incrementDuration} style={styles.stepButton}>
                <Text style={styles.stepPlusSmall}>+</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>
      </View>

      {/* Repetir semanalmente */}
      <Text style={styles.sectionLabel}>🔁 Repetir semanalmente</Text>
      <Card style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardValue}>Repetir semanalmente</Text>
          <Toggle value={recorrente} onValueChange={setRecorrente} />
        </View>
      </Card>

      {/* Convidar Jogadores */}
      <Text style={styles.sectionLabel}>📨 Convidar Jogadores</Text>
      <Card style={styles.card}>
        <View style={styles.linkBox}>
          <Text style={styles.linkText} numberOfLines={1}>{inviteLink}</Text>
          <TouchableOpacity style={styles.copyButton} onPress={() => {}}>
            <Text style={styles.copyButtonText}>Copiar</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.codeRow}>
          <Text style={styles.codeLabel}>Código:</Text>
          <Text style={styles.codeValue}>{inviteCode}</Text>
        </View>
      </Card>

      {/* Invited players */}
      <Text style={styles.sectionLabel}>Jogadores Convidados</Text>
      {invitedPlayers.map((player, index) => (
        <Card key={index} style={styles.playerCard}>
          <View style={styles.playerRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(player)}</Text>
            </View>
            <Text style={styles.playerName}>{player}</Text>
            <TouchableOpacity onPress={() => removePlayer(index)}>
              <Text style={styles.removeButton}>Remover</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      <View style={styles.buttonContainer}>
        <Button title="Criar Pelada" variant="primary" size="lg" fullWidth onPress={() => onNavigate('pelada')} />
      </View>

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.monthYearText}>
                {monthNames[calendarMonth]} {calendarYear}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.navButton}>
                <Text style={styles.navButtonText}>›</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.weekDaysRow}>
              {weekDays.map((day, index) => (
                <Text key={index} style={styles.weekDayText}>{day}</Text>
              ))}
            </View>

            <View style={styles.calendarGrid}>
              {calendarDays.map((day, index) => {
                const isSelected = day === selectedDay;
                const isToday = day === todayDay && calendarMonth === todayMonth && calendarYear === todayYear;
                return (
                  <TouchableOpacity
                    key={index}
                    style={styles.dayCell}
                    onPress={() => handleSelectDay(day)}
                    disabled={!day}
                  >
                    <View
                      style={[
                        styles.dayInner,
                        isSelected && styles.daySelected,
                        !isSelected && isToday && styles.dayToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isSelected && styles.dayTextSelected,
                          !isSelected && isToday && styles.dayTextToday,
                          !day && styles.dayTextEmpty,
                        ]}
                      >
                        {day ? day : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmDate}>
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Time Picker Modal */}
      <Modal visible={showTimePicker} transparent animationType="fade" onRequestClose={() => setShowTimePicker(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.pickerTitle}>Selecionar Horário</Text>

            <Text style={styles.chipSectionLabel}>Horas</Text>
            <View style={styles.chipsContainer}>
              {hours.map((h) => {
                const isSelected = h === timeHours;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setTimeHours(h)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {String(h).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.chipSectionLabel}>Minutos</Text>
            <View style={styles.chipsContainer}>
              {minutes.map((m) => {
                const isSelected = m === timeMinutes;
                return (
                  <TouchableOpacity
                    key={m}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setTimeMinutes(m)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {String(m).padStart(2, '0')}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmTime}>
              <Text style={styles.confirmButtonText}>Confirmar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginTop: 16,
    marginBottom: 8,
  },
  card: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  chevron: {
    fontSize: 22,
    color: '#ccc',
  },
  input: {
    fontSize: 16,
    color: '#1a1a1a',
    padding: 0,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButton: {
    padding: 4,
  },
  stepMinus: {
    fontSize: 28,
    color: '#999',
    fontWeight: '300',
  },
  stepPlus: {
    fontSize: 28,
    color: '#2ecc71',
    fontWeight: '300',
  },
  stepMinusSmall: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },
  stepPlusSmall: {
    fontSize: 24,
    color: '#2ecc71',
    fontWeight: '300',
  },
  stepValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginHorizontal: 6,
    minWidth: 28,
    textAlign: 'center',
  },
  durationInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    width: 44,
    marginHorizontal: 4,
    textAlign: 'center',
    textAlignVertical: 'center',
    paddingVertical: 0,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f4f8',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  linkText: {
    flex: 1,
    fontSize: 13,
    color: '#555',
  },
  copyButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 8,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  codeLabel: {
    fontSize: 14,
    color: '#555',
    marginRight: 8,
  },
  codeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2ecc71',
    letterSpacing: 1,
  },
  playerCard: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2ecc71',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  playerName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1a1a1a',
  },
  removeButton: {
    fontSize: 13,
    color: '#e74c3c',
    fontWeight: '600',
  },
  buttonContainer: {
    marginTop: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    padding: 8,
  },
  navButtonText: {
    fontSize: 28,
    color: '#2ecc71',
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  weekDaysRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  weekDayText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  daySelected: {
    backgroundColor: '#2ecc71',
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: '#2ecc71',
  },
  dayText: {
    fontSize: 14,
    color: '#1a1a1a',
  },
  dayTextSelected: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dayTextToday: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  dayTextEmpty: {
    color: 'transparent',
  },
  confirmButton: {
    backgroundColor: '#2ecc71',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 16,
  },
  chipSectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
    marginBottom: 8,
    marginTop: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#f9f9f9',
    marginRight: 8,
    marginBottom: 8,
  },
  chipSelected: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
  },
  chipText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#fff',
  },
});

export default NovaPeladaScreen;