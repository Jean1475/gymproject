/*
  SQL — Ejecutar en Supabase SQL Editor antes de usar esta pantalla:

  create table workouts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    duration_seconds integer not null default 0,
    created_at timestamptz default now()
  );

  create table workout_exercises (
    id uuid default gen_random_uuid() primary key,
    workout_id uuid references workouts(id) on delete cascade not null,
    name text not null,
    "order" integer not null default 0,
    created_at timestamptz default now()
  );

  create table exercise_sets (
    id uuid default gen_random_uuid() primary key,
    exercise_id uuid references workout_exercises(id) on delete cascade not null,
    set_number integer not null,
    reps integer,
    weight numeric,
    completed boolean not null default false,
    created_at timestamptz default now()
  );

  alter table workouts enable row level security;
  alter table workout_exercises enable row level security;
  alter table exercise_sets enable row level security;

  create policy "own workouts" on workouts
    for all using (auth.uid() = user_id);

  create policy "own exercises" on workout_exercises
    for all using (
      exists (select 1 from workouts w where w.id = workout_id and w.user_id = auth.uid())
    );

  create policy "own sets" on exercise_sets
    for all using (
      exists (
        select 1 from workout_exercises we
        join workouts w on w.id = we.workout_id
        where we.id = exercise_id and w.user_id = auth.uid()
      )
    );

  create or replace function get_exercise_history(p_user_id uuid, p_exercise_name text)
  returns table(max_weight numeric, max_reps integer, all_completed boolean)
  language sql security definer as $$
    select
      max(es.weight) as max_weight,
      max(es.reps)   as max_reps,
      bool_and(es.completed) as all_completed
    from exercise_sets es
    join workout_exercises we on we.id = es.exercise_id
    join workouts w on w.id = we.workout_id
    where w.user_id = p_user_id
      and we.name = p_exercise_name
      and w.created_at > now() - interval '30 days'
    group by w.id
    order by w.created_at desc
    limit 1;
  $$;
*/

import { useState, useEffect, useRef } from 'react'
import {
  Alert,
  ActivityIndicator,
  Animated,
  PanResponder,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Pressable,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Play, Plus, X, Trash2, ChevronRight, Clock, Dumbbell,
  TrendingUp, Calendar, Zap, Check, Search, RotateCcw,
  ChevronLeft, History, Flame,
} from 'lucide-react-native'
import { Svg, Circle } from 'react-native-svg'
import { supabase } from '../lib/supabase'

const EXERCISEDB_API_KEY = 'fcc5956332msh6b1ce0d97649d3fp1ba945jsnf388d5dab124'

// ============================================================================
// THEME
// ============================================================================

const theme = {
  bg: '#111110',
  card: '#1c1c1b',
  cardAlt: '#222221',
  text: '#f5f4f0',
  textMuted: 'rgba(255,255,255,0.5)',
  textDim: 'rgba(255,255,255,0.25)',
  border: 'rgba(255,255,255,0.07)',
  borderMid: 'rgba(255,255,255,0.12)',
  accent: '#E8442A',
  fontDisplay: 'PlayfairDisplay-Medium',
  fontDisplay600: 'PlayfairDisplay-SemiBold',
  fontBody: 'DMSans-Regular',
  fontBodyMedium: 'DMSans-Medium',
}

// ============================================================================
// CATEGORÍAS Y COLORES
// ============================================================================

const BODY_PARTS = [
  { id: 'all',        label: 'Todos' },
  { id: 'chest',      label: 'Pecho' },
  { id: 'back',       label: 'Espalda' },
  { id: 'upper legs', label: 'Piernas' },
  { id: 'shoulders',  label: 'Hombros' },
  { id: 'upper arms', label: 'Brazos' },
  { id: 'waist',      label: 'Core' },
  { id: 'cardio',     label: 'Cardio' },
]

const BODYPART_COLORS = {
  back:         '#3b82f6',
  chest:        '#E8442A',
  shoulders:    '#f59e0b',
  'upper arms': '#8b5cf6',
  'lower arms': '#a78bfa',
  'upper legs': '#10b981',
  'lower legs': '#34d399',
  waist:        '#06b6d4',
  cardio:       '#f97316',
  neck:         '#6b7280',
}

const DIFFICULTY_COLOR = { beginner: '#34c759', intermediate: '#f59e0b', advanced: '#E8442A' }

function bpColor(bp) {
  return BODYPART_COLORS[bp?.toLowerCase()] ?? 'rgba(255,255,255,0.3)'
}

// ============================================================================
// HELPERS
// ============================================================================

function todayName() {
  const d = new Date()
  const dd = d.getDate().toString().padStart(2, '0')
  const mm = (d.getMonth() + 1).toString().padStart(2, '0')
  const yyyy = d.getFullYear()
  return `Entreno ${dd}/${mm}/${yyyy}`
}

function formatElapsed(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatDuration(secs) {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  if (m === 0) return '<1m'
  return `${m}m`
}

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  const w = Math.floor(days / 7)
  return `Hace ${w} semana${w > 1 ? 's' : ''}`
}

