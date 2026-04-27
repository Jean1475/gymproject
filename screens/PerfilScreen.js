import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  Dimensions,
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation, useFocusEffect } from '@react-navigation/native'
import {
  Settings,
  LogOut,
  Flame,
  TrendingUp,
  Award,
  Calendar,
  Edit3,
  ChevronRight,
  Zap,
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
  border: 'rgba(255,255,255,0.07)',
  accent: '#E8442A',
  fontDisplay: 'PlayfairDisplay-Medium',
  fontDisplay600: 'PlayfairDisplay-SemiBold',
  fontBody: 'DMSans-Regular',
  fontBodyMedium: 'DMSans-Medium',
}

const CARD_GAP = 10
const H_PAD = 20
const CARD_W = (Dimensions.get('window').width - H_PAD * 2 - CARD_GAP) / 2

// ============================================================================
// MOCK DATA
// ============================================================================

const FALLBACK_AVATAR = 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&q=80'

const MOCK_STATS = {
  streak: 12,
  totalSessions: 248,
  totalVolume: '1.24M kg',
  followers: 94,
  following: 67,
}

const PRS = [
  { id: '1', exercise: 'Press banca',  weight: '120 kg', date: 'Hace 3 días' },
  { id: '2', exercise: 'Sentadilla',   weight: '140 kg', date: 'Hace 1 semana' },
  { id: '3', exercise: 'Peso muerto',  weight: '160 kg', date: 'Hace 2 semanas' },
  { id: '4', exercise: 'Dominadas',    weight: '+30 kg', date: 'Hace 4 días' },
]

const MOCK_SESSIONS = [
  { id: 'm1', name: 'Pull Day',   created_at: new Date(Date.now() - 2 * 86400000).toISOString(), duration_seconds: 5040 },
  { id: 'm2', name: 'Leg Day',    created_at: new Date(Date.now() - 4 * 86400000).toISOString(), duration_seconds: 6480 },
  { id: 'm3', name: 'Push Day',   created_at: new Date(Date.now() - 7 * 86400000).toISOString(), duration_seconds: 4320 },
]

// ============================================================================
// HELPERS
// ============================================================================

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

// ============================================================================
// PROFILE HEADER
// ============================================================================

function ProfileHeader({ profile, email, onEditPress }) {
  const name    = profile?.name    || 'Sin nombre'
  const handle  = profile?.handle  || ''
  const bio     = profile?.bio     || ''
  const avatar  = profile?.avatar_url || FALLBACK_AVATAR

  return (
    <View style={styles.profileHeader}>
      {/* Avatar */}
      <View style={styles.avatarRing}>
        <Image source={avatar} style={styles.avatar} contentFit="cover" />
        <View style={styles.streakBadge}>
          <Flame size={11} color="#fff" strokeWidth={2} fill="#fff" />
        </View>
      </View>

      <Text style={styles.profileName}>{name}</Text>
      {handle ? <Text style={styles.profileHandle}>@{handle}</Text> : null}
      {bio     ? <Text style={styles.profileBio}>{bio}</Text>         : null}
      {email   ? <Text style={styles.profileEmail}>{email}</Text>     : null}

      {/* Edit button */}
      <Pressable style={styles.editBtn} onPress={onEditPress}>
        <Edit3 size={13} color={theme.text} strokeWidth={2} />
        <Text style={styles.editBtnText}>Editar perfil</Text>
      </Pressable>

      {/* Social stats */}
      <View style={styles.socialRow}>
        <View style={styles.socialItem}>
          <Text style={styles.socialValue}>{MOCK_STATS.totalSessions}</Text>
          <Text style={styles.socialLabel}>sesiones</Text>
        </View>
        <View style={styles.socialDivider} />
        <View style={styles.socialItem}>
          <Text style={styles.socialValue}>{MOCK_STATS.followers}</Text>
          <Text style={styles.socialLabel}>seguidores</Text>
        </View>
        <View style={styles.socialDivider} />
        <View style={styles.socialItem}>
          <Text style={styles.socialValue}>{MOCK_STATS.following}</Text>
          <Text style={styles.socialLabel}>siguiendo</Text>
        </View>
      </View>
    </View>
  )
}

// ============================================================================
// STATS CARDS
// ============================================================================

function StatsSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.eyebrow}>TUS ESTADÍSTICAS</Text>
      <View style={{ flexDirection: 'row', gap: CARD_GAP, marginTop: 10 }}>

        {/* Streak card — coral gradient */}
        <View style={{ flex: 1.3 }}>
          <LinearGradient
            colors={['#E8442A', '#c93620']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakCard}
          >
            <Text style={styles.eyebrowOnAccent}>RACHA ACTUAL</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5, marginTop: 4 }}>
              <Text style={styles.streakValue}>{MOCK_STATS.streak}</Text>
              <Text style={styles.streakUnit}>días</Text>
            </View>
            <View style={styles.flameDecor} pointerEvents="none">
              <Flame size={90} color="#fff" strokeWidth={1} />
            </View>
          </LinearGradient>
        </View>

        {/* Volume card */}
        <View style={{ flex: 1.7 }}>
          <View style={[styles.statCard, { flex: 1 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <TrendingUp size={14} color={theme.accent} strokeWidth={2} />
              <Text style={styles.eyebrow}>VOLUMEN TOTAL</Text>
            </View>
            <Text style={styles.statCardValue}>{MOCK_STATS.totalVolume}</Text>
            <Text style={styles.statCardSub}>levantado en total</Text>
          </View>
        </View>

      </View>
    </View>
  )
}

// ============================================================================
// PR GRID
// ============================================================================

function PRGrid() {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Tus récords</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Award size={13} color={theme.accent} strokeWidth={2} />
          <Text style={[styles.sectionMeta, { color: theme.accent }]}>{PRS.length} PRs</Text>
        </View>
      </View>

      {/* 2 × 2 grid */}
      <View style={{ gap: CARD_GAP }}>
        <View style={{ flexDirection: 'row', gap: CARD_GAP }}>
          {PRS.slice(0, 2).map((pr) => <PRCard key={pr.id} pr={pr} />)}
        </View>
        <View style={{ flexDirection: 'row', gap: CARD_GAP }}>
          {PRS.slice(2, 4).map((pr) => <PRCard key={pr.id} pr={pr} />)}
        </View>
      </View>
    </View>
  )
}

function PRCard({ pr }) {
  return (
    <View style={styles.prCard}>
      <View style={styles.prAccentBar} />
      <Text style={styles.prExercise}>{pr.exercise}</Text>
      <Text style={styles.prWeight}>{pr.weight}</Text>
      <Text style={styles.prDate}>{pr.date}</Text>
    </View>
  )
}

// ============================================================================
// RECENT SESSIONS
// ============================================================================

function RecentSessions({ sessions }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle}>Últimas sesiones</Text>
        <Pressable style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
          <Text style={styles.sectionMeta}>Ver todo</Text>
          <ChevronRight size={13} color={theme.textMuted} strokeWidth={2} />
        </Pressable>
      </View>

      <View style={styles.sessionsCard}>
        {sessions.map((s, i) => (
          <View key={s.id}>
            {i > 0 && <View style={styles.sessionSep} />}
            <View style={styles.sessionRow}>
              <View style={styles.sessionIconBox}>
                <Calendar size={14} color={theme.accent} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sessionName}>{s.name}</Text>
                <Text style={styles.sessionMeta}>
                  {timeAgo(s.created_at)} · {formatDuration(s.duration_seconds)}
                </Text>
              </View>
              <ChevronRight size={16} color={theme.textMuted} strokeWidth={1.8} />
            </View>
          </View>
        ))}
      </View>
    </View>
  )
}

// ============================================================================
// SCREEN
// ============================================================================

