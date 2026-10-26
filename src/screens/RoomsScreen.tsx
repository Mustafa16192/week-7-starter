import React, { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { ClassroomService } from '../firebase/service';
import type { Profile, Room } from '../model';
import { readableError } from '../model';
import { Badge, Brand, Button, color, Empty, Field, Heading, Loading, Notice, ui } from '../components/ui';

export function RoomsScreen({ service, profile, uid, onOpen, onSignOut }: { service: ClassroomService; profile: Profile; uid: string; onOpen: (id: string) => void; onSignOut: () => void }) {
  const { width } = useWindowDimensions();
  const [rooms, setRooms] = useState<Room[]>([]); const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState(''); const [retry, setRetry] = useState(0);
  const [mode, setMode] = useState<'join'|'create'>('join');
  const [code, setCode] = useState(''); const [title, setTitle] = useState(''); const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const lock = useRef(false);
  useEffect(() => {
    return service.subscribeRooms((next) => { setRooms(next); setLoading(false); }, (err) => { setReadError(readableError(err)); setLoading(false); });
  }, [service, retry]);
  async function submit() {
    if (lock.current) return; lock.current = true; setBusy(true); setError('');
    try { const id = mode === 'join' ? await service.joinRoom(code) : await service.createRoom(title, description, profile); onOpen(id); }
    catch (err) { setError(readableError(err)); }
    finally { lock.current = false; setBusy(false); }
  }
  return <ScrollView contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled"><View style={ui.shell}>
    <View style={ui.spread}><Brand /><View style={[ui.row, ui.wrap]}><Text style={ui.caption}>{profile.displayName}</Text><Button compact title="Sign out" tone="quiet" onPress={onSignOut} disabled={busy} /></View></View>
    <View style={s.hero}><Text style={ui.eyebrow}>YOUR LEARNING SPACE</Text><Heading>Good questions bring{ '\n' }people together.</Heading><Text style={ui.body}>Join your class, share what’s on your mind, and keep the conversation going.</Text></View>
    <View style={{ flexDirection: width >= 900 ? 'row-reverse' : 'column', gap: 28, alignItems: 'flex-start' }}>
      <View style={[ui.card, width >= 900 ? { width: 360 } : { width: '100%' }]}>
        <View style={[ui.row, { backgroundColor: color.background, padding: 4, borderRadius: 12 }]}><Button compact title="Join a room" selected={mode === 'join'} tone={mode === 'join' ? 'primary' : 'quiet'} onPress={() => { setMode('join'); setError(''); }} disabled={busy} style={{ flex: 1 }} /><Button compact title="Create a room" selected={mode === 'create'} tone={mode === 'create' ? 'primary' : 'quiet'} onPress={() => { setMode('create'); setError(''); }} disabled={busy} style={{ flex: 1 }} /></View>
        <Heading small>{mode === 'join' ? 'Have a room code?' : 'Bring your class together.'}</Heading>
        <Text style={ui.body}>{mode === 'join' ? 'Enter the six-character code shared by your lecturer.' : 'You’ll be the lecturer in this room. Share its code to invite your students.'}</Text>
        {mode === 'join' ? <Field label="Room code" value={code} onChangeText={(v) => setCode(v.toUpperCase())} maxLength={6} autoCapitalize="characters" autoCorrect={false} placeholder="ABC123" onSubmitEditing={submit} editable={!busy} style={{ fontSize: 24, letterSpacing: 5, fontWeight: '700' }} /> : <><Field label="Room title" value={title} onChangeText={setTitle} maxLength={100} placeholder="e.g. SI 669 · Firebase questions" editable={!busy} /><Field label="Course or assignment context (optional)" value={description} onChangeText={setDescription} maxLength={500} multiline placeholder="What are we exploring together?" editable={!busy} /></>}
        <Notice kind="error">{error}</Notice><Button title={busy ? 'Opening room…' : mode === 'join' ? 'Join the conversation →' : 'Create room →'} onPress={submit} disabled={busy} />
      </View>
      <View style={{ flex: 1, width: '100%', gap: 18 }}><View style={ui.spread}><Heading small>Your rooms</Heading><Text style={ui.caption}>{rooms.length} {rooms.length === 1 ? 'room' : 'rooms'}</Text></View>
        {readError ? <><Notice kind="error">{readError}</Notice><Button title="Try loading rooms again" tone="secondary" onPress={() => { setLoading(true); setReadError(''); setRetry((n) => n + 1); }} /></> : loading ? <Loading label="Finding your rooms…" /> : rooms.length === 0 ? <View style={ui.card}><Empty title="Your conversations start here." copy="Join a room with your lecturer’s code, or create your own room for a class or assignment." /></View> : rooms.map((room) => <View key={room.id} style={ui.card}><View style={ui.spread}><Badge text={room.lecturerId === uid ? 'YOU ARE THE LECTURER' : 'CLASSROOM'} /><Badge text={room.status === 'open' ? 'Open for questions' : 'Read-only'} green={room.status === 'open'} /></View><Heading small>{room.title}</Heading>{!!room.description && <Text numberOfLines={2} style={ui.body}>{room.description}</Text>}<View style={ui.spread}><Text style={ui.caption}>Room {room.id} · {room.lecturerName}</Text><Button compact title="Open room →" label={`Open room ${room.title}`} tone="secondary" onPress={() => onOpen(room.id)} /></View></View>)}
      </View>
    </View>
  </View></ScrollView>;
}
const s = StyleSheet.create({ hero: { paddingTop: 24, paddingBottom: 10, gap: 16 } });