function calcVolume(exercises) {
  let total = 0
  exercises.forEach(ex => {
    ex.sets.forEach(s => {
      total += (parseFloat(s.reps) || 0) * (parseFloat(s.weight) || 0)
    })
  })
  if (total === 0) return '0 kg'
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k kg`
  return `${Math.round(total)} kg`
}

function calcVolumeFromSets(exercises) {
  let total = 0
  exercises.forEach(ex => {
    (ex.exercise_sets || []).forEach(s => {
      total += (parseFloat(s.reps) || 0) * (parseFloat(s.weight) || 0)
    })
  })
  if (total === 0) return '—'
  if (total >= 1000) return `${(total / 1000).toFixed(1)}k kg`
  return `${Math.round(total)} kg`
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 13) return 'Buenos días'
  if (h < 20) return 'Buenas tardes'
  return 'Buenas noches'
}

async function getExerciseSuggestion(exerciseName, userId) {
  const { data, error } = await supabase.rpc('get_exercise_history', {
    p_user_id: userId,
    p_exercise_name: exerciseName,
  })
  if (error || !data || data.length === 0) return null
  const last = data[0]
  const shouldIncrease = last.all_completed && last.max_weight > 0
  return {
    weight: shouldIncrease ? last.max_weight + 2.5 : last.max_weight,
    reps: last.max_reps,
    isIncrease: shouldIncrease,
    lastWeight: last.max_weight,
    lastReps: last.max_reps,
  }
}

function WeekDots({ history }) {
  const today = new Date()
  const dow = today.getDay()
  const startOfWeek = new Date(today)
  startOfWeek.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1))
  startOfWeek.setHours(0, 0, 0, 0)

  const trainedDays = new Set(history.map(w => new Date(w.created_at).toDateString()))
  const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

  return (
    <View style={styles.weekDotsRow}>
      {labels.map((label, i) => {
        const date = new Date(startOfWeek)
        date.setDate(startOfWeek.getDate() + i)
        const trained = trainedDays.has(date.toDateString())
        const isToday = date.toDateString() === today.toDateString()
        const isFuture = date > today

        return (
          <View key={i} style={styles.weekDotCol}>
            <View style={[
              styles.weekDot,
              trained && styles.weekDotTrained,
              isToday && !trained && styles.weekDotToday,
              isFuture && styles.weekDotFuture,
            ]}>
              {trained && <Check size={8} color="#fff" strokeWidth={3} />}
            </View>
            <Text style={[styles.weekDotLabel, isToday && { color: theme.accent }]}>{label}</Text>
          </View>
        )
      })}
    </View>
  )
}

// ============================================================================
// IDLE SCREEN
// ============================================================================

function IdleScreen({ onStart, history, weekCount, onOpenDetail }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.idleScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.greetingText}>{getGreeting()}</Text>
            <Text style={styles.topBarTitle}>Entrenar</Text>
          </View>
          <View style={styles.weekBadge}>
            <Flame size={13} color={theme.accent} strokeWidth={2} />
            <Text style={styles.weekBadgeText}>{weekCount} esta semana</Text>
          </View>
        </View>

        <WeekDots history={history} />

        {/* Hero CTA */}
        <LinearGradient
          colors={['#1e1e1d', '#1a1a19']}
          style={styles.heroCard}
        >
          <View style={styles.heroAccentBar} />
          <Text style={styles.heroTitle}>¿Listo para{'\n'}entrenar?</Text>
          <Text style={styles.heroSubtitle}>
            Registra series, pesos y tiempos en tiempo real.
          </Text>
          <Pressable style={styles.btnPrimary} onPress={onStart}>
            <Play size={15} color="#fff" fill="#fff" strokeWidth={0} />
            <Text style={styles.btnPrimaryText}>Empezar entreno</Text>
          </Pressable>
        </LinearGradient>

        {/* Historial */}
        {history.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Historial reciente</Text>
            </View>

            <View style={styles.historyCard}>
              {history.map((w, i) => {
                const exercises = (w.workout_exercises || [])
                  .sort((a, b) => a.order - b.order)
                const exNames = exercises.slice(0, 3).map(e => e.name).join(' · ')
                const more = exercises.length > 3 ? ` +${exercises.length - 3}` : ''

                return (
                  <Pressable key={w.id} onPress={() => onOpenDetail(w.id)}>
                    {i > 0 && <View style={styles.historyDivider} />}
                    <View style={styles.historyRow}>
                      <View style={styles.historyIconBox}>
                        <Calendar size={14} color={theme.accent} strokeWidth={2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.historyTopRow}>
                          <Text style={styles.historyName} numberOfLines={1}>{w.name}</Text>
                          <Text style={styles.historyAgo}>{timeAgo(w.created_at)}</Text>
                        </View>
                        {exNames ? (
                          <Text style={styles.historyExercises} numberOfLines={1}>
                            {exNames}{more}
                          </Text>
                        ) : null}
                        <Text style={styles.historyMeta}>
                          {formatDuration(w.duration_seconds)} · {exercises.length} ejercicios
                        </Text>
                      </View>
                      <ChevronRight size={15} color={theme.textDim} strokeWidth={1.8} />
                    </View>
                  </Pressable>
                )
              })}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ============================================================================
// WORKOUT RING
// ============================================================================

function WorkoutRing({ elapsed, totalSets, completedSets }) {
  const size = 116
  const stroke = 5
  const r = (size - stroke * 2) / 2
  const circ = 2 * Math.PI * r
  const progress = totalSets > 0 ? completedSets / totalSets : 0
  const offset = circ * (1 - progress)
  const ringColor = progress === 1 ? '#34c759' : '#E8442A'

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${circ} ${circ}`}
          strokeDashoffset={totalSets > 0 ? offset : circ}
          strokeLinecap="round"
          transform={`rotate(-90, ${size / 2}, ${size / 2})`}
        />
      </Svg>
      <Text style={styles.ringTimerText}>{formatElapsed(elapsed)}</Text>
      <Text style={styles.ringSetsText}>
        {totalSets > 0 ? `${completedSets}/${totalSets} series` : 'en curso'}
      </Text>
    </View>
  )
}

// ============================================================================
// ACTIVE SCREEN
// ============================================================================