export default function PerfilScreen() {
  const navigation = useNavigation()
  const [email, setEmail]       = useState(null)
  const [profile, setProfile]   = useState(null)
  const [sessions, setSessions] = useState(MOCK_SESSIONS)

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setEmail(user.email)
    // Load profile
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (data) setProfile(data)
    } catch {}
    // Load sessions
    try {
      const { data } = await supabase
        .from('workouts')
        .select('id, name, created_at, duration_seconds')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(3)
      if (data && data.length > 0) setSessions(data)
    } catch {}
  }

  // Reload profile when coming back from EditarPerfil
  useFocusEffect(useCallback(() => { loadData() }, []))

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ])
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>Perfil</Text>
        <Pressable hitSlop={10}>
          <Settings size={22} color={theme.text} strokeWidth={1.6} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <ProfileHeader
          profile={profile}
          email={email}
          onEditPress={() => navigation.navigate('EditarPerfil')}
        />

        <View style={styles.sectionDivider} />

        <StatsSection />
        <PRGrid />
        <RecentSessions sessions={sessions} />

        {/* Logout */}
        <View style={{ paddingHorizontal: H_PAD, marginTop: 8 }}>
          <Pressable style={styles.logoutBtn} onPress={handleLogout}>
            <LogOut size={15} color={theme.textMuted} strokeWidth={1.8} />
            <Text style={styles.logoutText}>Cerrar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // ─── Top bar ───
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: H_PAD,
    paddingTop: 6,
    paddingBottom: 12,
  },
  topBarTitle: {
    fontFamily: theme.fontDisplay,
    fontSize: 20,
    color: theme.text,
    letterSpacing: -0.2,
  },

  // ─── Profile header ───
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: H_PAD,
    paddingBottom: 24,
  },
  avatarRing: {
    width: 88,
    height: 88,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: theme.accent,
    padding: 3,
    marginBottom: 14,
    position: 'relative',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  streakBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.bg,
  },
  profileName: {
    fontFamily: theme.fontDisplay600,
    fontSize: 24,
    color: theme.text,
    letterSpacing: -0.3,
    marginBottom: 2,
  },
  profileHandle: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.textMuted,
    marginBottom: 8,
  },
  profileBio: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.text,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 4,
  },
  profileEmail: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
    marginBottom: 16,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    marginBottom: 24,
  },
  editBtnText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.text,
  },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  socialItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  socialValue: {
    fontFamily: theme.fontDisplay,
    fontSize: 20,
    color: theme.text,
    lineHeight: 22,
  },
  socialLabel: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 3,
  },
  socialDivider: {
    width: 0.5,
    height: 32,
    backgroundColor: theme.border,
  },

  sectionDivider: {
    height: 0.5,
    backgroundColor: theme.border,
    marginHorizontal: H_PAD,
    marginBottom: 24,
  },

  // ─── Section containers ───
  section: {
    paddingHorizontal: H_PAD,
    marginBottom: 28,
  },
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
  eyebrow: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    letterSpacing: 1,
  },

  // ─── Stats cards ───
  streakCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    minHeight: 82,
  },
  eyebrowOnAccent: {
    fontFamily: theme.fontBody,
    fontSize: 10,
    color: 'rgba(255,255,255,0.85)',
    letterSpacing: 0.8,
  },
  streakValue: {
    fontFamily: theme.fontDisplay,
    fontSize: 32,
    color: '#fff',
    lineHeight: 34,
  },
  streakUnit: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  flameDecor: {
    position: 'absolute',
    right: -18,
    top: -8,
    opacity: 0.18,
    transform: [{ rotate: '15deg' }],
  },
  statCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
    minHeight: 82,
    justifyContent: 'center',
  },
  statCardValue: {
    fontFamily: theme.fontDisplay,
    fontSize: 22,
    color: theme.text,
    marginBottom: 3,
    lineHeight: 24,
  },
  statCardSub: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
  },

  // ─── PR grid ───
  prCard: {
    width: CARD_W,
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: theme.border,
    padding: 14,
    overflow: 'hidden',
  },
  prAccentBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: theme.accent,
    opacity: 0.7,
  },
  prExercise: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
    letterSpacing: 0.3,
    marginTop: 6,
    marginBottom: 6,
  },
  prWeight: {
    fontFamily: theme.fontDisplay,
    fontSize: 22,
    color: theme.text,
    lineHeight: 24,
    marginBottom: 4,
  },
  prDate: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
  },

  // ─── Sessions ───
  sessionsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  sessionSep: {
    height: 0.5,
    backgroundColor: theme.border,
    marginLeft: 56,
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  sessionIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(232,68,42,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 14,
    color: theme.text,
    marginBottom: 2,
  },
  sessionMeta: {
    fontFamily: theme.fontBody,
    fontSize: 11.5,
    color: theme.textMuted,
  },

  // ─── Logout ───
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 0.5,
    borderColor: theme.border,
    borderRadius: 16,
    paddingVertical: 16,
  },
  logoutText: {
    fontFamily: theme.fontBody,
    fontSize: 14,
    color: theme.textMuted,
  },
})
