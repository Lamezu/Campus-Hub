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
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router } from 'expo-router';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithCredential,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const redirectUri = 'https://auth.expo.io/@anonymous/campushub';

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    scopes: ['profile', 'email'],
  });

  useEffect(() => {
    setDebugInfo(`Platform: ${Platform.OS} | URI: ${redirectUri}`);
  }, []);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response?.type === 'error') {
        Alert.alert('Google Error', response.error?.message || 'Unknown error');
      }
      return;
    }

    const successResponse = response as AuthSession.AuthSessionResult & {
      params?: Record<string, string>;
      authentication?: { idToken?: string; accessToken?: string };
      url?: string;
    };

    let idToken: string | null = null;
    let accessToken: string | null = null;

    if (successResponse.params?.id_token) {
      idToken = successResponse.params.id_token;
      accessToken = successResponse.params.access_token ?? null;
    } else if (successResponse.authentication?.idToken) {
      idToken = successResponse.authentication.idToken;
      accessToken = successResponse.authentication.accessToken ?? null;
    }

    if (idToken) {
      const credential = GoogleAuthProvider.credential(idToken);
      handleSocialLogin(credential);
      return;
    }

    if (accessToken) {
      const credential = GoogleAuthProvider.credential(null, accessToken);
      handleSocialLogin(credential);
      return;
    }

    if (successResponse.url) {
      try {
        const urlObj = new URL(successResponse.url);
        const hash = urlObj.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const extracted = params.get('id_token');
        if (extracted) {
          const credential = GoogleAuthProvider.credential(extracted);
          handleSocialLogin(credential);
          return;
        }
      } catch {}
    }

    Alert.alert('Error', 'No authentication token received from Google');
  }, [response]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace('/(tabs)');
      }
    });
    return unsubscribe;
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please complete all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email');
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      let message = 'Invalid credentials';
      if (error.code === 'auth/user-not-found') message = 'User not found';
      if (error.code === 'auth/wrong-password') message = 'Wrong password';
      if (error.code === 'auth/too-many-requests') message = 'Too many attempts, try later';
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (credential: any) => {
    setLoading(true);
    try {
      const userCredential = await signInWithCredential(auth, credential);
      const user = userCredential.user;

      const userRef = doc(db, 'users', user.uid);
      const userData = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'Usuario',
        photoURL: user.photoURL || null,
        role: 'alumno',
        provider: 'Google',
        emailVerified: user.emailVerified,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(userRef, userData, { merge: true });
      router.replace('/(tabs)');
    } catch (error: any) {
      let message = 'Unable to sign in with Google';
      switch (error.code) {
        case 'auth/account-exists-with-different-credential':
          message = 'This email is registered with a different sign-in method';
          break;
        case 'auth/popup-blocked':
        case 'auth/popup-closed-by-user':
          message = 'Google sign-in was cancelled or blocked';
          break;
        case 'auth/unauthorized-domain':
          message = 'Unauthorized domain configured in Firebase';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid or expired credential';
          break;
      }
      Alert.alert('Error', message);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (value: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(value);
  };

  const testFirestore = async () => {
    try {
      const testRef = doc(db, 'test', `test-${Date.now()}`);
      await setDoc(testRef, { test: true, timestamp: new Date().toISOString(), platform: Platform.OS });
      Alert.alert('Firestore Test', 'Connection successful');
    } catch (error: any) {
      Alert.alert('Firestore Error', error.message);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <ThemedView style={styles.content}>
        <ThemedText type="title" style={styles.title}>CampusHub</ThemedText>
        <ThemedText style={styles.debugInfo}>{debugInfo}</ThemedText>
        <ThemedText style={styles.subtitle}>Bienvenido de nuevo</ThemedText>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          editable={!loading}
        />

        <TextInput
          style={styles.input}
          placeholder="Contraseña"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          editable={!loading}
        />

        <TouchableOpacity style={[styles.button, loading && styles.buttonDisabled]} onPress={handleLogin} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.buttonText}>Iniciar Sesión</ThemedText>}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <ThemedText style={styles.dividerText}>O continuar con</ThemedText>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.socialButton, (loading || !request) && styles.buttonDisabled]}
          onPress={() => promptAsync()}
          disabled={!request || loading}
        >
          {loading ? <ActivityIndicator color="#666" /> : <ThemedText style={styles.socialButtonText}>Continuar con Google</ThemedText>}
        </TouchableOpacity>

        {__DEV__ && (
          <View style={styles.debugButtons}>
            <TouchableOpacity onPress={testFirestore} style={styles.debugButton}>
              <ThemedText style={styles.debugButtonText}>Test Firestore</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                console.log('Request:', request);
                console.log('Response:', response);
                console.log('Auth State:', auth.currentUser);
              }}
              style={styles.debugButton}
            >
              <ThemedText style={styles.debugButtonText}>Debug Log</ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={() => router.push('/auth/register')} disabled={loading} style={styles.registerLink}>
          <ThemedText style={styles.link}>¿No tienes cuenta? Regístrate</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', padding: 20 },
  title: { textAlign: 'center', marginBottom: 10, fontSize: 32, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 40, fontSize: 16, opacity: 0.7 },
  input: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    fontSize: 16,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 25 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#ddd' },
  dividerText: { marginHorizontal: 10, fontSize: 14, opacity: 0.5 },
  socialButton: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  socialButtonText: { fontSize: 16, fontWeight: '600', color: '#333' },
  link: { textAlign: 'center', color: '#007AFF', fontSize: 15 },
  registerLink: { marginTop: 25 },
  debugInfo: { textAlign: 'center', fontSize: 11, color: '#666', marginBottom: 10, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  debugButtons: { flexDirection: 'row', justifyContent: 'center', marginTop: 15, gap: 10 },
  debugButton: { backgroundColor: '#666', padding: 8, borderRadius: 6 },
  debugButtonText: { color: '#fff', fontSize: 11, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});