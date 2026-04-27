/*
  SQL — Ejecutar en Supabase antes de usar esta pantalla:

  -- 1. Tabla de posts
  create table posts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade not null,
    photo_url text not null,
    caption text default '',
    workout_type text default '',
    duration_seconds integer,
    volume_kg numeric,
    workout_id uuid references workouts(id),
    created_at timestamptz default now()
  );

  alter table posts enable row level security;
  create policy "posts public read"   on posts for select using (true);
  create policy "insert own posts"    on posts for insert with check (auth.uid() = user_id);
  create policy "delete own posts"    on posts for delete using (auth.uid() = user_id);

  -- 2. Storage bucket (crear en Supabase Dashboard → Storage → New bucket)
  --    Nombre: post-photos | Tipo: Public
*/

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import {
  X,
  Camera,
  ImageIcon,
  Clock,
  TrendingUp,
  ChevronRight,
  Check,
} from 'lucide-react-native'
import { supabase } from '../lib/supabase'

// ============================================================================
// THEME
// ============================================================================

const theme = {
  bg: '#111110',
  card: '#1c1c1b',
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

const W = Dimensions.get('window').width
const PHOTO_H = (W - 40) * (5 / 4)

const WORKOUT_TYPES = ['Push Day', 'Pull Day', 'Leg Day', 'Full Body', 'Cardio', 'Otro']

// ============================================================================
// HELPERS
// ============================================================================

function formatDuration(secs) {
  if (!secs) return '—'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function formatVolume(kg) {
  if (!kg || kg === 0) return '0 kg'
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)}k kg`
  return `${Math.round(kg)} kg`
}

function timeAgo(iso) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days === 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  return `Hace ${Math.floor(days / 7)} sem.`
}

async function uploadPhoto(uri, userId) {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'

  const response = await fetch(uri)
  const arrayBuffer = await response.arrayBuffer()

  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, arrayBuffer, { contentType, upsert: false })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('post-photos')
    .getPublicUrl(path)

  return publicUrl
}

async function fetchWorkoutVolume(workoutId) {
  const { data: exercises } = await supabase
    .from('workout_exercises')
    .select('id')
    .eq('workout_id', workoutId)

  if (!exercises || exercises.length === 0) return 0

  const { data: sets } = await supabase
    .from('exercise_sets')
    .select('reps, weight')
    .in('exercise_id', exercises.map(e => e.id))

  if (!sets) return 0
  return sets.reduce((sum, s) => sum + (s.reps || 0) * (s.weight || 0), 0)
}

// ============================================================================
// SCREEN
// ============================================================================

export default function CompartirScreen() {
  const navigation = useNavigation()

  const [photo, setPhoto]               = useState(null)
  const [caption, setCaption]           = useState('')
  const [workoutType, setWorkoutType]   = useState('')
  const [recentWorkouts, setRecentWorkouts] = useState([])
  const [selectedWorkout, setSelectedWorkout] = useState(null)
  const [linkedDuration, setLinkedDuration]   = useState(null)
  const [linkedVolume, setLinkedVolume]       = useState(null)
  const [loadingVolume, setLoadingVolume]     = useState(false)
  const [publishing, setPublishing]     = useState(false)

  useEffect(() => {
    fetchRecentWorkouts()
  }, [])

  async function fetchRecentWorkouts() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('workouts')
      .select('id, name, created_at, duration_seconds')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)
    if (data) setRecentWorkouts(data)
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Activa el acceso a la galería en Ajustes.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 0.85,
    })
    if (!result.canceled) setPhoto(result.assets[0])
  }

  async function selectWorkout(workout) {
    if (selectedWorkout?.id === workout.id) {
      setSelectedWorkout(null)
      setLinkedDuration(null)
      setLinkedVolume(null)
      return
    }
    setSelectedWorkout(workout)
    setLinkedDuration(workout.duration_seconds)
    setLoadingVolume(true)
    try {
      const vol = await fetchWorkoutVolume(workout.id)
      setLinkedVolume(vol)
    } catch {
      setLinkedVolume(null)
    } finally {
      setLoadingVolume(false)
    }
  }

  async function publish() {
    if (!photo) {
      Alert.alert('Falta la foto', 'Añade una foto para publicar.')
      return
    }
    setPublishing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const photoUrl = await uploadPhoto(photo.uri, user.id)

      const { error: insertError } = await supabase.from('posts').insert({
        user_id: user.id,
        photo_url: photoUrl,
        caption: caption.trim(),
        workout_type: workoutType,
        duration_seconds: linkedDuration ?? null,
        volume_kg: linkedVolume ?? null,
        workout_id: selectedWorkout?.id ?? null,
      })

      if (insertError) throw insertError

      navigation.navigate('Home', { screen: 'Feed', params: { refresh: Date.now() } })
    } catch (err) {
      Alert.alert('Error al publicar', err.message)
    } finally {
      setPublishing(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.closeBtn}>
          <X size={18} color={theme.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Compartir</Text>
        <Pressable
          style={[styles.publishBtn, publishing && { opacity: 0.5 }]}
          onPress={publish}
          disabled={publishing}
        >
          {publishing
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.publishBtnText}>Publicar</Text>
          }
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Photo picker */}
          <Pressable style={styles.photoArea} onPress={pickPhoto}>
            {photo ? (
              <>
                <Image
                  source={photo.uri}
                  style={StyleSheet.absoluteFillObject}
                  contentFit="cover"
                />
                <View style={styles.changePhotoOverlay}>
                  <Camera size={18} color="#fff" strokeWidth={2} />
                  <Text style={styles.changePhotoText}>Cambiar foto</Text>
                </View>
              </>
            ) : (
              <View style={styles.photoPlaceholder}>
                <View style={styles.photoIconBox}>
                  <ImageIcon size={28} color={theme.textMuted} strokeWidth={1.5} />
                </View>
                <Text style={styles.photoPlaceholderTitle}>Añadir foto</Text>
                <Text style={styles.photoPlaceholderSub}>Toca para abrir la galería</Text>
              </View>
            )}
          </Pressable>

          {/* Caption */}
          <View style={styles.section}>
            <Text style={styles.label}>DESCRIPCIÓN</Text>
            <TextInput
              style={styles.captionInput}
              value={caption}
              onChangeText={setCaption}
              placeholder="¿Qué tal fue el entreno? Cuéntalo..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              maxLength={300}
            />
            <Text style={styles.charCount}>{caption.length}/300</Text>
          </View>

          {/* Workout type */}
          <View style={styles.section}>
            <Text style={styles.label}>TIPO DE ENTRENAMIENTO</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingTop: 10 }}
            >
              {WORKOUT_TYPES.map((type) => {
                const active = workoutType === type
                return (
                  <Pressable
                    key={type}
                    style={[styles.typePill, active && styles.typePillActive]}
                    onPress={() => setWorkoutType(active ? '' : type)}
                  >
                    <Text style={[styles.typePillText, active && styles.typePillTextActive]}>
                      {type}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>
          </View>

          {/* Link workout */}
          {recentWorkouts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.label}>VINCULAR ENTRENO</Text>
              <Text style={styles.labelSub}>Importa la duración y el volumen automáticamente</Text>

              <View style={styles.workoutsCard}>
                {recentWorkouts.map((w, i) => {
                  const selected = selectedWorkout?.id === w.id
                  return (
                    <View key={w.id}>
                      {i > 0 && <View style={styles.workoutDivider} />}
                      <Pressable
                        style={[styles.workoutRow, selected && styles.workoutRowSelected]}
                        onPress={() => selectWorkout(w)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.workoutName}>{w.name}</Text>
                          <Text style={styles.workoutMeta}>
                            {timeAgo(w.created_at)} · {formatDuration(w.duration_seconds)}
                          </Text>
                        </View>
                        <View style={[styles.workoutCheckbox, selected && styles.workoutCheckboxActive]}>
                          {selected && <Check size={12} color="#fff" strokeWidth={3} />}
                        </View>
                      </Pressable>
                    </View>
                  )
                })}
              </View>

              {/* Linked stats */}
              {selectedWorkout && (
                <View style={styles.linkedStatsRow}>
                  <View style={styles.linkedStat}>
                    <Clock size={14} color={theme.accent} strokeWidth={2} />
                    <View>
                      <Text style={styles.linkedStatValue}>
                        {formatDuration(linkedDuration)}
                      </Text>
                      <Text style={styles.linkedStatLabel}>duración</Text>
                    </View>
                  </View>
                  <View style={styles.linkedStatDivider} />
                  <View style={styles.linkedStat}>
                    <TrendingUp size={14} color={theme.accent} strokeWidth={2} />
                    <View>
                      {loadingVolume
                        ? <ActivityIndicator size="small" color={theme.text} style={{ marginVertical: 2 }} />
                        : <Text style={styles.linkedStatValue}>{formatVolume(linkedVolume)}</Text>
                      }
                      <Text style={styles.linkedStatLabel}>volumen total</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 17,
    color: theme.text,
    letterSpacing: -0.2,
  },
  publishBtn: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  publishBtnText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 14,
    color: '#fff',
  },

  scroll: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },

  // Photo
  photoArea: {
    width: W - 40,
    height: PHOTO_H,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: theme.card,
    borderWidth: 0.5,
    borderColor: theme.border,
    marginBottom: 24,
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  photoIconBox: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: theme.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  photoPlaceholderTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 18,
    color: theme.text,
    letterSpacing: -0.2,
  },
  photoPlaceholderSub: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.textMuted,
  },
  changePhotoOverlay: {
    position: 'absolute',
    bottom: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  changePhotoText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 12,
    color: '#fff',
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  label: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    letterSpacing: 1,
    marginBottom: 2,
  },
  labelSub: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 10,
    marginTop: 3,
  },

  // Caption
  captionInput: {
    fontFamily: theme.fontBody,
    fontSize: 15,
    color: theme.text,
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    minHeight: 100,
    marginTop: 10,
    lineHeight: 22,
  },
  charCount: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textDim,
    textAlign: 'right',
    marginTop: 6,
  },

  // Workout type pills
  typePill: {
    borderWidth: 0.5,
    borderColor: theme.borderMid,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  typePillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  typePillText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.textMuted,
  },
  typePillTextActive: {
    color: '#fff',
  },

  // Workout list
  workoutsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: theme.border,
    overflow: 'hidden',
    marginTop: 10,
  },
  workoutDivider: {
    height: 0.5,
    backgroundColor: theme.border,
    marginLeft: 16,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  workoutRowSelected: {
    backgroundColor: 'rgba(232,68,42,0.07)',
  },
  workoutName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 14,
    color: theme.text,
    marginBottom: 2,
  },
  workoutMeta: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: theme.textMuted,
  },
  workoutCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: theme.borderMid,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutCheckboxActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },

  // Linked stats
  linkedStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.card,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
    marginTop: 10,
    overflow: 'hidden',
  },
  linkedStat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  linkedStatDivider: {
    width: 0.5,
    height: 36,
    backgroundColor: theme.border,
  },
  linkedStatValue: {
    fontFamily: theme.fontDisplay,
    fontSize: 17,
    color: theme.text,
    lineHeight: 19,
  },
  linkedStatLabel: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    marginTop: 2,
  },
})
