/*
  SQL — Ejecutar en Supabase antes de usar esta pantalla:

  create table profiles (
    id uuid references auth.users(id) on delete cascade primary key,
    name text default '',
    handle text default '',
    bio text default '',
    avatar_url text default '',
    updated_at timestamptz default now()
  );

  alter table profiles enable row level security;
  create policy "profiles public read" on profiles for select using (true);
  create policy "own profile"          on profiles for all using (auth.uid() = id);

  -- Storage bucket para avatares (crear en Dashboard → Storage → New bucket)
  -- Nombre: profile-avatars | Tipo: Public
*/

import { useState, useEffect } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  StyleSheet,
  StatusBar,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useNavigation } from '@react-navigation/native'
import * as ImagePicker from 'expo-image-picker'
import { X, Camera } from 'lucide-react-native'
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

const PLACEHOLDER_AVATAR = 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=400&q=80'

// ============================================================================
// HELPERS
// ============================================================================

async function uploadAvatar(uri, userId) {
  const ext = uri.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${userId}/avatar.${ext}`
  const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'

  const response = await fetch(uri)
  const blob = await response.blob()

  const { error } = await supabase.storage
    .from('profile-avatars')
    .upload(path, blob, { contentType, upsert: true })

  if (error) throw error

  const { data: { publicUrl } } = supabase.storage
    .from('profile-avatars')
    .getPublicUrl(path)

  return publicUrl
}

// ============================================================================
// SCREEN
// ============================================================================

export default function EditarPerfilScreen() {
  const navigation = useNavigation()

  const [avatarUri, setAvatarUri]   = useState(null)
  const [isNewAvatar, setIsNewAvatar] = useState(false)
  const [name, setName]             = useState('')
  const [handle, setHandle]         = useState('')
  const [bio, setBio]               = useState('')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      if (data) {
        setName(data.name || '')
        setHandle(data.handle || '')
        setBio(data.bio || '')
        setAvatarUri(data.avatar_url || null)
      }
    } catch {}
    finally { setLoading(false) }
  }

  async function pickAvatar() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso necesario', 'Activa el acceso a la galería en Ajustes.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    })
    if (!result.canceled) {
      setAvatarUri(result.assets[0].uri)
      setIsNewAvatar(true)
    }
  }

  function sanitizeHandle(value) {
    return value.replace(/[^a-zA-Z0-9_.]/g, '').toLowerCase()
  }

  async function save() {
    const trimmedName = name.trim()
    const trimmedHandle = handle.trim()

    if (!trimmedName) {
      Alert.alert('Nombre requerido', 'Escribe tu nombre para continuar.')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let finalAvatarUrl = avatarUri || ''

      if (isNewAvatar && avatarUri) {
        try {
          finalAvatarUrl = await uploadAvatar(avatarUri, user.id)
        } catch {
          // Avatar upload failed — keep existing URL
          finalAvatarUrl = avatarUri
        }
      }

      const { error } = await supabase.from('profiles').upsert({
        id: user.id,
        username: trimmedHandle,
        name: trimmedName,
        handle: trimmedHandle,
        bio: bio.trim(),
        avatar_url: finalAvatarUrl,
        updated_at: new Date().toISOString(),
      })

      if (error) throw error
      navigation.goBack()
    } catch (err) {
      Alert.alert('Error al guardar', err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </View>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }} edges={['top']}>
      <StatusBar barStyle="light-content" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.closeBtn}>
          <X size={18} color={theme.text} strokeWidth={2} />
        </Pressable>
        <Text style={styles.topBarTitle}>Editar perfil</Text>
        <Pressable
          style={[styles.saveBtn, saving && { opacity: 0.5 }]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.saveBtnText}>Guardar</Text>
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
          {/* Avatar */}
          <View style={styles.avatarSection}>
            <Pressable style={styles.avatarWrapper} onPress={pickAvatar}>
              <Image
                source={avatarUri || PLACEHOLDER_AVATAR}
                style={styles.avatar}
                contentFit="cover"
              />
              <View style={styles.avatarOverlay}>
                <Camera size={18} color="#fff" strokeWidth={2} />
              </View>
            </Pressable>
            <Pressable onPress={pickAvatar}>
              <Text style={styles.avatarLabel}>Cambiar foto</Text>
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Fields */}
          <View style={styles.fieldsCard}>
            <Field
              label="NOMBRE"
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              maxLength={40}
            />
            <View style={styles.fieldDivider} />
            <Field
              label="IDENTIFICADOR"
              value={handle}
              onChangeText={(v) => setHandle(sanitizeHandle(v))}
              placeholder="tu_usuario"
              prefix="@"
              autoCapitalize="none"
              maxLength={30}
            />
            <View style={styles.fieldDivider} />
            <Field
              label="BIOGRAFÍA"
              value={bio}
              onChangeText={setBio}
              placeholder="Cuéntanos algo sobre ti..."
              multiline
              maxLength={150}
            />
          </View>

          {/* Char count for bio */}
          <Text style={styles.charCount}>{bio.length}/150</Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Field component ─────────────────────────────────────────────────────────

function Field({ label, value, onChangeText, placeholder, prefix, multiline, maxLength, autoCapitalize }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.fieldInputRow}>
        {prefix ? <Text style={styles.fieldPrefix}>{prefix}</Text> : null}
        <TextInput
          style={[styles.fieldInput, multiline && styles.fieldInputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize || 'words'}
          returnKeyType={multiline ? 'default' : 'done'}
        />
      </View>
    </View>
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
  saveBtn: {
    backgroundColor: theme.accent,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 14,
    color: '#fff',
  },

  scroll: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    gap: 12,
    marginBottom: 28,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.accent,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: theme.fontBodyMedium,
    fontSize: 13,
    color: theme.accent,
  },

  divider: {
    height: 0.5,
    backgroundColor: theme.border,
    marginBottom: 24,
  },

  // Fields card
  fieldsCard: {
    backgroundColor: theme.card,
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: theme.border,
    overflow: 'hidden',
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  fieldLabel: {
    fontFamily: theme.fontBody,
    fontSize: 10,
    color: theme.textMuted,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  fieldInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldPrefix: {
    fontFamily: theme.fontBody,
    fontSize: 15,
    color: theme.textMuted,
    marginRight: 2,
  },
  fieldInput: {
    flex: 1,
    fontFamily: theme.fontBody,
    fontSize: 15,
    color: theme.text,
    paddingVertical: 0,
  },
  fieldInputMultiline: {
    minHeight: 60,
    lineHeight: 22,
  },
  fieldDivider: {
    height: 0.5,
    backgroundColor: theme.border,
    marginLeft: 16,
  },

  charCount: {
    fontFamily: theme.fontBody,
    fontSize: 11,
    color: theme.textDim,
    textAlign: 'right',
    marginTop: 8,
  },
})
