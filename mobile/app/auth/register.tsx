import React, { useState } from 'react';
import {
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ScrollView,
  View,
  ActivityIndicator,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTranslation } from '@/hooks/useTranslation';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!email || !password || !confirmPassword || !name) {
      Alert.alert(t('common.error') || 'Error', t('roles.errors.all_fields') || 'Por favor completa todos los campos');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('common.error') || 'Error', t('roles.errors.passwords_dont_match') || 'Las contraseñas no coinciden');
      return;
    }

    if (password.length < 6) {
      Alert.alert(t('common.error') || 'Error', t('roles.errors.password_too_short') || 'La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, {
        displayName: name,
      });

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: name,
        photoURL: null,
        role: 'student',
        department: null,
        createdAt: serverTimestamp(),
        lastActive: serverTimestamp(),
        fcmToken: null,
      });

      Alert.alert(t('common.success') || '¡Éxito!', t('roles.success.account_created') || 'Cuenta creada correctamente');
      router.replace('/(tabs)');
    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        Alert.alert(t('common.error') || 'Error', t('roles.errors.email_exists') || 'Este email ya está registrado');
      } else {
        Alert.alert(t('common.error') || 'Error', t('roles.errors.create_failed') || 'No se pudo crear la cuenta');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.wrapper}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.flex}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{t('common.signup') || 'Crear Cuenta'}</Text>
              <ThemedText style={styles.sub}>{t('auth.signup_sub') || 'Únete a CampusHub'}</ThemedText>
            </View>

            <View style={styles.form}>
              <View style={styles.inputBox}>
                <Ionicons name="person-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('common.name') || "Nombre completo"}
                  placeholderTextColor="#666"
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputBox}>
                <Ionicons name="mail-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('auth.email') || "Correo electrónico"}
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
                  placeholder={t('auth.password') || "Contraseña"}
                  placeholderTextColor="#666"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>

              <View style={styles.inputBox}>
                <Ionicons name="shield-checkmark-outline" size={20} color="#666" style={styles.icon} />
                <TextInput
                  style={styles.textInput}
                  placeholder={t('auth.confirm_password') || "Confirmar contraseña"}
                  placeholderTextColor="#666"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                />
              </View>

              <TouchableOpacity
                style={[styles.btn, loading && styles.btnDim]}
                onPress={handleRegister}
                disabled={loading}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <ThemedText style={styles.btnText}>Registrarse</ThemedText>}
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <TouchableOpacity onPress={() => router.back()}>
                <ThemedText style={styles.footTxt}>
                  {t('auth.already_have_account') || '¿Ya tienes cuenta?'} <ThemedText style={styles.footLink}>{t('common.login') || 'Inicia sesión'}</ThemedText>
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
    fontSize: 44,
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
  footer: { marginTop: 40, alignItems: 'center', paddingBottom: 20 },
  footTxt: { color: '#777', fontSize: 15 },
  footLink: { color: '#007AFF', fontWeight: '800' }
});