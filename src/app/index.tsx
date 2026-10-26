import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from 'firebase/auth';
import { onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth } from '../lib/auth';
import { configurationReady } from '../lib/firebase';
import { addTask, readableError, removeTask, setTaskCompleted, Task, tasksCollection } from '../lib/tasks';

const C = { background: '#F6F5F0', ink: '#192D30', muted: '#5F7172', teal: '#17665B', soft: '#E2EFE9', border: '#D9E0DC', white: '#FFFFFF', red: '#A32931' };

function Action({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [s.button, secondary && s.secondary, (disabled || pressed) && { opacity: 0.55 }]}>
    <Text style={[s.buttonText, secondary && { color: C.teal }]}>{title}</Text>
  </Pressable>;
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={s.error}>{message}</Text> : null;
}

function Brand() {
  return <View style={s.brand}><View style={s.mark}><Text style={s.markText}>✓</Text></View><Text style={s.brandText}>COMMON GROUND</Text><Text style={s.group}>DLM / 02</Text></View>;
}

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(Boolean(auth));
  const [error, setError] = useState('');
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (next) => { setUser(next); setChecking(false); }, (err) => { setError(readableError(err)); setChecking(false); });
  }, []);

  if (!configurationReady) return <SafeAreaView style={s.safe}><View style={s.center}><Brand /><Text style={s.heading}>One setup step left.</Text><Text style={s.body}>Add your Firebase web configuration to .env.local using .env.example, then restart Expo.</Text></View></SafeAreaView>;
  if (checking) return <SafeAreaView style={s.safe}><View style={s.center}><ActivityIndicator size="large" color={C.teal} /><Text style={s.body}>Opening your workspace…</Text></View></SafeAreaView>;
  return user ? <Board key={user.uid} user={user} /> : <AuthScreen initialError={error} />;
}