function ActiveScreen({
  workoutName, setWorkoutName,
  elapsed,
  exercises,
  onAddExercise,
  onAddSet, onRemoveSet,
  onUpdateSet,
  onToggleComplete,
  onRemoveExercise,
  onFinish,
  onCancel,
  saving,
}) {
  const insets = useSafeAreaInsets()
  const totalSets = exercises.reduce((a, ex) => a + ex.sets.length, 0)
  const completedSets = exercises.reduce((a, ex) => a + ex.sets.filter(s => s.completed).length, 0)

  const [restSecs, setRestSecs] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const restRef = useRef(null)
  const prevCompletedRef = useRef(0)

  useEffect(() => {
    if (completedSets > prevCompletedRef.current) {
      clearInterval(restRef.current)
      setRestSecs(60)
      setRestActive(true)
      restRef.current = setInterval(() => {
        setRestSecs(s => {
          if (s <= 1) { clearInterval(restRef.current); setRestActive(false); return 0 }
          return s - 1
        })
      }, 1000)
    }
    prevCompletedRef.current = completedSets
  }, [completedSets])

  useEffect(() => () => clearInterval(restRef.current), [])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />

      <View style={styles.activeHeader}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.cancelBtn}>
          <X size={18} color={theme.textMuted} strokeWidth={2} />
        </Pressable>
        <WorkoutRing elapsed={elapsed} totalSets={totalSets} completedSets={completedSets} />
        <View style={{ width: 42 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.activeScroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TextInput
            style={styles.workoutNameInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Nombre del entreno"
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
          />

          <View style={styles.liveStatsRow}>
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{exercises.length}</Text>
              <Text style={styles.liveStatLabel}>ejercicios</Text>
            </View>
            <View style={styles.liveStatDivider} />
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>{calcVolume(exercises)}</Text>
              <Text style={styles.liveStatLabel}>volumen</Text>
            </View>
            <View style={styles.liveStatDivider} />
            <View style={styles.liveStat}>
              <Text style={styles.liveStatValue}>
                {exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)}
                <Text style={{ color: theme.textMuted, fontSize: 13 }}>
                  /{exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
                </Text>
              </Text>
              <Text style={styles.liveStatLabel}>series</Text>
            </View>
          </View>

          {exercises.length === 0 && (
            <View style={styles.emptyExercises}>
              <View style={styles.emptyExercisesIcon}>
                <Dumbbell size={32} color={theme.textDim} strokeWidth={1.2} />
              </View>
              <Text style={styles.emptyExercisesTitle}>Sin ejercicios</Text>
              <Text style={styles.emptyExercisesSub}>
                Añade tu primer ejercicio para empezar a registrar
              </Text>
            </View>
          )}

          {exercises.map((ex, exIdx) => (
            <ExerciseCard
              key={ex.id}
              exercise={ex}
              index={exIdx}
              onAddSet={() => onAddSet(ex.id)}
              onRemoveSet={(idx) => onRemoveSet(ex.id, idx)}
              onUpdateSet={(idx, field, val) => onUpdateSet(ex.id, idx, field, val)}
              onToggleComplete={(idx) => onToggleComplete(ex.id, idx)}
              onRemove={() => onRemoveExercise(ex.id)}
            />
          ))}

          <Pressable style={styles.addExerciseBtn} onPress={onAddExercise}>
            <Plus size={16} color={theme.text} strokeWidth={2.2} />
            <Text style={styles.addExerciseBtnText}>Añadir ejercicio</Text>
          </Pressable>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Pressable
        style={[styles.fab, { bottom: insets.bottom + 60 }, saving && styles.fabDisabled]}
        onPress={onFinish}
        disabled={saving}
      >
        <LinearGradient
          colors={['#E8442A', '#c93620']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.fabGradient}
        >
          {saving
            ? <Text style={styles.fabText}>Guardando...</Text>
            : <>
                <Zap size={16} color="#fff" fill="#fff" strokeWidth={0} />
                <Text style={styles.fabText}>Finalizar entreno</Text>
              </>
          }
        </LinearGradient>
      </Pressable>

      {/* Rest timer toast */}
      {restActive && (
        <View style={[styles.restToast, { bottom: insets.bottom + 136 }]}>
          <Clock size={13} color={theme.accent} strokeWidth={2} />
          <Text style={styles.restToastLabel}>Descanso</Text>
          <Text style={styles.restToastCount}>{restSecs}s</Text>
          <Pressable
            onPress={() => { clearInterval(restRef.current); setRestActive(false) }}
            hitSlop={8}
            style={styles.restToastSkipBtn}
          >
            <Text style={styles.restToastSkip}>Saltar</Text>
          </Pressable>
        </View>
      )}
    </SafeAreaView>
  )
}

// ============================================================================
// EXERCISE CARD
// ============================================================================

function ExerciseCard({ exercise: ex, index, onAddSet, onRemoveSet, onUpdateSet, onToggleComplete, onRemove }) {
  const done = ex.sets.filter(s => s.completed).length
  const total = ex.sets.length
  const allDone = done === total && total > 0

  const progressAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: total > 0 ? done / total : 0,
      duration: 350,
      useNativeDriver: false,
    }).start()
  }, [done, total])

  return (
    <View style={[styles.exerciseCard, allDone && styles.exerciseCardDone]}>
      {/* Card header */}
      <View style={[styles.exerciseCardHeader, allDone && styles.exerciseCardHeaderDone]}>
        <View style={styles.exerciseNumBadge}>
          <Text style={styles.exerciseNum}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <Text style={styles.exerciseName} numberOfLines={1}>{ex.name}</Text>
        <View style={[styles.setProgressBadge, allDone && styles.setProgressBadgeDone]}>
          <Text style={[styles.setProgressText, allDone && styles.setProgressTextDone]}>
            {done}/{total}
          </Text>
        </View>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Trash2 size={15} color={theme.textMuted} strokeWidth={1.8} />
        </Pressable>
      </View>

      <View style={styles.exProgressTrack}>
        <Animated.View style={[
          styles.exProgressFill,
          {
            width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
            backgroundColor: progressAnim.interpolate({
              inputRange: [0, 0.99, 1],
              outputRange: ['#E8442A', '#E8442A', '#34c759'],
            }),
          },
        ]} />
      </View>

      {/* Suggestion */}
      {ex.suggestion && (
        <View style={[
          styles.suggestionBanner,
          ex.suggestion.isIncrease ? styles.suggestionBannerUp : styles.suggestionBannerRepeat,
        ]}>
          {ex.suggestion.isIncrease && (
            <TrendingUp size={12} color={theme.accent} strokeWidth={2} />
          )}
          <Text style={[
            styles.suggestionText,
            ex.suggestion.isIncrease ? styles.suggestionTextUp : styles.suggestionTextRepeat,
          ]}>
            {ex.suggestion.isIncrease
              ? `Sube a ${ex.suggestion.weight} kg × ${ex.suggestion.reps} reps`
              : `Repite ${ex.suggestion.weight} kg × ${ex.suggestion.reps} reps`
            }
          </Text>
        </View>
      )}

      {/* Sets table header */}
      <View style={styles.setHeaderRow}>
        <Text style={[styles.setHeaderCell, styles.colSerie]}>SERIE</Text>
        <Text style={[styles.setHeaderCell, styles.colField]}>REPS</Text>
        <Text style={[styles.setHeaderCell, styles.colField]}>PESO (kg)</Text>
        <View style={styles.colComplete} />
        <View style={styles.colAction} />
      </View>

      {/* Set rows */}
      {ex.sets.map((set, idx) => (
        <View key={idx} style={[styles.setRow, set.completed && styles.setRowCompleted]}>
          <View style={[styles.setNumCell, styles.colSerie]}>
            <Text style={[styles.setNumber, set.completed && { color: '#34c759' }]}>{set.setNumber}</Text>
          </View>
          <TextInput
            style={[styles.setInput, styles.colField, { marginRight: 8 }, set.completed && styles.setInputCompleted]}
            value={set.reps}
            onChangeText={v => onUpdateSet(idx, 'reps', v)}
            keyboardType="numeric"
            placeholder={ex.suggestion ? String(ex.suggestion.reps || '—') : '—'}
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
            editable={!set.completed}
          />
          <TextInput
            style={[styles.setInput, styles.colField, set.completed && styles.setInputCompleted]}
            value={set.weight}
            onChangeText={v => onUpdateSet(idx, 'weight', v)}
            keyboardType="numeric"
            placeholder={ex.suggestion ? String(ex.suggestion.weight || '—') : '—'}
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
            editable={!set.completed}
          />
          <Pressable style={styles.colComplete} onPress={() => onToggleComplete(idx)} hitSlop={8}>
            <View style={[styles.completeBtnCircle, set.completed && styles.completeBtnCircleActive]}>
              <Check size={10} color={set.completed ? '#fff' : theme.textDim} strokeWidth={2.5} />
            </View>
          </Pressable>
          <Pressable
            style={[styles.colAction, { alignItems: 'center', justifyContent: 'center' }]}
            onPress={() => onRemoveSet(idx)}
            hitSlop={8}
          >
            <X size={13} color={theme.textDim} strokeWidth={2} />
          </Pressable>
        </View>
      ))}

      {/* Add set */}
      <Pressable style={styles.addSetBtn} onPress={onAddSet}>
        <Plus size={13} color={theme.textMuted} strokeWidth={2.2} />
        <Text style={styles.addSetBtnText}>Añadir serie</Text>
      </Pressable>
    </View>
  )
}

