// V5 Home — Hybrid (header con racha + stories rectangulares + destacado + feed)
// Todo el V5 portado a React Native (Expo) en un solo archivo.
//
// Requisitos:
//   npx expo install expo-blur expo-linear-gradient expo-image
//   npx expo install @expo-google-fonts/playfair-display @expo-google-fonts/dm-sans expo-font
//
// Asume que las fuentes se cargan en app/_layout.tsx (ver plantilla más abajo).

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Dimensions,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Heart,
  MessageCircle,
  Share2,
  Bookmark,
  MoreHorizontal,
  Flame,
  Music,
  Clock,
  Bell,
  Plus,
} from 'lucide-react-native';

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
  fontDisplay: 'PlayfairDisplay_500Medium',
  fontDisplay600: 'PlayfairDisplay_600SemiBold',
  fontBody: 'DMSans_400Regular',
  fontBodyMedium: 'DMSans_500Medium',
};

// ============================================================================
// MOCK DATA
// ============================================================================

const ME = {
  name: 'Jean',
  handle: 'jean',
  avatar: 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&q=80',
  weekVolume: '38,420 kg',
  weekSessions: 4,
  streak: 12,
};

type Story = {
  id: string;
  name: string;
  avatar: string;
  isMe?: boolean;
  live?: boolean;
  pr?: boolean;
};

