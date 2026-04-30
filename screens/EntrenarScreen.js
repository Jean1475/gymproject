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
*/

import { useState, useEffect, useRef } from 'react'
import {
  Alert,
  ActivityIndicator,
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
import { Image } from 'expo-image'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import {
  Play,
  Plus,
  X,
  Trash2,
  ChevronRight,
  Clock,
  Dumbbell,
  TrendingUp,
  Calendar,
  Zap,
  Check,
  Search,
} from 'lucide-react-native'
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

// ============================================================================
// IDLE STATE
// ============================================================================

function IdleScreen({ onStart, history }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        contentContainerStyle={styles.idleScroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.topBar}>
          <Text style={styles.topBarTitle}>Entrenar</Text>
          <Dumbbell size={22} color={theme.textMuted} strokeWidth={1.6} />
        </View>

        {/* Hero CTA card */}
        <View style={styles.heroCard}>
          <View style={styles.heroBg} pointerEvents="none">
            <Dumbbell size={180} color={theme.accent} strokeWidth={0.8} style={{ opacity: 0.05 }} />
          </View>
          <Text style={styles.heroEyebrow}>CUANDO QUIERAS</Text>
          <Text style={styles.heroTitle}>¿Listo para{'\n'}entrenar?</Text>
          <Text style={styles.heroSubtitle}>
            Registra series, pesos y tiempos en tiempo real.
          </Text>
          <Pressable style={styles.btnPrimary} onPress={onStart}>
            <Play size={15} color="#fff" fill="#fff" strokeWidth={0} />
            <Text style={styles.btnPrimaryText}>Empezar entreno</Text>
          </Pressable>
        </View>

        {/* History */}
        {history.length > 0 && (
          <View style={{ marginTop: 28 }}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Historial reciente</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <Text style={styles.sectionMeta}>Ver todo</Text>
                <ChevronRight size={13} color={theme.textMuted} strokeWidth={2} />
              </View>
            </View>

            <View style={styles.historyCard}>
              {history.map((w, i) => (
                <View key={w.id}>
                  {i > 0 && <View style={styles.historyDivider} />}
                  <View style={styles.historyRow}>
                    <View style={styles.historyIconBox}>
                      <Calendar size={14} color={theme.accent} strokeWidth={2} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyName}>{w.name}</Text>
                      <Text style={styles.historyMeta}>
                        {timeAgo(w.created_at)} · {formatDuration(w.duration_seconds)}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

// ============================================================================
// ACTIVE STATE
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

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Fixed top bar */}
      <View style={styles.activeTopBar}>
        <Pressable onPress={onCancel} hitSlop={12} style={styles.cancelBtn}>
          <X size={18} color={theme.textMuted} strokeWidth={2} />
        </Pressable>
        <View style={styles.timerPill}>
          <Clock size={13} color={theme.accent} strokeWidth={2} />
          <Text style={styles.timerText}>{formatElapsed(elapsed)}</Text>
        </View>
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
          {/* Workout name */}
          <TextInput
            style={styles.workoutNameInput}
            value={workoutName}
            onChangeText={setWorkoutName}
            placeholder="Nombre del entreno"
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
          />

          {/* Live stats row */}
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
                {exercises.reduce((acc, ex) => acc + ex.sets.length, 0)}
              </Text>
              <Text style={styles.liveStatLabel}>series</Text>
            </View>
          </View>

          {/* Exercise cards */}
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

          {/* Add exercise button */}
          <Pressable style={styles.addExerciseBtn} onPress={onAddExercise}>
            <Plus size={16} color={theme.text} strokeWidth={2.2} />
            <Text style={styles.addExerciseBtnText}>Añadir ejercicio</Text>
          </Pressable>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FAB */}
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
    </SafeAreaView>
  )
}

// ============================================================================
// EXERCISE CARD
// ============================================================================

function ExerciseCard({ exercise: ex, index, onAddSet, onRemoveSet, onUpdateSet, onToggleComplete, onRemove }) {
  return (
    <View style={styles.exerciseCard}>
      {/* Card header */}
      <View style={styles.exerciseCardHeader}>
        <View style={styles.exerciseNumBadge}>
          <Text style={styles.exerciseNum}>{String(index + 1).padStart(2, '0')}</Text>
        </View>
        <Text style={styles.exerciseName}>{ex.name}</Text>
        <Pressable onPress={onRemove} hitSlop={10}>
          <Trash2 size={15} color={theme.textMuted} strokeWidth={1.8} />
        </Pressable>
      </View>

      {/* Suggestion pill */}
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
              ? `Sube a ${ex.suggestion.weight} kg × ${ex.suggestion.reps} reps (antes ${ex.suggestion.lastWeight} kg)`
              : `Repite ${ex.suggestion.weight} kg × ${ex.suggestion.reps} reps — completa todas las series`
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
            <Text style={styles.setNumber}>{set.setNumber}</Text>
          </View>
          <TextInput
            style={[styles.setInput, styles.colField, { marginRight: 8 }, set.completed && styles.setInputCompleted]}
            value={set.reps}
            onChangeText={v => onUpdateSet(idx, 'reps', v)}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
            editable={!set.completed}
          />
          <TextInput
            style={[styles.setInput, styles.colField, set.completed && styles.setInputCompleted]}
            value={set.weight}
            onChangeText={v => onUpdateSet(idx, 'weight', v)}
            keyboardType="numeric"
            placeholder="—"
            placeholderTextColor={theme.textDim}
            returnKeyType="done"
            editable={!set.completed}
          />
          <Pressable
            style={styles.colComplete}
            onPress={() => onToggleComplete(idx)}
            hitSlop={8}
          >
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

const DIFFICULTY_COLOR = { beginner: '#34c759', intermediate: '#f59e0b', advanced: '#E8442A' }

function ExerciseResultCard({ item, onPress, showBorder }) {
  const diffColor = DIFFICULTY_COLOR[item.difficulty] ?? theme.textMuted
  const [imgFailed, setImgFailed] = useState(false)

  return (
    <Pressable
      style={[styles.resultRow, showBorder && styles.resultRowBorder]}
      onPress={onPress}
    >
      <View style={styles.exerciseIconBox}>
        {item.id && !imgFailed ? (
          <Image
            source={{ uri: `https://exercisedb.io/image/${item.id}.gif` }}
            style={styles.exerciseGif}
            contentFit="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <Dumbbell size={20} color={theme.accent} strokeWidth={1.6} />
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text style={styles.resultName}>{item.name}</Text>
        <Text style={styles.resultMeta}>
          {item.target}  ·  {item.equipment}
        </Text>
        {item.difficulty ? (
          <Text style={[styles.resultDifficulty, { color: diffColor }]}>{item.difficulty}</Text>
        ) : null}
      </View>
      <ChevronRight size={14} color={theme.textDim} strokeWidth={2} />
    </Pressable>
  )
}

// ============================================================================
// ADD EXERCISE MODAL
// ============================================================================

function AddExerciseModal({ visible, onClose, onAdd }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => {
    if (!visible) {
      setQuery('')
      setResults([])
      setLoading(false)
    }
  }, [visible])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (!trimmed) { setResults([]); return }
    debounceRef.current = setTimeout(() => searchExercises(trimmed), 400)
    return () => clearTimeout(debounceRef.current)
  }, [query])

  async function searchExercises(name) {
    setLoading(true)
    try {
      const res = await fetch(
        `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?limit=8`,
        {
          headers: {
            'X-RapidAPI-Key': EXERCISEDB_API_KEY,
            'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
          },
        }
      )
      const data = await res.json()
      setResults(Array.isArray(data) ? data.slice(0, 8) : [])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(exerciseName) {
    onAdd(exerciseName)
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
          <Pressable style={styles.modalSheet} onPress={() => {}}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Añadir ejercicio</Text>

            {/* Search input */}
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

            {/* Results list */}
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

            {/* Empty state + añadir manual */}
            {showEmpty && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>Sin resultados para "{query.trim()}"</Text>
                <Pressable onPress={handleAddManual} hitSlop={8} style={{ marginTop: 8 }}>
                  <Text style={styles.addManualText}>Añadir "{query.trim()}" manualmente</Text>
                </Pressable>
              </View>
            )}

            <Pressable style={[styles.btnSecondary, { marginTop: 12 }]} onPress={handleClose}>
              <Text style={styles.btnSecondaryText}>Cancelar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ============================================================================
// MAIN SCREEN
// ============================================================================

export default function EntrenarScreen() {
  const [isActive, setIsActive] = useState(false)
  const [history, setHistory] = useState([])

  const [workoutName, setWorkoutName] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [exercises, setExercises] = useState([])
  const [modalVisible, setModalVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const timerRef = useRef(null)
  const elapsedRef = useRef(0)

  useEffect(() => {
    fetchHistory()
    return () => clearInterval(timerRef.current)
  }, [])

  async function fetchHistory() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, duration_seconds')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
    if (data) setHistory(data)
  }

  function startWorkout() {
    elapsedRef.current = 0
    setElapsed(0)
    setWorkoutName(todayName())
    setExercises([])
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
    }, 1000)
    setIsActive(true)
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
      }}]
    )
  }

  if (!isActive) {
    return <IdleScreen onStart={startWorkout} history={history} />
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

  // ─── Idle scroll ───
  idleScroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  // ─── Hero card ───
  heroCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: theme.border,
    padding: 24,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    right: -30,
    bottom: -20,
  },
  heroEyebrow: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    letterSpacing: 1,
    marginBottom: 10,
  },
  heroTitle: {
    fontFamily: theme.fontDisplay600,
    fontSize: 30,
    color: theme.text,
    letterSpacing: -0.5,
    lineHeight: 34,
    marginBottom: 10,
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
  sectionMeta: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
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
  historyIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(232,68,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 14,
    color: theme.text,
    marginBottom: 2,
  },
  historyMeta: {
    fontFamily: theme.fontBody,
    fontSize: 11.5,
    color: theme.textMuted,
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
  suggestionTextUp: {
    color: theme.accent,
  },
  suggestionTextRepeat: {
    color: theme.textMuted,
  },

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
  setNumCell: {
    justifyContent: 'center',
  },
  setNumber: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 12,
    color: theme.textMuted,
  },
  colSerie: {
    width: 40,
  },
  colField: {
    flex: 1,
  },
  colAction: {
    width: 28,
    height: 36,
  },
  colComplete: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setRowCompleted: {
    backgroundColor: 'rgba(52,199,89,0.06)',
  },
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
  fabDisabled: {
    opacity: 0.6,
  },
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

  // ─── Modal ───
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
    maxHeight: '90%',
  },
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
  resultsList: {
    maxHeight: 300,
    marginBottom: 4,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    gap: 12,
  },
  resultRowBorder: {
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  exerciseIconBox: {
    width: 58,
    height: 58,
    borderRadius: 12,
    backgroundColor: 'rgba(232,68,42,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
  },
  exerciseGif: {
    width: 58,
    height: 58,
    borderRadius: 12,
  },
  resultName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.text,
    textTransform: 'capitalize',
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
  emptyState: {
    paddingVertical: 12,
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
    marginBottom: 16,
  },
  modalInput: {
    fontFamily: theme.fontBody,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: theme.borderMid,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 16,
    color: theme.text,
    marginBottom: 20,
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
