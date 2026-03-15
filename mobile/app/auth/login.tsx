import React, { useState, useEffect } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  View,
  ActivityIndicator,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { FontAwesome, Ionicons } from '@expo/vector-icons';

WebBrowser.maybeCompleteAuthSession();

const EXPO_PROXY_URI = 'https://auth.expo.io/@alemr2006/CampusHub';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    responseType: 'id_token',
    scopes: ['openid', 'profile', 'email'],
    redirectUri: EXPO_PROXY_URI,
  });

  useEffect(() => {
    if (response?.type === 'success' && response.params.id_token) {
      const credential = GoogleAuthProvider.credential(response.params.id_token);
      handleSocialLogin(credential);
    }
  }, [response]);

  const handleGoogleLogin = async () => {
    if (!request) {
      Alert.alert('Error', 'Servicio no disponible');
      return;
    }

    setLoading(true);
    try {
      const result = await promptAsync({ useProxy: true } as any);
      if (result.type === 'error') {
        Alert.alert('Error', 'Error de conexión');
      }
    } catch (error) {
      Alert.alert('Error', 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) router.replace('/(tabs)');
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert('Error', 'Faltan datos');
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      Alert.alert('Error', 'Credenciales incorrectas');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (credential: any) => {
    setLoading(true);
    try {
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Usuario',
        provider: 'Google',
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      Alert.alert('Error', 'Error de sincronización');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.wrapper}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>CampusHub</Text>
              <ThemedText style={styles.sub}>Para Estudiantes y Docentes</ThemedText>
            </View>

            <View style={styles.form}>
              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Correo electrónico"
                  placeholderTextColor="#666"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>

              <View style={styles.inputBox}>
                <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder="Contraseña"
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDim]}
                onPress={handleLogin}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.btnText}>Iniciar Sesión</ThemedText>}
              </TouchableOpacity>
            </View>

            <View style={styles.sep}>
              <View style={styles.line} />
              <ThemedText style={styles.sepText}>O continuar con</ThemedText>
              <View style={styles.line} />
            </View>

            <TouchableOpacity
              style={[styles.gBtn, loading && styles.btnDim]}
              onPress={handleGoogleLogin}
              disabled={loading}
            >
              <View style={styles.gContent}>
                <FontAwesome name="google" size={20} color="#003cffff" style={styles.gIcon} />
                <ThemedText style={styles.gText}>Iniciar sesión con Google</ThemedText>
              </View>
            </TouchableOpacity>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.push('/auth/register')}>
                <ThemedText style={styles.footTxt}>
                  ¿No tienes cuenta? <ThemedText style={styles.footLink}>Regístrate</ThemedText>
                </ThemedText>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  wrapper: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 30, paddingBottom: 40, paddingTop: 80 },
  header: { alignItems: 'center', marginBottom: 50, overflow: 'visible' },
  title: {
    fontSize: 50,
    fontWeight: '900',
    color: '#007AFF',
    letterSpacing: -1,
    lineHeight: 50,
    paddingVertical: 5,
    textAlign: 'center',
    overflow: 'visible',
  },
  sub: { fontSize: 16, color: '#888', marginTop: 5, fontWeight: '600' },
  form: { gap: 15 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1C1C1E', borderRadius: 20, borderWidth: 1, borderColor: '#2C2C2E', paddingHorizontal: 15 },
  icon: { marginRight: 10 },
  textInput: { flex: 1, paddingVertical: 20, fontSize: 16, color: '#fff' },
  btn: { backgroundColor: '#007AFF', padding: 20, borderRadius: 20, alignItems: 'center', marginTop: 10 },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  btnDim: { opacity: 0.5 },
  sep: { flexDirection: 'row', alignItems: 'center', marginVertical: 45, width: '100%', justifyContent: 'center' },
  line: { flex: 1, height: 1, backgroundColor: '#2C2C2E' },
  sepText: { color: '#555', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', textAlign: 'center', paddingHorizontal: 15 },
  gBtn: { backgroundColor: '#fff', padding: 20, borderRadius: 20, alignItems: 'center' },
  gContent: { flexDirection: 'row', alignItems: 'center' },
  gIcon: { marginRight: 15 },
  gText: { color: '#000', fontSize: 17, fontWeight: '800' },
  footer: { marginTop: 50, alignItems: 'center', paddingBottom: 20 },
  footTxt: { color: '#777', fontSize: 15 },
  footLink: { color: '#007AFF', fontWeight: '800' }
});
