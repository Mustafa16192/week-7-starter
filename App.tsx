import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth } from './src/firebase/auth';
import { db, missingConfig, useEmulators } from './src/firebase/config';
import { classroomService } from './src/firebase/service';
import type { Profile } from './src/model';
import { readableError } from './src/model';
import { AuthScreen, ProfileScreen } from './src/screens/AuthScreen';
import { RoomsScreen } from './src/screens/RoomsScreen';
import { RoomScreen } from './src/screens/RoomScreen';
import { Brand, Button, Heading, Loading, Notice, ui } from './src/components/ui';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileReady, setProfileReady] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const service = useMemo(() => db && user ? classroomService(db, user.uid) : null, [user]);
  useEffect(() => {
    if (!auth) { setChecking(false); return; }
    return onAuthStateChanged(auth, (next) => { setUser(next); setChecking(false); setRoomCode(null); setProfile(null); setProfileReady(false); setError(''); }, (err) => { setError(readableError(err)); setChecking(false); });
  }, []);
  useEffect(() => {
    if (!user || !db) return;
    return onSnapshot(doc(db, 'profiles', user.uid), (snapshot) => { setProfile(snapshot.exists() ? snapshot.data() as Profile : null); setProfileReady(true); }, (err) => { setError(readableError(err)); setProfileReady(true); });
  }, [user, retry]);
  async function leave() {
    try { if (auth) await signOut(auth); } catch (err) { setError(readableError(err)); }
  }
  let content;
  if (!db || !auth) content = <ScrollView contentContainerStyle={ui.scroll}><View style={[ui.shell, { maxWidth: 640, paddingTop: 80 }]}><Brand /><Heading>A little setup, then we’re live.</Heading><Text style={ui.body}>Add the Firebase web configuration to your local .env file, then restart Expo. Missing or placeholder values: {missingConfig.join(', ')}.</Text><Notice>The README lists the environment variables and Firebase setup steps.</Notice></View></ScrollView>;
  else if (checking || (user && !profileReady)) content = <Loading label="Opening your classroom…" />;
  else if (!user) content = <AuthScreen initialError={error} />;
  else if (error) content = <View style={[ui.shell, { maxWidth: 600 }]}><Brand /><Heading small>We couldn’t open your workspace.</Heading><Notice kind="error">{error}</Notice><Button title="Try again" onPress={() => { setError(''); setProfileReady(false); setRetry((n) => n + 1); }} /><Button title="Sign out" tone="quiet" onPress={leave} /></View>;
  else if (service && !profile) content = <ProfileScreen service={service} onSignOut={leave} />;
  else if (service && profile) content = roomCode ? <RoomScreen key={`${user.uid}:${roomCode}`} service={service} profile={profile} uid={user.uid} code={roomCode} onBack={() => setRoomCode(null)} /> : <RoomsScreen service={service} profile={profile} uid={user.uid} onOpen={setRoomCode} onSignOut={leave} />;
  return <SafeAreaProvider><SafeAreaView style={ui.page}><StatusBar style="dark" />{useEmulators && <View style={{ backgroundColor: '#E7EAF4', padding: 6 }}><Text style={{ textAlign: 'center', color: '#414C68', fontSize: 11 }}>LOCAL DEMO · Firebase emulators · data stays on this computer</Text></View>}{content}</SafeAreaView></SafeAreaProvider>;
}
