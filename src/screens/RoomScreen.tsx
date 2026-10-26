import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions } from 'react-native';
import type { ClassroomService } from '../firebase/service';
import { useRoomFeed } from '../hooks/useRoomFeed';
import type { Profile, Question, QuestionActivity, Room } from '../model';
import { readableError, sortQuestions, timeLabel } from '../model';
import { Badge, Brand, Button, color, Empty, Field, Heading, Loading, Notice, ui } from '../components/ui';

export function RoomScreen({ service, profile, uid, code, onBack }: { service: ClassroomService; profile: Profile; uid: string; code: string; onBack: () => void }) {
  const wide = useWindowDimensions().width >= 980;
  const scrollRef = useRef<React.ElementRef<typeof ScrollView>>(null);
  function openQuestion(id: string | null) {
    setSelected(id);
    if (!wide) requestAnimationFrame(() => scrollRef.current?.scrollTo({ y: 0, animated: false }));
  }
  const [room, setRoom] = useState<Room | null>(null); const [roomReady, setRoomReady] = useState(false); const [roomError, setRoomError] = useState('');
  const [retry, setRetry] = useState(0); const feed = useRoomFeed(service, code, retry);
  const [text, setText] = useState(''); const [anonymous, setAnonymous] = useState(false); const [asking, setAsking] = useState(false); const askLock = useRef(false);
  const [writeError, setWriteError] = useState(''); const [success, setSuccess] = useState('');
  const [sort, setSort] = useState<'newest'|'popular'>('newest'); const [filter, setFilter] = useState<'all'|'unanswered'|'answered'>('all');
  const [selected, setSelected] = useState<string | null>(null); const [busyIds, setBusyIds] = useState<Set<string>>(new Set()); const busyLock = useRef(new Set<string>());
  const [confirmClose, setConfirmClose] = useState(false); const [changingStatus, setChangingStatus] = useState(false); const statusLock = useRef(false);
  useEffect(() => {
    return service.subscribeRoom(code, (next) => { setRoom(next); setRoomReady(true); }, (err) => { setRoomError(readableError(err)); setRoomReady(true); });
  }, [service, code, retry]);
  const closed = room?.status !== 'open'; const lecturer = room?.lecturerId === uid;
  const question = feed.questions.find((q) => q.id === selected);
  async function ask() {
    if (askLock.current) return; askLock.current = true; setAsking(true); setWriteError(''); setSuccess('');
    try { const id = await service.askQuestion(code, text, anonymous, profile); setText(''); setSuccess('Your question is posted.'); openQuestion(id); setFilter('all'); }
    catch (err) { setWriteError(readableError(err)); }
    finally { askLock.current = false; setAsking(false); }
  }
  async function questionAction(q: Question, action: 'vote'|'answer') {
    if (busyLock.current.has(q.id)) return; busyLock.current.add(q.id); setBusyIds(new Set(busyLock.current)); setWriteError(''); setSuccess('');
    try { if (action === 'vote') await service.toggleVote(code, q.id); else await service.markAnswered(code, q.id, !q.answered); }
    catch (err) { setWriteError(readableError(err)); }
    finally { busyLock.current.delete(q.id); setBusyIds(new Set(busyLock.current)); }
  }
  async function changeStatus() {
    if (statusLock.current) return; statusLock.current = true; setChangingStatus(true); setWriteError('');
    try { await service.setRoomStatus(code, closed ? 'open' : 'closed'); setConfirmClose(false); setSuccess(closed ? 'The room is open again.' : 'The room is now read-only.'); }
    catch (err) { setWriteError(readableError(err)); }
    finally { statusLock.current = false; setChangingStatus(false); }
  }
  const ordered = sortQuestions(feed.questions, sort, feed.activity).filter((q) => filter === 'all' || (filter === 'answered' ? q.answered : !q.answered));
  const answered = feed.questions.filter((q) => q.answered).length;
  const activityError = Object.values(feed.activity).some((a) => a.error);
  const actionsPending = asking || busyIds.size > 0 || changingStatus;
  if (!roomReady) return <Loading label="Opening the room…" />;
  if (!room || roomError) return <View style={ui.shell}><Button title="← Your rooms" tone="quiet" onPress={onBack} /><Notice kind="error">{roomError || 'This room is not available.'}</Notice><Button title="Try again" onPress={() => { setRoomError(''); setRoomReady(false); setRetry((n) => n + 1); }} /></View>;
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView ref={scrollRef} contentContainerStyle={ui.scroll} keyboardShouldPersistTaps="handled"><View style={ui.shell}>
    <View style={ui.spread}><Brand /><Button title="← Your rooms" tone="quiet" onPress={onBack} disabled={actionsPending} /></View>
    {(wide || !selected) ? <View style={[s.roomHeader, !wide && { padding: 22 }]}>
      <View style={[ui.spread, { alignItems: 'flex-start' }]}><View style={{ flex: 1, minWidth: 180, gap: 12 }}><View style={[ui.row, ui.wrap]}><Badge text={lecturer ? 'YOUR CLASSROOM' : 'CLASSROOM'} /><Badge text={closed ? 'Read-only' : 'Open for questions'} green={!closed} /></View><Heading>{room.title}</Heading>{!!room.description && <Text style={ui.body}>{room.description}</Text>}<Text style={ui.caption}>Hosted by {room.lecturerName}{lecturer ? ' · You are the lecturer' : ''}</Text></View>
        <View style={s.codeCard}><Text style={ui.eyebrow}>ROOM CODE</Text><Text selectable style={s.code}>{room.id}</Text><Text style={ui.caption}>Share with your class</Text></View></View>
      <View style={ui.spread}><View style={[ui.row, ui.wrap, { gap: 20 }]}><Text style={ui.caption}>{feed.questions.length} questions</Text><Text style={ui.caption}>{answered} answered</Text><Text accessibilityLiveRegion="polite" style={[ui.caption, { color: feed.cached ? color.muted : color.green }]}>{feed.cached ? 'Connecting…' : '● Live updates'}</Text></View>{lecturer && <Button compact title={changingStatus ? 'Updating…' : closed ? 'Reopen room' : 'Close room'} tone="secondary" onPress={() => closed ? changeStatus() : setConfirmClose(true)} disabled={actionsPending} />}</View>
      {confirmClose && <View style={{ gap: 12 }}><Notice>Close this room? Existing members can still read everything. New questions, replies, and votes will be paused until you reopen it.</Notice><View style={ui.row}><Button title="Close room now" tone="danger" onPress={changeStatus} disabled={actionsPending} /><Button title="Keep room open" tone="quiet" onPress={() => setConfirmClose(false)} disabled={actionsPending} /></View></View>}
    </View> : <View style={ui.spread}><Text style={ui.caption}>{room.title}</Text><Badge text={`ROOM ${room.id}`} /></View>}
    {closed && <Notice>This room is read-only. You can revisit the conversation; the lecturer can reopen it.</Notice>}
    <Notice kind="error">{writeError}</Notice><Notice kind="success">{success}</Notice>
    {(feed.error || activityError) && <View style={{ gap: 10 }}><Notice kind="error">{feed.error || 'Some replies or votes could not be loaded. Counts may be unavailable.'}</Notice><Button title="Reconnect to the conversation" tone="secondary" onPress={() => { setRoomError(''); setRoomReady(false); setRetry((n) => n + 1); }} /></View>}
    <View style={{ flexDirection: wide ? 'row' : 'column', gap: 24, alignItems: 'flex-start' }}>
      {(wide || !selected) && <View style={{ flex: wide ? 1.25 : undefined, width: wide ? undefined : '100%', gap: 22 }}>
        {!closed && <View style={ui.card}><View style={ui.spread}><Heading small>What’s on your mind?</Heading><Text style={ui.caption}>Every question is welcome.</Text></View><Field label="Your question" value={text} onChangeText={setText} multiline maxLength={1000} placeholder="Ask about today’s lecture or the assignment…" editable={!asking} />
          <View style={ui.spread}><View style={[ui.row, { flexShrink: 1 }]}><Switch value={anonymous} onValueChange={setAnonymous} disabled={asking} accessibilityLabel="Post question anonymously" trackColor={{ false: '#BAC1D2', true: color.purple }} /><Text style={ui.caption}>Ask anonymously</Text></View><Text style={ui.caption}>{text.length}/1000</Text></View>
          {anonymous && <Text style={ui.caption}>Your name is hidden from students and the lecturer. Firebase project administrators can access stored records. Replies always show your name.</Text>}
          <View style={ui.spread}><Text style={ui.caption}>{anonymous ? 'Posting as Anonymous' : `Posting as ${profile.displayName}`}</Text><Button title={asking ? 'Posting question…' : 'Post question →'} onPress={ask} disabled={asking || !!feed.error} /></View>
        </View>}
        <View style={{ gap: 12 }}><View style={ui.spread}><Heading small>The conversation</Heading><View style={ui.row}><Button compact title="Newest" selected={sort === 'newest'} tone={sort === 'newest' ? 'secondary' : 'quiet'} onPress={() => setSort('newest')} /><Button compact title="Most upvoted" selected={sort === 'popular'} tone={sort === 'popular' ? 'secondary' : 'quiet'} onPress={() => setSort('popular')} /></View></View><View style={[ui.row, ui.wrap]}>{(['all','unanswered','answered'] as const).map((value) => <Button key={value} compact title={value[0].toUpperCase() + value.slice(1)} selected={filter === value} tone={filter === value ? 'primary' : 'quiet'} onPress={() => setFilter(value)} />)}</View></View>
        {feed.loading ? <Loading label="Listening for questions…" /> : ordered.length === 0 ? <View style={ui.card}><Empty title={feed.questions.length ? 'Nothing in this view yet.' : 'Someone has to ask first.'} copy={feed.questions.length ? 'Try another filter to see the rest of the conversation.' : closed ? 'No questions were posted in this room.' : 'Share a question above. It might be exactly what someone else was wondering.'} /></View> : ordered.map((q) => <QuestionCard key={q.id} question={q} activity={feed.activity[q.id]} mine={feed.authored.has(q.id)} voted={!!feed.activity[q.id]?.voters.includes(uid)} selected={q.id === selected} closed={closed} busy={busyIds.has(q.id)} onOpen={() => openQuestion(q.id)} onVote={() => questionAction(q, 'vote')} />)}
      </View>}
      {(wide || selected) && <View style={{ flex: wide ? 1 : undefined, width: wide ? undefined : '100%' }}>
        {question ? <Thread key={question.id} question={question} activity={feed.activity[question.id]} room={room} service={service} profile={profile} lecturer={lecturer} mine={feed.authored.has(question.id)} busy={busyIds.has(question.id)} onAnswered={() => questionAction(question, 'answer')} onBack={() => openQuestion(null)} /> : <View style={[ui.card, { minHeight: 320 }]}><Empty title="Make room for a conversation." copy="Select a question to read responses, share an idea, or help someone connect the dots." /></View>}
      </View>}
    </View>
    <Text style={[ui.caption, { textAlign: 'center' }]}>Ask thoughtfully. Respond kindly. Learn together.</Text>
  </View></ScrollView></KeyboardAvoidingView>;
}
function QuestionCard({ question: q, activity, mine, voted, selected, closed, busy, onOpen, onVote }: { question: Question; activity?: QuestionActivity; mine: boolean; voted: boolean; selected: boolean; closed: boolean; busy: boolean; onOpen: () => void; onVote: () => void }) {
  return <View style={[ui.card, { padding: 20, gap: 14 }, selected && { borderColor: color.purple, backgroundColor: '#FCFBFF' }]}>
    <View style={ui.spread}><View style={[ui.row, ui.wrap]}><Text style={s.author}>{q.authorName}{mine ? ' · You' : ''}</Text>{q.answered && <Badge text="Answered" green />}</View><Text style={ui.caption}>{timeLabel(q.createdAt, q.pending)}</Text></View>
    <Text style={s.questionText}>{q.text}</Text>
    <View style={ui.spread}><Button compact title={`↑ ${activity?.loaded ? activity.voters.length : '…'}`} label={voted ? 'Remove your upvote' : 'Upvote question'} selected={voted} tone={voted ? 'primary' : 'secondary'} disabled={closed || busy || q.pending || !activity?.loaded} onPress={onVote} /><Button compact title={`${activity?.loaded ? activity.responses.length : '…'} ${activity?.responses.length === 1 ? 'response' : 'responses'} →`} label={`Open responses to: ${q.text}`} tone="quiet" onPress={onOpen} disabled={q.pending} /></View>
  </View>;
}
function Thread({ question, activity, room, service, profile, lecturer, mine, busy, onAnswered, onBack }: { question: Question; activity?: QuestionActivity; room: Room; service: ClassroomService; profile: Profile; lecturer: boolean; mine: boolean; busy: boolean; onAnswered: () => void; onBack: () => void }) {
  const [text, setText] = useState(''); const [sending, setSending] = useState(false); const lock = useRef(false); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const closed = room.status === 'closed';
  async function submit() {
    if (lock.current) return; lock.current = true; setSending(true); setError(''); setSuccess('');
    try { await service.respond(room.id, question.id, text, profile); setText(''); setSuccess('Your response is posted.'); }
    catch (err) { setError(readableError(err)); }
    finally { lock.current = false; setSending(false); }
  }
  return <View style={[ui.card, { padding: 22, gap: 20 }]}>
    <View style={ui.spread}><Text style={ui.eyebrow}>QUESTION & RESPONSES</Text><Button compact title="← Back to questions" tone="quiet" onPress={onBack} disabled={sending} /></View>
    <View style={{ gap: 12 }}><View style={[ui.row, ui.wrap]}><Text style={s.author}>{question.authorName}{mine ? ' · You' : ''}</Text>{question.answered && <Badge text="Answered" green />}</View><Text accessibilityRole="header" style={[s.questionText, { fontSize: 21, lineHeight: 30 }]}>{question.text}</Text><Text style={ui.caption}>{timeLabel(question.createdAt, question.pending)}</Text></View>
    {lecturer && !closed && <Button title={busy ? 'Updating…' : question.answered ? 'Mark as unanswered' : 'Mark as answered'} tone="secondary" onPress={onAnswered} disabled={busy || question.pending} />}
    <View style={s.rule} /><Heading small>Responses {activity?.loaded ? `(${activity.responses.length})` : ''}</Heading>
    {activity?.error ? <Notice kind="error">{activity.error}</Notice> : !activity?.loaded ? <Loading label="Loading responses…" /> : activity.responses.length === 0 ? <Text style={ui.body}>No responses yet. A helpful explanation can make all the difference.</Text> : activity.responses.map((response) => <View key={response.id} style={[s.response, response.authorId === room.lecturerId && { backgroundColor: color.purpleSoft, borderColor: '#DCD7F4' }]}><View style={[ui.row, ui.wrap]}><Text style={s.author}>{response.authorName}</Text>{response.authorId === room.lecturerId && <Badge text="Lecturer" />}</View><Text style={s.responseText}>{response.text}</Text><Text style={ui.caption}>{timeLabel(response.createdAt, response.pending)}</Text></View>)}
    <View style={s.rule} />
    {!closed ? <View style={{ gap: 14 }}><Field label="Your response" value={text} onChangeText={setText} maxLength={1000} multiline editable={!sending} placeholder="Share an explanation or a helpful thought…" /><View style={ui.spread}><Text style={ui.caption}>Replying as {profile.displayName}</Text><Text style={ui.caption}>{text.length}/1000</Text></View><Notice kind="error">{error}</Notice><Notice kind="success">{success}</Notice><Button title={sending ? 'Posting response…' : 'Post response →'} onPress={submit} disabled={sending || question.pending || !activity?.loaded} /></View> : <Notice>Replies are paused while this room is closed.{text ? ' Your draft is kept until you leave this question.' : ''}</Notice>}
  </View>;
}
const s = StyleSheet.create({ roomHeader: { borderRadius: 24, borderWidth: 1, borderColor: '#DADFF0', backgroundColor: '#EEF0F9', padding: 30, gap: 24 }, codeCard: { paddingHorizontal: 20, paddingVertical: 16, backgroundColor: 'white', borderRadius: 14, gap: 7 }, code: { fontSize: 25, fontWeight: '800', letterSpacing: 4, color: color.purple }, author: { fontSize: 12, fontWeight: '700', color: color.ink }, questionText: { fontSize: 17, lineHeight: 26, fontWeight: '600', color: color.ink }, rule: { height: 1, backgroundColor: color.border }, response: { padding: 16, gap: 10, borderRadius: 12, backgroundColor: '#F7F8FC', borderWidth: 1, borderColor: color.border }, responseText: { fontSize: 14, lineHeight: 23, color: color.ink } });
