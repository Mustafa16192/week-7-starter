import React, { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { Form } from '../components/Form';
import { auth } from '../firebase/auth';
import type { ClassroomService } from '../firebase/service';
import { readableError } from '../model';
import { Badge, Brand, Button, color, Field, Heading, Notice, ui } from '../components/ui';

export function AuthScreen({ initialError }: { initialError: string }) {
  const { width } = useWindowDimensions(); const wide = width >= 900;
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false); const lock = useRef(false);
  const [error, setError] = useState(initialError);
  async function submit() {
    if (!auth || lock.current) return;
    if (!email.trim() || !password) { setError('Enter your email address and password.'); return; }
    if (register && password.length < 6) { setError('Use a password with at least 6 characters.'); return; }
    lock.current = true; setBusy(true); setError('');
    try { if (register) await createUserWithEmailAndPassword(auth, email.trim(), password); else await signInWithEmailAndPassword(auth, email.trim(), password); }
    catch (err) { setError(readableError(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled"><View style={ui.shell}>
    <View style={ui.spread}><Brand /><Badge text="MADE FOR CURIOUS MINDS" /></View>
    <View style={[s.layout, wide && { flexDirection: 'row', alignItems: 'center', paddingVertical: 60 }]}>
      <View style={[s.hero, wide && { flex: 1 }]}>
        <Text style={ui.eyebrow}>LESS HESITATION. MORE CONVERSATION.</Text>
        <Text accessibilityRole="header" style={[s.title, !wide && { fontSize: 40, lineHeight: 46 }]}>Every question{ '\n' }belongs here<Text style={{ color: color.purple }}>.</Text></Text>
        <Text style={[ui.body, { maxWidth: 430, fontSize: 16, lineHeight: 27 }]}>A shared space to ask, understand, and learn together. In the lecture hall or halfway through an assignment.</Text>
        <View style={s.preview} accessible accessibilityLabel="Illustration of a classroom question">
          <View style={ui.spread}><Badge text="A GOOD QUESTION STARTS SOMETHING" /><Text style={{ color: color.purple, fontSize: 22 }}>↗</Text></View>
          <Text style={s.sample}>Could we walk through{ '\n' }one more example?</Text>
          <View style={ui.spread}><Text style={ui.caption}>Someone else was wondering, too.</Text><Text style={{ color: color.purple, fontWeight: '700' }}>↑ 12</Text></View>
        </View>
        <View style={[ui.row, ui.wrap, { gap: 20 }]}><Text style={ui.caption}>✓ Ask with confidence</Text><Text style={ui.caption}>✓ Learn in real time</Text></View>
      </View>
      <View style={[ui.card, s.form, wide ? { width: 400 } : { width: '100%' }]}>
        <Badge text={register ? 'JOIN THE CONVERSATION' : 'YOUR NEXT QUESTION STARTS HERE'} />
        <Heading>{register ? 'Make yourself at home.' : 'Welcome back.'}</Heading>
        <Text style={ui.body}>{register ? 'Create an account to join a room or host your own.' : 'Sign in to pick up the conversation.'}</Text>
        <Form label={register ? "Create account" : "Sign in"} onSubmit={submit}><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoComplete="email" autoCapitalize="none" autoCorrect={false} placeholder="you@university.edu" editable={!busy} />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete={register ? 'new-password' : 'current-password'} autoCapitalize="none" placeholder={register ? 'At least 6 characters' : 'Your password'} editable={!busy} onSubmitEditing={submit} />
        <Notice kind="error">{error}</Notice>
        <Button title={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} onPress={submit} disabled={busy} />
        <Button title={register ? 'Already have an account? Sign in' : 'New here? Create an account'} tone="quiet" onPress={() => { setRegister(!register); setError(''); }} disabled={busy} />
        </Form><Text style={[ui.caption, { textAlign: 'center' }]}>Your email is used for sign-in. Questions can be posted anonymously.</Text>
      </View>
    </View>
    <Text style={s.footer}>DLM · SI 669 · BUILT FOR LEARNING TOGETHER</Text>
  </View></ScrollView></KeyboardAvoidingView>;
}
export function ProfileScreen({ service, onSignOut }: { service: ClassroomService; onSignOut: () => void }) {
  const [name, setName] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const lock = useRef(false);
  async function save() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { await service.createProfile(name); } catch (err) { setError(readableError(err)); } finally { lock.current = false; setBusy(false); }
  }
  return <ScrollView keyboardShouldPersistTaps="handled"><View style={[ui.shell, { maxWidth: 560, paddingTop: 60 }]}><Brand /><View style={ui.card}><Badge text="ONE LAST INTRODUCTION" /><Heading>What should we call you?</Heading><Text style={ui.body}>This name appears on your replies and named questions. You can choose to ask questions anonymously.</Text><Field label="Display name" value={name} onChangeText={setName} maxLength={50} placeholder="Your name" editable={!busy} onSubmitEditing={save} /><Notice kind="error">{error}</Notice><Button title={busy ? 'Saving…' : 'Enter the classroom'} onPress={save} disabled={busy} /><Button title="Sign out" tone="quiet" onPress={onSignOut} disabled={busy} /></View></View></ScrollView>;
}
const s = StyleSheet.create({ layout: { gap: 48, paddingTop: 30 }, hero: { gap: 24 }, title: { fontSize: 58, lineHeight: 65, letterSpacing: -2.6, fontWeight: '800', color: color.ink }, preview: { padding: 24, gap: 22, borderRadius: 20, borderWidth: 1, borderColor: '#D5D1EF', backgroundColor: '#F0EFFA', maxWidth: 480 }, sample: { fontSize: 23, lineHeight: 32, fontWeight: '600', color: color.ink, letterSpacing: -0.4 }, form: { padding: 30, gap: 20 }, footer: { color: color.muted, fontSize: 10, letterSpacing: 1.5, textAlign: 'center', marginTop: 24 } });