// ============================================================================
// EXERCISE RESULT CARD
// ============================================================================

function ExerciseResultCard({ item, onPress, showBorder }) {
  const diffColor = DIFFICULTY_COLOR[item.difficulty] ?? theme.textMuted
  const partCol = bpColor(item.bodyPart)

  return (
    <Pressable
      style={[styles.resultRow, showBorder && styles.resultRowBorder]}
      onPress={onPress}
    >
      <View style={[styles.bpAccentBar, { backgroundColor: partCol }]} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.resultName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.resultMeta} numberOfLines={1}>
          {item.target}  ·  {item.equipment}
        </Text>
        {item.difficulty ? (
          <Text style={[styles.resultDifficulty, { color: diffColor }]}>{item.difficulty}</Text>
        ) : null}
      </View>
      <View style={[styles.bpBadge, { backgroundColor: `${partCol}22` }]}>
        <Text style={[styles.bpBadgeText, { color: partCol }]} numberOfLines={1}>
          {item.bodyPart}
        </Text>
      </View>
      <ChevronRight size={14} color={theme.textDim} strokeWidth={2} style={{ marginLeft: 6 }} />
    </Pressable>
  )
}

// ============================================================================
// ADD EXERCISE MODAL
// ============================================================================

function AddExerciseModal({ visible, onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [results, setResults] = useState([])
  const [recentExercises, setRecentExercises] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)
  const translateY = useRef(new Animated.Value(0)).current
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && g.dy > Math.abs(g.dx),
      onPanResponderMove: (_, g) => { if (g.dy > 0) translateY.setValue(g.dy) },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 90 || g.vy > 0.8) {
          Animated.timing(translateY, { toValue: 700, duration: 220, useNativeDriver: true }).start(() => {
            translateY.setValue(0)
            setQuery(''); setResults([])
            onCloseRef.current()
          })
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start()
        }
      },
    })
  ).current

  useEffect(() => { if (visible) translateY.setValue(0) }, [visible])

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setResults([])
      setLoading(false)
      setCategory('all')
    } else {
      loadRecent()
    }
  }, [visible])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) {
      setResults([])
      if (category !== 'all') {
        debounceRef.current = setTimeout(() => fetchByCategory(category), 200)
      }
      return
    }
    debounceRef.current = setTimeout(() => searchByName(trimmed), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  useEffect(() => {
    if (!visible) return
    setResults([])
    if (category !== 'all' && !query.trim()) {
      fetchByCategory(category)
    }
  }, [category])

  async function loadRecent() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('workout_exercises')
      .select('name, workouts!inner(user_id)')
      .eq('workouts.user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)
    if (!data) return
    const seen = new Set()
    const unique = []
    for (const item of data) {
      if (!seen.has(item.name)) {
        seen.add(item.name)
        unique.push(item.name)
        if (unique.length >= 6) break
      }
    }
    setRecentExercises(unique)
  }

  async function searchByName(name) {
    setLoading(true)
    try {
      const res = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?limit=10`,
        { headers: { 'X-RapidAPI-Key': EXERCISEDB_API_KEY, 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' } }
      )
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 10) : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  async function fetchByCategory(bodyPart) {
    setLoading(true)
    try {
      const res = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=20`,
        { headers: { 'X-RapidAPI-Key': EXERCISEDB_API_KEY, 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' } }
      )
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 20) : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(name) {
    onAdd(name)
    setQuery('')
    setResults([])
  }

  function handleAddManual() {
    const trimmed = query.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setQuery('')
    setResults([])
  }

  function handleClose() {
    setQuery('')
    setResults([])
    onClose()
  }

  const showRecent = !query.trim() && category === 'all' && recentExercises.length > 0 && results.length === 0
  const showEmpty = !loading && query.trim().length > 0 && results.length === 0

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => inputRef.current?.focus()}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.modalOverlay} onPress={handleClose}>
          <Animated.View style={[styles.modalSheet, { transform: [{ translateY }] }]}>
            <View {...panResponder.panHandlers} style={{ paddingBottom: 4 }}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>Añadir ejercicio</Text>
            </View>

            {/* Búsqueda */}
            <View style={styles.searchInputWrapper}>
              <Search size={16} color={theme.textMuted} strokeWidth={2} />
              <TextInput
                ref={inputRef}
                style={styles.searchInput}
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar ejercicio..."
                placeholderTextColor={theme.textMuted}
                returnKeyType="search"
              />
              {loading && <ActivityIndicator size="small" color={theme.textMuted} />}
              {!loading && query.length > 0 && (
                <Pressable onPress={() => setQuery('')} hitSlop={8}>
                  <X size={14} color={theme.textMuted} strokeWidth={2} />
                </Pressable>
              )}
            </View>

            {/* Categorías */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryScroll}
              contentContainerStyle={styles.categoryScrollContent}
            >
              {BODY_PARTS.map(bp => (
                <Pressable
                  key={bp.id}
                  style={[styles.categoryChip, category === bp.id && styles.categoryChipActive]}
                  onPress={() => setCategory(bp.id)}
                >
                  <Text style={[styles.categoryChipText, category === bp.id && styles.categoryChipTextActive]}>
                    {bp.label}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Recientes */}
            {showRecent && (
              <View style={styles.recentSection}>
                <Text style={styles.recentTitle}>Recientes</Text>
                {recentExercises.map((name, i) => (
                  <Pressable
                    key={i}
                    style={[styles.recentRow, i < recentExercises.length - 1 && styles.recentRowBorder]}
                    onPress={() => handleSelect(name)}
                  >
                    <History size={14} color={theme.textMuted} strokeWidth={1.8} />
                    <Text style={styles.recentName} numberOfLines={1}>{name}</Text>
                    <Plus size={14} color={theme.textDim} strokeWidth={2} />
                  </Pressable>
                ))}
              </View>
            )}

            {/* Resultados */}
            {results.length > 0 && (
              <ScrollView
                style={styles.resultsList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {results.map((item, idx) => (
                  <ExerciseResultCard
                    key={item.id || String(idx)}
                    item={item}
                    onPress={() => handleSelect(item.name)}
                    showBorder={idx < results.length - 1}
                  />
                ))}
              </ScrollView>
            )}

            {/* Cargando categoría */}
            {loading && results.length === 0 && (
              <View style={styles.loadingState}>
                <ActivityIndicator color={theme.textMuted} />
              </View>
            )}

            {/* Sin resultados */}
            {showEmpty && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Sin resultados para "{query.trim()}"</Text>
                <Pressable onPress={handleAddManual} hitSlop={8} style={{ marginTop: 8 }}>
                  <Text style={styles.addManualText}>Añadir "{query.trim()}" manualmente</Text>
                </Pressable>
              </View>
            )}

            {/* Estado vacío al inicio */}
            {!showRecent && !loading && results.length === 0 && !query.trim() && category === 'all' && recentExercises.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Busca un ejercicio o selecciona una categoría</Text>
              </View>
            )}

          </Animated.View>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ============================================================================
// WORKOUT DETAIL MODAL
// ============================================================================

function WorkoutDetailModal({ visible, workout, onClose, onRepeat }) {
  if (!workout) return null

  const totalSets = workout.exercises?.reduce((acc, ex) => acc + (ex.exercise_sets?.length || 0), 0) ?? 0
  const volume = calcVolumeFromSets(workout.exercises || [])

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: 32 }]} onPress={() => {}}>
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.detailHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle} numberOfLines={1}>{workout.name}</Text>
              <Text style={styles.detailSubtitle}>
                {timeAgo(workout.created_at)} · {formatDuration(workout.duration_seconds)}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.cancelBtn}>
              <X size={18} color={theme.textMuted} strokeWidth={2} />
            </Pressable>
          </View>

          {/* Stats */}
          <View style={styles.detailStatRow}>
            <View style={styles.detailStat}>
              <Text style={styles.detailStatValue}>{workout.exercises?.length ?? 0}</Text>
              <Text style={styles.detailStatLabel}>ejercicios</Text>
            </View>
            <View style={styles.liveStatDivider} />
            <View style={styles.detailStat}>
              <Text style={styles.detailStatValue}>{totalSets}</Text>
              <Text style={styles.detailStatLabel}>series</Text>
            </View>
            <View style={styles.liveStatDivider} />
            <View style={styles.detailStat}>
              <Text style={styles.detailStatValue}>{volume}</Text>
              <Text style={styles.detailStatLabel}>volumen</Text>
            </View>
          </View>

          {/* Ejercicios */}
          <ScrollView
            style={styles.detailScroll}
            showsVerticalScrollIndicator={false}
          >
            {(workout.exercises || []).map((ex, i) => (
              <View key={ex.id || i} style={styles.detailExerciseBlock}>
                <Text style={styles.detailExerciseName}>{ex.name}</Text>
                {(ex.exercise_sets || []).map((s, si) => (
                  <View key={si} style={styles.detailSetRow}>
                    <Text style={styles.detailSetNum}>Serie {s.set_number}</Text>
                    <Text style={styles.detailSetData}>
                      {s.reps ? `${s.reps} reps` : '—'}
                      {s.weight ? `  ·  ${s.weight} kg` : ''}
                    </Text>
                    {s.completed && (
                      <View style={styles.detailSetCheck}>
                        <Check size={9} color="#34c759" strokeWidth={2.5} />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ))}
            <View style={{ height: 8 }} />
          </ScrollView>

          {/* Repetir */}
          <Pressable
            style={styles.repeatBtn}
            onPress={() => onRepeat((workout.exercises || []).map(e => e.name))}
          >
            <RotateCcw size={15} color="#fff" strokeWidth={2} />
            <Text style={styles.repeatBtnText}>Repetir este entreno</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function EntrenarScreen() {
  const [isActive, setIsActive] = useState(false)
  const [history, setHistory] = useState([])
  const [weekCount, setWeekCount] = useState(0)
  const [detailVisible, setDetailVisible] = useState(false)
  const [detailWorkout, setDetailWorkout] = useState(null)

  const [workoutName, setWorkoutName] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [exercises, setExercises] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const timerRef = useRef(null)
  const elapsedRef = useRef(0)

  useEffect(() => {
    fetchHistory()
    fetchWeekCount()
    return () => clearInterval(timerRef.current)
  }, [])

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, duration_seconds, workout_exercises(id, name, "order")')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setHistory(data)
  }

  async function fetchWeekCount() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    const { count } = await supabase
      .from('workouts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', weekAgo.toISOString())
    setWeekCount(count ?? 0)
  }

  async function openWorkoutDetail(workoutId) {
    const workout = history.find(w => w.id === workoutId)
    if (!workout) return

    const { data: exercises } = await supabase
      .from('workout_exercises')
      .select('id, name, "order", exercise_sets(set_number, reps, weight, completed)')
      .eq('workout_id', workoutId)
      .order('order')

    setDetailWorkout({ ...workout, exercises: exercises || [] })
    setDetailVisible(true)
  }

  function startWorkout(preloadedExercises = null) {
    elapsedRef.current = 0
    setElapsed(0)
    setWorkoutName(todayName())
    setExercises(preloadedExercises || [])
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
    setIsActive(true)
  }

  async function repeatWorkout(exerciseNames) {
    setDetailVisible(false)
    setDetailWorkout(null)
    const { data: { user } } = await supabase.auth.getUser()
    const newExercises = await Promise.all(
      exerciseNames.map(async (name, i) => {
        const suggestion = await getExerciseSuggestion(name, user?.id)
        return {
          id: Date.now().toString() + i,
          name,
          sets: [{ setNumber: 1, reps: '', weight: '', completed: false }],
          suggestion,
        }
      })
    )
    startWorkout(newExercises)
  }

  function cancelWorkout() {
    Alert.alert(
      'Cancelar entreno',
      '¿Seguro? Se perderán los datos del entreno actual.',
      [
        { text: 'Continuar', style: 'cancel' },
        {
          text: 'Cancelar entreno',
          style: 'destructive',
          onPress: () => {
            clearInterval(timerRef.current)
            setIsActive(false)
            setElapsed(0)
            setExercises([])
          },
        },
      ]
    )
  }

  async function addExercise(name) {
    const { data: { user } } = await supabase.auth.getUser()
    const suggestion = await getExerciseSuggestion(name, user?.id)
    setExercises(prev => [
      ...prev,
      { id: Date.now().toString(), name, sets: [{ setNumber: 1, reps: '', weight: '', completed: false }], suggestion },
    ])
    setModalVisible(false)
  }

  function addSet(exerciseId) {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex
        return {
          ...ex,
          sets: [...ex.sets, { setNumber: ex.sets.length + 1, reps: '', weight: '', completed: false }],
        }
      })
    )
  }

  function removeSet(exerciseId, idx) {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex
        if (ex.sets.length <= 1) return ex
        const sets = ex.sets
          .filter((_, i) => i !== idx)
          .map((s, i) => ({ ...s, setNumber: i + 1 }))
        return { ...ex, sets }
      })
    )
  }

  function removeExercise(exerciseId) {
    setExercises(prev => prev.filter(ex => ex.id !== exerciseId))
  }

  function toggleComplete(exerciseId, idx) {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex
        const sets = [...ex.sets]
        sets[idx] = { ...sets[idx], completed: !sets[idx].completed }
        return { ...ex, sets }
      })
    )
  }

  function updateSet(exerciseId, idx, field, value) {
    setExercises(prev =>
      prev.map(ex => {
        if (ex.id !== exerciseId) return ex
        const sets = [...ex.sets]
        sets[idx] = { ...sets[idx], [field]: value }
        return { ...ex, sets }
      })
    )
  }

  async function finishWorkout() {
    clearInterval(timerRef.current)
    const duration = elapsedRef.current
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const { data: workout, error: wErr } = await supabase
      .from('workouts')
      .insert({ user_id: user.id, name: workoutName, duration_seconds: duration })
      .select()
      .single()

    if (wErr) {
      Alert.alert('Error', wErr.message)
      setSaving(false)
      return
    }

    let totalSets = 0
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i]
      const { data: exRow, error: exErr } = await supabase
        .from('workout_exercises')
        .insert({ workout_id: workout.id, name: ex.name, order: i })
        .select()
        .single()
      if (exErr) continue

      const setsToInsert = ex.sets
        .filter(s => s.reps !== '' || s.weight !== '')
        .map(s => ({
          exercise_id: exRow.id,
          set_number: s.setNumber,
          reps: s.reps !== '' ? parseInt(s.reps, 10) : null,
          weight: s.weight !== '' ? parseFloat(s.weight) : null,
          completed: s.completed ?? false,
        }))

      if (setsToInsert.length > 0) {
        await supabase.from('exercise_sets').insert(setsToInsert)
        totalSets += setsToInsert.length
      }
    }

    setSaving(false)
    Alert.alert(
      '¡Entreno completado!',
      `Duración: ${formatDuration(duration)}\nEjercicios: ${exercises.length}\nSeries: ${totalSets}\nVolumen: ${calcVolume(exercises)}`,
      [{ text: 'Cerrar', onPress: () => {
        setIsActive(false)
        setElapsed(0)
        setExercises([])
        fetchHistory()
        fetchWeekCount()
      }}]
    )
  }

  if (!isActive) {
    return (
      <>
        <IdleScreen
          onStart={() => startWorkout()}
          history={history}
          weekCount={weekCount}
          onOpenDetail={openWorkoutDetail}
        />
        <WorkoutDetailModal
          visible={detailVisible}
          workout={detailWorkout}
          onClose={() => { setDetailVisible(false); setDetailWorkout(null) }}
          onRepeat={repeatWorkout}
        />
      </>
    )
  }

  return (
    <>
      <ActiveScreen
        workoutName={workoutName}
        setWorkoutName={setWorkoutName}
        elapsed={elapsed}
        exercises={exercises}
        onAddExercise={() => setModalVisible(true)}
        onAddSet={addSet}
        onRemoveSet={removeSet}
        onUpdateSet={updateSet}
        onToggleComplete={toggleComplete}
        onRemoveExercise={removeExercise}
        onFinish={finishWorkout}
        onCancel={cancelWorkout}
        saving={saving}
      />
      <AddExerciseModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onAdd={addExercise}
      />
    </>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // ─── Top bars ───
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 4,
  },
  topBarTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 20,
    color: theme.text,
    letterSpacing: -0.2,
  },
  activeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 12,
  },
  cancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  timerText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 15,
    color: theme.text,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },

  // ─── Active header with ring ───
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  ringTimerText: {
    fontFamily: 'DMSans-Medium',
    fontSize: 22,
    color: '#f5f4f0',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
  },
  ringSetsText: {
    fontFamily: 'DMSans-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 1,
  },

  // ─── Exercise progress bar ───
  exProgressTrack: {
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    overflow: 'hidden',
  },
  exProgressFill: {
    height: 2,
  },

  // ─── Rest timer toast ───
  restToast: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: 'rgba(232,68,42,0.3)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  restToastLabel: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
    flex: 1,
  },
  restToastCount: {
    fontFamily: theme.fontDisplay600,
    fontSize: 22,
    color: theme.text,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  restToastSkipBtn: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  restToastSkip: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 12,
    color: theme.textMuted,
  },

  // ─── Week dots ───
  weekDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  weekDotCol: {
    alignItems: 'center',
    gap: 5,
  },
  weekDot: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotTrained: {
    backgroundColor: '#E8442A',
    borderColor: '#E8442A',
  },
  weekDotToday: {
    borderColor: '#E8442A',
    borderWidth: 1.5,
  },
  weekDotFuture: {
    opacity: 0.3,
  },
  weekDotLabel: {
    fontFamily: 'DMSans-Regular',
    fontSize: 10,
    color: 'rgba(255,255,255,0.4)',
  },

  // ─── Week badge & greeting ───
  weekBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(232,68,42,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(232,68,42,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  weekBadgeText: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.accent,
  },
  greetingText: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 2,
  },

  // ─── Idle scroll ───
  idleScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // ─── Hero card ───
  heroCard: {
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: theme.border,
    padding: 24,
    overflow: 'hidden',
    marginTop: 4,
  },
  heroAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.accent,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  heroTitle: {
    fontFamily: theme.fontDisplay600,
    fontSize: 28,
    color: theme.text,
    letterSpacing: -0.5,
    lineHeight: 32,
    marginBottom: 8,
    marginTop: 4,
  },
  heroSubtitle: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 19,
    marginBottom: 22,
  },

  // ─── History ───
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 17,
    color: theme.text,
    letterSpacing: -0.2,
  },
  historyCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  historyDivider: {
    height: 0.5,
    backgroundColor: theme.border,
    marginLeft: 56,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  historyTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  historyIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(232,68,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  historyName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13.5,
    color: theme.text,
    flex: 1,
    marginRight: 8,
  },
  historyAgo: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
    flexShrink: 0,
  },
  historyExercises: {
    fontFamily: theme.fontBody,
    fontSize: 11.5,
    color: theme.textMuted,
    marginBottom: 2,
  },
  historyMeta: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textDim,
  },

  // ─── Active scroll ───
  activeScroll: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // ─── Workout name input ───
  workoutNameInput: {
    fontFamily: theme.fontDisplay,
    fontSize: 22,
    color: theme.text,
    letterSpacing: -0.3,
    paddingVertical: 0,
    marginBottom: 14,
  },

  // ─── Live stats row ───
  liveStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
    paddingVertical: 14,
    marginBottom: 20,
  },
  liveStat: {
    flex: 1,
    alignItems: 'center',
  },
  liveStatValue: {
    fontFamily: theme.fontDisplay,
    fontSize: 18,
    color: theme.text,
    lineHeight: 20,
  },
  liveStatLabel: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    marginTop: 3,
  },
  liveStatDivider: {
    width: 0.5,
    height: 30,
    backgroundColor: theme.border,
  },

  // ─── Exercise card ───
  exerciseCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: theme.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  exerciseCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  exerciseCardDone: {
    borderColor: 'rgba(52,199,89,0.25)',
  },
  exerciseCardHeaderDone: {
    borderBottomColor: 'rgba(52,199,89,0.15)',
  },
  setProgressBadge: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  setProgressBadgeDone: {
    backgroundColor: 'rgba(52,199,89,0.15)',
  },
  setProgressText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 11,
    color: theme.textMuted,
  },
  setProgressTextDone: {
    color: '#34c759',
  },
  exerciseNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(232,68,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseNum: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 10,
    color: theme.accent,
    letterSpacing: 0.5,
  },
  exerciseName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 15,
    color: theme.text,
    flex: 1,
  },
  suggestionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 10,
    marginBottom: 2,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  suggestionBannerUp: {
    backgroundColor: 'rgba(232,68,42,0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(232,68,42,0.25)',
  },
  suggestionBannerRepeat: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  suggestionText: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    flex: 1,
  },
  suggestionTextUp: { color: theme.accent },
  suggestionTextRepeat: { color: theme.textMuted },

  // ─── Sets table ───
  setHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  setHeaderCell: {
    fontFamily: theme.fontBody,
    fontSize: 9.5,
    color: theme.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  setNumCell: { justifyContent: 'center' },
  setNumber: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 12,
    color: theme.textMuted,
  },
  colSerie: { width: 40 },
  colField: { flex: 1 },
  colAction: { width: 28, height: 36 },
  colComplete: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  setRowCompleted: { backgroundColor: 'rgba(52,199,89,0.06)' },
  completeBtnCircle: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeBtnCircleActive: {
    backgroundColor: 'rgba(52,199,89,0.85)',
    borderColor: 'rgba(52,199,89,0.85)',
  },
  setInputCompleted: {
    opacity: 0.45,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  setInput: {
    fontFamily: theme.fontBody,
    fontSize: 15,
    color: theme.text,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: theme.borderMid,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  addSetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginHorizontal: 14,
    marginTop: 6,
    marginBottom: 12,
    paddingVertical: 9,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 10,
  },
  addSetBtnText: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
  },

  // ─── Empty exercises ───
  emptyExercises: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyExercisesIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyExercisesTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 17,
    color: theme.text,
    letterSpacing: -0.2,
  },
  emptyExercisesSub: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 20,
  },

  // ─── Add exercise button ───
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.2)',
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 4,
  },
  addExerciseBtnText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 15,
    color: theme.text,
  },

  // ─── FAB ───
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    borderRadius: 999,
    overflow: 'hidden',
    zIndex: 10,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  fabDisabled: { opacity: 0.6 },
  fabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 17,
  },
  fabText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 16,
    color: '#fff',
  },

  // ─── Modal base ───
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#1c1c1b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    maxHeight: '92%',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 20,
    color: theme.text,
    letterSpacing: -0.2,
    marginBottom: 4,
  },

  // ─── Search ───
  searchInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: theme.borderMid,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: theme.fontBody,
    fontSize: 16,
    color: theme.text,
    paddingVertical: 0,
  },

  // ─── Categories ───
  categoryScroll: {
    marginBottom: 14,
  },
  categoryScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  categoryChipActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  categoryChipText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.textMuted,
  },
  categoryChipTextActive: {
    color: '#fff',
  },

  // ─── Recent exercises ───
  recentSection: {
    marginBottom: 8,
  },
  recentTitle: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textDim,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  recentRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  recentName: {
    flex: 1,
    fontFamily: theme.fontBodyMedium,
    fontSize: 14,
    color: theme.text,
    textTransform: 'capitalize',
  },

  // ─── Results ───
  resultsList: {
    maxHeight: 280,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 10,
  },
  resultRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  bpAccentBar: {
    width: 3,
    height: 36,
    borderRadius: 999,
    flexShrink: 0,
  },
  resultName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13.5,
    color: theme.text,
    textTransform: 'capitalize',
    marginBottom: 2,
  },
  resultMeta: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
    textTransform: 'capitalize',
  },
  resultDifficulty: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    textTransform: 'capitalize',
  },
  bpBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    flexShrink: 0,
    maxWidth: 80,
  },
  bpBadgeText: {
    fontFamily: theme.fontBody,
    fontSize: 10,
    textTransform: 'capitalize',
  },

  // ─── States ───
  loadingState: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 20,
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyText: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
    textAlign: 'center',
  },
  addManualText: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.textMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },

  // ─── Workout detail modal ───
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  detailSubtitle: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 2,
  },
  detailStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
    paddingVertical: 14,
    marginBottom: 20,
  },
  detailStat: {
    flex: 1,
    alignItems: 'center',
  },
  detailStatValue: {
    fontFamily: theme.fontDisplay,
    fontSize: 18,
    color: theme.text,
    lineHeight: 20,
  },
  detailStatLabel: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    marginTop: 3,
  },
  detailScroll: {
    maxHeight: 300,
    marginBottom: 16,
  },
  detailExerciseBlock: {
    marginBottom: 16,
  },
  detailExerciseName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  detailSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 10,
  },
  detailSetNum: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.textMuted,
    width: 52,
  },
  detailSetData: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.text,
    flex: 1,
  },
  detailSetCheck: {
    width: 16,
    height: 16,
    borderRadius: 999,
    backgroundColor: 'rgba(52,199,89,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 16,
  },
  repeatBtnText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 16,
    color: '#fff',
  },

  // ─── Buttons ───
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingVertical: 16,
  },
  btnPrimaryText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 16,
    color: '#fff',
  },
  btnSecondary: {
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: theme.borderMid,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSecondaryText: {
    fontFamily: theme.fontBody,
    fontSize: 16,
    color: theme.text,
  },
})