const STORIES: Story[] = [
  { id: 's0', name: 'Tu día', avatar: ME.avatar, isMe: true },
  { id: 's1', name: 'Marco', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80', live: true },
  { id: 's2', name: 'Lucía', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80' },
  { id: 's3', name: 'Diego', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80', pr: true },
  { id: 's4', name: 'Sara', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80' },
  { id: 's5', name: 'Pablo', avatar: 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&q=80' },
  { id: 's6', name: 'Nora', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&q=80' },
  { id: 's7', name: 'Iván', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80' },
];

type Post = {
  id: string;
  user: { name: string; handle: string; avatar: string };
  photo: string;
  timeAgo: string;
  workoutType: string;
  duration: string;
  volume: string;
  prHit: boolean;
  prText?: string;
  caption: string;
  music: { title: string; artist: string; cover: string };
  likes: number;
  comments: number;
};

const FEED_POSTS: Post[] = [
  {
    id: 'p1',
    user: { name: 'Marco', handle: 'marco.lift', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80' },
    photo: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=1200&q=80',
    timeAgo: '2h',
    workoutType: 'Pull Day',
    duration: '1h 24m',
    volume: '8,420 kg',
    prHit: true,
    prText: 'Dominadas lastradas · +20kg',
    caption: 'Llevaba 4 semanas estancado en dominadas. Hoy por fin rompí. La progresión lenta paga.',
    music: { title: 'Take Care', artist: 'Beach House', cover: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=120&q=80' },
    likes: 24,
    comments: 6,
  },
  {
    id: 'p2',
    user: { name: 'Lucía', handle: 'lucia.ruiz', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80' },
    photo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&q=80',
    timeAgo: '5h',
    workoutType: 'Leg Day',
    duration: '1h 48m',
    volume: '12,180 kg',
    prHit: false,
    caption: 'Volumen brutal hoy. Las piernas no responden, mañana toca andar como pingüino.',
    music: { title: 'Limbo', artist: 'Freddie Dredd', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&q=80' },
    likes: 41,
    comments: 12,
  },
  {
    id: 'p3',
    user: { name: 'Diego', handle: 'diego.r', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80' },
    photo: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=1200&q=80',
    timeAgo: '8h',
    workoutType: 'Push Day',
    duration: '1h 12m',
    volume: '6,950 kg',
    prHit: true,
    prText: 'Press banca · 100 kg × 5',
    caption: 'Centenar club. Por fin.',
    music: { title: 'Heat Waves', artist: 'Glass Animals', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&q=80' },
    likes: 67,
    comments: 18,
  },
  {
    id: 'p4',
    user: { name: 'Sara', handle: 'sara.fit', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80' },
    photo: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=1200&q=80',
    timeAgo: '11h',
    workoutType: 'Full Body',
    duration: '58m',
    volume: '4,820 kg',
    prHit: false,
    caption: 'Sesión corta pero intensa. Dejé todo en la jaula.',
    music: { title: 'Tek It', artist: 'Cafuné', cover: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=120&q=80' },
    likes: 18,
    comments: 4,
  },
];

// ============================================================================
// HEADER (saludo + racha en coral + stats)
// ============================================================================

function Header() {
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
      {/* Greeting row */}
      <View style={styles.headerRow}>
        <Text style={styles.greeting}>
          Hola, <Text style={{ fontStyle: 'italic' }}>{ME.name}</Text>
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Bell size={22} color={theme.text} strokeWidth={1.6} />
          <Image source={ME.avatar} style={{ width: 30, height: 30, borderRadius: 999 }} />
        </View>
      </View>

      {/* Hero stats: streak (coral) + week */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
        <View style={{ flex: 2 }}>
          <LinearGradient
            colors={['#E8442A', '#c93620']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakCard}
          >
            <Text style={styles.eyebrowOnAccent}>TU RACHA</Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
              <Text style={styles.streakValue}>{ME.streak}</Text>
              <Text style={styles.streakLabel}>días seguidos</Text>
            </View>
            {/* Decorative flame */}
            <View style={styles.flameDecor} pointerEvents="none">
              <Flame size={120} color="#fff" strokeWidth={1} />
            </View>
          </LinearGradient>
        </View>
        <View style={[styles.weekCard, { flex: 1.5 }]}>
          <Text style={styles.eyebrow}>ESTA SEMANA</Text>
          <Text style={styles.weekVolume}>{ME.weekVolume}</Text>
          <Text style={styles.weekSessions}>{ME.weekSessions} sesiones</Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STORIES RAIL (rectángulos verticales)
// ============================================================================

function StoriesRail() {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingBottom: 16, paddingTop: 4 }}
    >
      {STORIES.map((s) => (
        <StoryCard key={s.id} story={s} />
      ))}
    </ScrollView>
  );
}

function StoryCard({ story: s }: { story: Story }) {
  const borderColor = s.isMe
    ? theme.border
    : s.live || s.pr
    ? theme.accent
    : theme.border;
  const borderWidth = s.live || s.pr ? 1.5 : 0.5;
  const borderStyle = s.isMe ? 'dashed' : 'solid';

  return (
    <View
      style={{
        width: 92,
        height: 130,
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth,
        borderColor,
        borderStyle,
        backgroundColor: s.isMe ? theme.card : '#000',
      }}
    >
      {!s.isMe && (
        <>
          <Image source={s.avatar} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient
            colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.85)']}
            locations={[0.4, 1]}
            style={StyleSheet.absoluteFillObject}
          />
        </>
      )}

      {/* Top badge */}
      {s.live && (
        <View style={[styles.storyBadge, { backgroundColor: theme.accent }]}>
          <View style={{ width: 5, height: 5, borderRadius: 999, backgroundColor: 'white' }} />
          <Text style={styles.storyBadgeText}>LIVE</Text>
        </View>
      )}
      {s.pr && !s.live && (
        <View style={[styles.storyBadge, { backgroundColor: 'rgba(232,68,42,0.95)' }]}>
          <Text style={styles.storyBadgeText}>PR</Text>
        </View>
      )}

      {s.isMe ? (
        <View style={styles.addStoryInner}>
          <View style={styles.addPlus}>
            <Plus size={20} color="#fff" strokeWidth={2} />
          </View>
          <Text style={styles.addStoryLabel}>Compartir tu día</Text>
        </View>
      ) : (
        <Text style={styles.storyName} numberOfLines={1}>
          {s.name}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// POST CARD (estilo V2)
// ============================================================================

function PostCard({ post }: { post: Post }) {
  const [liked, setLiked] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  return (
    <View style={{ marginBottom: 18, paddingHorizontal: 14 }}>
      <View style={styles.postCard}>
        {/* Header */}
        <View style={styles.postHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
            <Image source={post.user.avatar} style={{ width: 34, height: 34, borderRadius: 999 }} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.postUserName}>{post.user.name}</Text>
                {post.prHit && (
                  <View style={styles.prTag}>
                    <Text style={styles.prTagText}>PR</Text>
                  </View>
                )}
              </View>
              <Text style={styles.postSubtitle}>
                {post.workoutType} · {post.timeAgo}
              </Text>
            </View>
          </View>
          <MoreHorizontal size={22} color={theme.textMuted} strokeWidth={1.8} />
        </View>

        {/* Photo with floating stat pills */}
        <View>
          <Image source={post.photo} style={{ width: '100%', height: 380 }} contentFit="cover" />
          <View style={styles.statPillsRow}>
            <View style={styles.statPill}>
              <Clock size={13} color="#fff" strokeWidth={2} />
              <Text style={styles.statPillText}>{post.duration}</Text>
            </View>
            <View style={styles.statPill}>
              <Text style={[styles.statPillText, { fontVariant: ['tabular-nums'] }]}>{post.volume}</Text>
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => setLiked((v) => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            hitSlop={8}
          >
            <Heart
              size={22}
              color={liked ? theme.accent : theme.text}
              fill={liked ? theme.accent : 'transparent'}
              strokeWidth={1.8}
            />
            <Text style={styles.actionCount}>{post.likes + (liked ? 1 : 0)}</Text>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MessageCircle size={22} color={theme.text} strokeWidth={1.8} />
            <Text style={styles.actionCount}>{post.comments}</Text>
          </View>
          <Share2 size={22} color={theme.text} strokeWidth={1.8} />
          <View style={{ marginLeft: 'auto' }}>
            <Pressable onPress={() => setSaved((v) => !v)} hitSlop={8}>
              <Bookmark
                size={22}
                color={saved ? theme.text : theme.textMuted}
                fill={saved ? theme.text : 'transparent'}
                strokeWidth={1.8}
              />
            </Pressable>
          </View>
        </View>

        {/* Caption */}
        <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
          <Text style={styles.caption}>
            <Text style={{ fontFamily: theme.fontBodyMedium }}>{post.user.handle}</Text>{' '}
            {post.caption}
          </Text>
        </View>

        {/* Music */}
        <View style={styles.musicBar}>
          <Image source={post.music.cover} style={{ width: 26, height: 26, borderRadius: 6 }} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.musicTitle} numberOfLines={1}>
              {post.music.title}
            </Text>
            <Text style={styles.musicArtist} numberOfLines={1}>
              {post.music.artist}
            </Text>
          </View>
          <Music size={14} color={theme.textMuted} strokeWidth={2} />
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// HOME SCREEN (V5 final)
// ============================================================================

export default function FeedScreen() {
  const featured = FEED_POSTS.find((p) => p.prHit) || FEED_POSTS[0];
  const rest = FEED_POSTS.filter((p) => p.id !== featured.id);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 110 }}
        showsVerticalScrollIndicator={false}
      >
        <Header />

        <View style={{ paddingHorizontal: 20, paddingBottom: 8, paddingTop: 4 }}>
          <Text style={styles.eyebrow}>HOY EN TU CÍRCULO</Text>
        </View>

        <StoriesRail />

        {/* Destacado de hoy */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Destacado de hoy</Text>
          <Text style={styles.sectionMeta}>{featured.timeAgo}</Text>
        </View>
        <PostCard post={featured} />

        {/* Tu feed */}
        <View style={[styles.sectionTitleRow, { paddingTop: 6 }]}>
          <Text style={styles.sectionTitle}>Tu feed</Text>
          <Text style={[styles.sectionMeta, { color: theme.accent }]}>Filtros</Text>
        </View>
        {rest.map((p) => (
          <PostCard key={p.id} post={p} />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  greeting: {
    fontFamily: theme.fontDisplay,
    fontSize: 22,
    color: theme.text,
    letterSpacing: -0.3,
  },
  streakCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: 'hidden',
    minHeight: 78,
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
  streakLabel: {
    fontFamily: theme.fontBody,
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  flameDecor: {
    position: 'absolute',
    right: -20,
    top: -10,
    opacity: 0.18,
    transform: [{ rotate: '15deg' }],
  },
  weekCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  eyebrow: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    letterSpacing: 1,
  },
  weekVolume: {
    fontFamily: theme.fontDisplay,
    fontSize: 19,
    color: theme.text,
    marginTop: 6,
    lineHeight: 20,
  },
  weekSessions: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
    marginTop: 3,
  },

  // Stories
  storyBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  storyBadgeText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 8.5,
    color: '#fff',
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  addStoryInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addPlus: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addStoryLabel: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 10.5,
    color: theme.text,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  storyName: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    fontFamily: theme.fontBodyMedium,
    fontSize: 11,
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Section titles
  sectionTitleRow: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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

  // Post card
  postCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: theme.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  postUserName: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.text,
  },
  prTag: {
    backgroundColor: 'rgba(232,68,42,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  prTagText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 9,
    color: theme.accent,
    letterSpacing: 0.5,
    fontWeight: '700',
  },
  postSubtitle: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textMuted,
    marginTop: 1,
  },
  statPillsRow: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
  },
  statPill: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statPillText: {
    fontFamily: theme.fontBody,
    fontSize: 11.5,
    color: '#fff',
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  actionCount: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.text,
  },
  caption: {
    fontFamily: theme.fontBody,
    fontSize: 13,
    color: theme.text,
    lineHeight: 19,
  },
  musicBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderTopColor: theme.border,
  },
  musicTitle: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 11.5,
    color: theme.text,
  },
  musicArtist: {
    fontFamily: theme.fontBody,
    fontSize: 10.5,
    color: theme.textMuted,
  },
});