function AuthScreen({ initialError }: { initialError: string }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  async function submit() {
    if (busy || !auth) return;
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    if (register && password.length < 6) { setError('Use a password with at least 6 characters.'); return; }
    setError(''); setBusy(true);
    try {
      if (register) await createUserWithEmailAndPassword(auth, email.trim(), password);
      else await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) { setError(readableError(err)); }
    finally { setBusy(false); }
  }
  return <SafeAreaView style={s.safe}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.authContent} keyboardShouldPersistTaps="handled">
        <Brand />
        <View style={s.hero}>
          <Text style={s.eyebrow}>A LITTLE TEAMWORK GOES A LONG WAY</Text>
          <Text style={s.heroTitle}>Small tasks.{ '\n' }Shared progress.</Text>
          <Text style={s.body}>One place for your team’s next steps.{ '\n' }Make a plan. Move it forward, together.</Text>
          <View style={s.preview}><View style={s.demoCheck}><Text style={{ color: C.teal }}>✓</Text></View><Text style={s.previewText}>Get everyone on the same page</Text><View style={s.dot} /></View>
        </View>
        <View style={s.card}>
          <Text style={s.cardTitle}>{register ? 'Join the board' : 'Welcome back'}</Text>
          <Text style={s.body}>{register ? 'Create an account to start collaborating.' : 'Sign in to your shared workspace.'}</Text>
          <Text style={s.label}>Email address</Text>
          <TextInput accessibilityLabel="Email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" placeholder="you@example.com" placeholderTextColor={C.muted} value={email} onChangeText={setEmail} style={s.input} editable={!busy} />
          <Text style={s.label}>Password</Text>
          <TextInput accessibilityLabel="Password" secureTextEntry autoCapitalize="none" autoComplete={register ? 'new-password' : 'current-password'} placeholder={register ? 'At least 6 characters' : 'Your password'} placeholderTextColor={C.muted} value={password} onChangeText={setPassword} onSubmitEditing={submit} style={s.input} editable={!busy} />
          <ErrorMessage message={error} />
          <Action title={busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'} onPress={submit} disabled={busy} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setRegister(!register); setError(''); }} style={s.textButton}><Text style={s.link}>{register ? 'Already have an account? Sign in' : 'New here? Create an account'}</Text></Pressable>
        </View>
        <Text style={s.footnote}>GROUP 2 · JESSICA / QIER / MUSTAFA</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function Board({ user }: { user: User }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [cached, setCached] = useState(true);
  const [readError, setReadError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [retry, setRetry] = useState(0);
  const [title, setTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [filter, setFilter] = useState<'All' | 'Open' | 'Done'>('All');
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    return onSnapshot(query(tasksCollection(), orderBy('createdAt', 'desc')), { includeMetadataChanges: true }, (snapshot) => {
      setTasks(snapshot.docs.map((item) => ({ ...item.data(), id: item.id, pending: item.metadata.hasPendingWrites } as Task)));
      setCached(snapshot.metadata.fromCache); setLoading(false);
    }, (err) => { setReadError(readableError(err)); setLoading(false); });
  }, [retry]);

  async function create() {
    if (adding || !title.trim()) return;
    setAdding(true); setWriteError('');
    try { await addTask(title, user.uid); setTitle(''); }
    catch (err) { setWriteError(readableError(err)); }
    finally { setAdding(false); }
  }
  async function change(task: Task, remove = false) {
    if (busyIds.has(task.id) || task.pending) return;
    setBusyIds((ids) => new Set(ids).add(task.id)); setWriteError('');
    try {
      if (remove) { await removeTask(task.id); setConfirmDelete(null); }
      else await setTaskCompleted(task.id, !task.completed);
    } catch (err) { setWriteError(readableError(err)); }
    finally { setBusyIds((ids) => { const next = new Set(ids); next.delete(task.id); return next; }); }
  }
  async function leave() {
    if (!auth) return;
    setLeaving(true);
    try { await signOut(auth); } catch (err) { setWriteError(readableError(err)); setLeaving(false); }
  }
  const complete = tasks.filter((task) => task.completed).length;
  const visible = tasks.filter((task) => filter === 'All' || (filter === 'Done' ? task.completed : !task.completed));
  const pending = adding || tasks.some((task) => task.pending) || busyIds.size > 0;

  return <SafeAreaView style={s.safe}>
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.boardContent} keyboardShouldPersistTaps="handled">
        <Brand />
        <View style={s.account}><Text numberOfLines={1} style={s.accountEmail}>{user.email}</Text><Pressable accessibilityRole="button" disabled={pending || leaving} onPress={leave} style={[s.signOut, (pending || leaving) && { opacity: 0.4 }]}><Text style={s.link}>{leaving ? 'Leaving…' : 'Sign out'}</Text></Pressable></View>
        <Text style={s.eyebrow}>YOUR TEAM WORKSPACE</Text>
        <Text style={s.heading}>Let’s make progress.</Text>
        <View style={s.liveRow}><View style={[s.dot, (cached || readError) && { backgroundColor: C.muted }]} /><Text style={s.small}>{readError ? 'Connection needs attention' : pending ? 'Saving changes…' : cached ? 'Connecting · showing cached tasks' : 'Live · everyone stays in sync'}</Text></View>
        <View style={s.summary}><View><Text style={s.summaryNumber}>{tasks.length - complete}</Text><Text style={s.small}>TO DO</Text></View><View style={s.divider} /><View><Text style={s.summaryNumber}>{complete}</Text><Text style={s.small}>COMPLETED</Text></View><View style={s.summaryCircle}><Text style={s.summaryIcon}>↗</Text></View></View>
        <View style={s.card}>
          <Text style={s.cardTitle}>What’s next?</Text>
          <Text style={s.body}>Add one clear, actionable step for the team.</Text>
          <TextInput accessibilityLabel="New task" placeholder="e.g. Review our prototype together" placeholderTextColor={C.muted} maxLength={140} value={title} onChangeText={setTitle} editable={!adding} onSubmitEditing={create} returnKeyType="done" style={[s.input, { marginTop: 16 }]} />
          <Action title={adding ? 'Saving task…' : '+  Add task'} disabled={!title.trim() || adding || Boolean(readError)} onPress={create} />
          <ErrorMessage message={writeError} />
        </View>
        <View style={s.listHeader}><Text style={s.cardTitle}>The board</Text><View style={s.filters}>{(['All', 'Open', 'Done'] as const).map((item) => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => setFilter(item)} style={[s.filter, filter === item && s.filterSelected]}><Text style={[s.filterText, filter === item && { color: C.white }]}>{item}</Text></Pressable>)}</View></View>
        <ErrorMessage message={readError} />
        {readError ? <Action title="Try reconnecting" secondary onPress={() => { setLoading(true); setReadError(''); setRetry((value) => value + 1); }} /> : loading ? <ActivityIndicator accessibilityLabel="Loading tasks" color={C.teal} style={s.empty} /> : visible.length === 0 ? <View style={s.empty}><Text style={s.emptyIcon}>☷</Text><Text style={s.cardTitle}>{filter === 'Done' ? 'Your wins will go here.' : filter === 'Open' && tasks.length ? 'Everything is checked off.' : 'A fresh start.'}</Text><Text style={s.body}>{filter === 'All' ? 'Add your first task above. Your team will see it here.' : 'Try another view or add a new task.'}</Text></View> : visible.map((task) => {
          const busy = busyIds.has(task.id) || task.pending;
          return <View key={task.id} style={s.task}>
            <View style={s.taskLine}>
              <Pressable accessibilityRole="checkbox" accessibilityLabel={task.title} accessibilityState={{ checked: task.completed, disabled: busy }} disabled={busy} onPress={() => change(task)} style={[s.check, task.completed && s.checked]}><Text style={s.checkText}>{task.completed ? '✓' : ''}</Text></Pressable>
              <View style={s.taskCopy}><Text style={[s.taskTitle, task.completed && s.completed]}>{task.title}</Text><Text style={s.small}>{task.createdBy === user.uid ? 'Added by you' : 'Added by a teammate'}{task.pending ? ' · Saving…' : ''}</Text></View>
              {task.createdBy === user.uid && <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${task.title}`} disabled={busy} onPress={() => setConfirmDelete(task.id)} style={s.deleteButton}><Text style={s.deleteText}>×</Text></Pressable>}
            </View>
            {confirmDelete === task.id && <View style={s.deleteConfirm}><Text style={s.small}>Delete this task for everyone?</Text><Action title={busy ? 'Deleting…' : 'Delete task'} onPress={() => change(task, true)} disabled={busy} /><Action title="Keep task" secondary onPress={() => setConfirmDelete(null)} disabled={busy} /></View>}
          </View>;
        })}
        <Text style={s.footnote}>SMALL STEPS. BETTER TOGETHER.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: C.background },
  authContent: { padding: 24, paddingBottom: 36, maxWidth: 560, alignSelf: 'center', width: '100%', flexGrow: 1 },
  boardContent: { padding: 24, paddingBottom: 36, maxWidth: 760, alignSelf: 'center', width: '100%' },
  center: { flex: 1, justifyContent: 'center', padding: 28, gap: 20, maxWidth: 560, alignSelf: 'center' },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 18, flexWrap: 'wrap' },
  mark: { width: 30, height: 30, borderRadius: 9, backgroundColor: C.teal, alignItems: 'center', justifyContent: 'center' }, markText: { color: C.white, fontSize: 20, fontWeight: '700' },
  brandText: { fontSize: 12, letterSpacing: 1.4, fontWeight: '800', color: C.ink }, group: { marginLeft: 'auto', fontSize: 10, fontWeight: '700', color: C.muted },
  hero: { paddingVertical: 26 }, eyebrow: { color: C.teal, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 14 },
  heroTitle: { fontSize: 40, lineHeight: 45, fontWeight: '800', letterSpacing: -1.5, color: C.ink, marginBottom: 16 },
  heading: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1, color: C.ink },
  body: { fontSize: 14, lineHeight: 22, color: C.muted, marginTop: 6 },
  preview: { backgroundColor: C.soft, padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 22 },
  previewText: { fontSize: 12, color: C.teal, flex: 1 }, demoCheck: { backgroundColor: '#FFFFFFA0', borderRadius: 6, height: 25, width: 25, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.teal },
  card: { padding: 22, backgroundColor: C.white, borderRadius: 20, borderWidth: 1, borderColor: C.border }, cardTitle: { fontSize: 20, fontWeight: '700', color: C.ink },
  label: { fontSize: 12, color: C.ink, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  input: { backgroundColor: '#FBFCFA', borderColor: C.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, color: C.ink, fontSize: 16, minHeight: 50 },
  button: { minHeight: 48, backgroundColor: C.teal, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 12, marginTop: 14 },
  secondary: { backgroundColor: C.soft }, buttonText: { color: C.white, fontSize: 14, fontWeight: '700' },
  textButton: { minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: 8 }, link: { color: C.teal, fontSize: 12, fontWeight: '700' },
  error: { color: C.red, backgroundColor: '#FFF1F0', borderRadius: 8, padding: 12, marginTop: 12, fontSize: 13, lineHeight: 19 },
  footnote: { color: C.muted, fontSize: 10, letterSpacing: 1.2, textAlign: 'center', marginTop: 28 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 24 }, accountEmail: { color: C.muted, fontSize: 12, flex: 1 }, signOut: { paddingVertical: 12, paddingLeft: 10 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12, marginBottom: 24 }, small: { color: C.muted, fontSize: 11, lineHeight: 18 },
  summary: { borderRadius: 20, backgroundColor: C.soft, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 22, marginBottom: 20 }, summaryNumber: { fontSize: 32, color: C.teal, fontWeight: '700' }, divider: { width: 1, height: 38, backgroundColor: '#B7CFC3' }, summaryCircle: { marginLeft: 'auto', width: 50, height: 50, borderRadius: 25, backgroundColor: '#CCDFD4', alignItems: 'center', justifyContent: 'center' }, summaryIcon: { fontSize: 30, color: C.teal },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 30, marginBottom: 16, flexWrap: 'wrap', gap: 12 }, filters: { flexDirection: 'row', gap: 5 }, filter: { paddingHorizontal: 12, minHeight: 44, justifyContent: 'center', borderRadius: 22 }, filterSelected: { backgroundColor: C.ink }, filterText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  empty: { padding: 28, alignItems: 'center', gap: 8 }, emptyIcon: { fontSize: 40, color: C.teal, marginBottom: 8 },
  task: { backgroundColor: C.white, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 12, marginBottom: 10 }, taskLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#81988D', alignItems: 'center', justifyContent: 'center' }, checked: { backgroundColor: C.teal, borderColor: C.teal }, checkText: { color: C.white, fontSize: 21, fontWeight: '700' },
  taskCopy: { flex: 1, gap: 4 }, taskTitle: { color: C.ink, fontWeight: '600', fontSize: 14, lineHeight: 21 }, completed: { textDecorationLine: 'line-through', color: C.muted }, deleteButton: { minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }, deleteText: { fontSize: 26, color: C.muted }, deleteConfirm: { paddingTop: 12 },
});
