import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://jfoslbvhzgpfrivoxluj.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Impmb3NsYnZoemdwZnJpdm94bHVqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyOTk1MzMsImV4cCI6MjA5Mjg3NTUzM30.A5SR5pquN5mzxFTR-3Nvzh7lHR7XhNkcGm660KCFclU'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})