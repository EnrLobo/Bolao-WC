import { firebaseConfig, useFirebase } from "./firebase-config.js";
import { DEFAULT_SCORING } from "./scoring.js";
import { loadOfficialWorldCupSchedule, mergeScheduleMatches } from "./worldcupApi.js";
import { createInitialMatches } from "./worldcup2026.js";

const LOCAL_KEY = "bolao-copa-2026:v1";
const FIREBASE_VERSION = "10.12.5";

export async function createStore() {
  if (isFirebaseReady()) {
    try {
      return await createFirebaseStore();
    } catch (error) {
      console.warn("Firebase indisponivel, usando modo local.", error);
    }
  }

  return new LocalStore();
}

export function isFirebaseReady() {
  return (
    useFirebase === true &&
    Boolean(firebaseConfig.apiKey) &&
    Boolean(firebaseConfig.authDomain) &&
    Boolean(firebaseConfig.projectId) &&
    !firebaseConfig.apiKey.includes("COLE") &&
    !firebaseConfig.projectId.includes("COLE")
  );
}

class LocalStore {
  constructor() {
    this.mode = "local";
    this.listeners = new Set();
    this.state = readLocalState();
  }

  onAuthChanged(callback) {
    this.listeners.add(callback);
    callback(this.currentUser());
    return () => this.listeners.delete(callback);
  }

  currentUser() {
    return this.state.users.find((user) => user.uid === this.state.currentUserId) || null;
  }

  async signUp({ name, email }) {
    return this.signInLocal({ name, email });
  }

  async signIn({ email }) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = this.state.users.find((item) => item.email === normalizedEmail);

    if (!user) {
      throw new Error("Usuario local nao encontrado. Crie um acesso primeiro.");
    }

    this.state.currentUserId = user.uid;
    this.persist();
    this.emit();
    return user;
  }

  async signInLocal({ name, email }) {
    const normalizedEmail = email.trim().toLowerCase();
    let user = this.state.users.find((item) => item.email === normalizedEmail);

    if (!user) {
      user = {
        uid: crypto.randomUUID(),
        name: name.trim() || normalizedEmail,
        email: normalizedEmail,
        createdAt: new Date().toISOString(),
      };
      this.state.users.push(user);
    } else if (name.trim()) {
      user.name = name.trim();
    }

    this.state.currentUserId = user.uid;
    this.persist();
    this.emit();
    return user;
  }

  async signOut() {
    this.state.currentUserId = null;
    this.persist();
    this.emit();
  }

  async createParty({ name }) {
    const user = requireUser(this.currentUser());
    const id = crypto.randomUUID();
    const code = uniqueLocalCode(this.state);
    const now = new Date().toISOString();
    const schedule = await createScheduleSnapshot();

    this.state.parties[id] = {
      party: {
        id,
        code,
        name: name.trim(),
        ownerUid: user.uid,
        ownerName: user.name,
        createdAt: now,
        memberCount: 1,
        scoring: { ...DEFAULT_SCORING },
        scheduleSource: schedule.source,
      },
      members: [
        {
          uid: user.uid,
          name: user.name,
          email: user.email,
          role: "owner",
          joinedAt: now,
        },
      ],
      matches: schedule.matches,
      predictions: [],
    };

    this.persist();
    return id;
  }

  async joinParty({ code }) {
    const user = requireUser(this.currentUser());
    const normalizedCode = code.trim().toUpperCase();
    const entry = Object.values(this.state.parties).find(
      ({ party }) => party.code === normalizedCode,
    );

    if (!entry) {
      throw new Error("Party nao encontrada.");
    }

    const alreadyMember = entry.members.some((member) => member.uid === user.uid);
    if (!alreadyMember) {
      entry.members.push({
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: "member",
        joinedAt: new Date().toISOString(),
      });
      entry.party.memberCount = entry.members.length;
      this.persist();
    }

    return entry.party.id;
  }

  async listParties() {
    const user = requireUser(this.currentUser());

    return Object.values(this.state.parties)
      .filter(({ members }) => members.some((member) => member.uid === user.uid))
      .map(({ party, members }) => ({
        partyId: party.id,
        name: party.name,
        code: party.code,
        role: party.ownerUid === user.uid ? "owner" : "member",
        memberCount: members.length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async getParty(partyId) {
    const entry = this.state.parties[partyId];
    if (!entry) {
      throw new Error("Party nao encontrada.");
    }

    return clonePartyState(entry);
  }

  async savePrediction(partyId, prediction) {
    const user = requireUser(this.currentUser());
    const entry = this.state.parties[partyId];
    const match = entry?.matches.find((item) => item.id === prediction.matchId);

    if (!entry || !match) {
      throw new Error("Jogo nao encontrado.");
    }

    if (match.status === "finished") {
      throw new Error("Este jogo ja tem resultado fechado.");
    }

    const id = `${user.uid}_${prediction.matchId}`;
    const saved = {
      id,
      uid: user.uid,
      matchId: prediction.matchId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      winner: prediction.winner || "",
      updatedAt: new Date().toISOString(),
    };
    const index = entry.predictions.findIndex((item) => item.id === id);

    if (index >= 0) {
      entry.predictions[index] = saved;
    } else {
      entry.predictions.push(saved);
    }

    this.persist();
  }

  async saveMatch(partyId, matchPatch) {
    const user = requireUser(this.currentUser());
    const entry = this.state.parties[partyId];
    if (!entry || entry.party.ownerUid !== user.uid) {
      throw new Error("Apenas o dono da party pode alterar resultados.");
    }

    const match = entry.matches.find((item) => item.id === matchPatch.id);
    if (!match) {
      throw new Error("Jogo nao encontrado.");
    }

    Object.assign(match, {
      homeTeamName: matchPatch.homeTeamName,
      awayTeamName: matchPatch.awayTeamName,
      homeScore: matchPatch.homeScore,
      awayScore: matchPatch.awayScore,
      winner: matchPatch.winner || "",
      status: matchPatch.status,
      updatedAt: new Date().toISOString(),
    });

    this.persist();
  }

  async saveScoring(partyId, scoring) {
    const user = requireUser(this.currentUser());
    const entry = this.state.parties[partyId];
    if (!entry || entry.party.ownerUid !== user.uid) {
      throw new Error("Apenas o dono da party pode alterar a pontuacao.");
    }

    entry.party.scoring = scoring;
    this.persist();
  }

  async syncSchedule(partyId) {
    const user = requireUser(this.currentUser());
    const entry = this.state.parties[partyId];
    if (!entry || entry.party.ownerUid !== user.uid) {
      throw new Error("Apenas o dono da party pode sincronizar a tabela.");
    }

    const schedule = await loadOfficialWorldCupSchedule();
    entry.matches = mergeScheduleMatches(entry.matches, schedule.matches);
    entry.party.scheduleSource = schedule.source;
    entry.party.updatedAt = new Date().toISOString();
    this.persist();
    return schedule.source;
  }

  persist() {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(this.state));
  }

  emit() {
    const user = this.currentUser();
    this.listeners.forEach((callback) => callback(user));
  }
}

async function createFirebaseStore() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`),
    import(`https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`),
  ]);

  return new FirebaseStore(appModule, authModule, firestoreModule);
}

class FirebaseStore {
  constructor(appModule, authModule, firestoreModule) {
    this.mode = "firebase";
    this.app = appModule.initializeApp(firebaseConfig);
    this.auth = authModule.getAuth(this.app);
    this.db = firestoreModule.getFirestore(this.app);
    this.authModule = authModule;
    this.firestore = firestoreModule;
  }

  onAuthChanged(callback) {
    return this.authModule.onAuthStateChanged(this.auth, (user) => {
      callback(mapFirebaseUser(user));
    });
  }

  async signUp({ name, email, password }) {
    const credential = await this.authModule.createUserWithEmailAndPassword(
      this.auth,
      email.trim(),
      password,
    );

    if (name.trim()) {
      await this.authModule.updateProfile(credential.user, { displayName: name.trim() });
    }

    await this.upsertUser(credential.user, name.trim());
    return mapFirebaseUser(credential.user);
  }

  async signIn({ email, password }) {
    const credential = await this.authModule.signInWithEmailAndPassword(
      this.auth,
      email.trim(),
      password,
    );
    await this.upsertUser(credential.user, credential.user.displayName || "");
    return mapFirebaseUser(credential.user);
  }

  async signOut() {
    await this.authModule.signOut(this.auth);
  }

  async createParty({ name }) {
    const user = requireUser(mapFirebaseUser(this.auth.currentUser));
    const { collection, doc, getDoc, serverTimestamp, setDoc, writeBatch } = this.firestore;
    const partyRef = doc(collection(this.db, "parties"));
    const code = await this.createUniqueCode();
    const partyName = name.trim();
    const schedule = await createScheduleSnapshot();
    const batch = writeBatch(this.db);
    const party = {
      id: partyRef.id,
      code,
      name: partyName,
      ownerUid: user.uid,
      ownerName: user.name,
      memberCount: 1,
      scoring: { ...DEFAULT_SCORING },
      scheduleSource: schedule.source,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    batch.set(partyRef, party);
    batch.set(doc(this.db, "partyCodes", code), {
      partyId: partyRef.id,
      name: partyName,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(this.db, "parties", partyRef.id, "members", user.uid), {
      uid: user.uid,
      name: user.name,
      email: user.email,
      role: "owner",
      joinedAt: serverTimestamp(),
    });
    batch.set(doc(this.db, "users", user.uid, "parties", partyRef.id), {
      partyId: partyRef.id,
      name: partyName,
      code,
      role: "owner",
      joinedAt: serverTimestamp(),
    });

    schedule.matches.forEach((match) => {
      batch.set(doc(this.db, "parties", partyRef.id, "matches", match.id), match);
    });

    const codeDoc = await getDoc(doc(this.db, "partyCodes", code));
    if (codeDoc.exists()) {
      return this.createParty({ name });
    }

    await batch.commit();
    return partyRef.id;
  }

  async joinParty({ code }) {
    const user = requireUser(mapFirebaseUser(this.auth.currentUser));
    const { doc, getDoc, serverTimestamp, writeBatch } = this.firestore;
    const normalizedCode = code.trim().toUpperCase();
    const codeSnap = await getDoc(doc(this.db, "partyCodes", normalizedCode));

    if (!codeSnap.exists()) {
      throw new Error("Party nao encontrada.");
    }

    const { partyId, name } = codeSnap.data();
    const memberRef = doc(this.db, "parties", partyId, "members", user.uid);
    const memberSnap = await getDoc(memberRef);
    const batch = writeBatch(this.db);

    if (!memberSnap.exists()) {
      batch.set(memberRef, {
        uid: user.uid,
        name: user.name,
        email: user.email,
        role: "member",
        joinedAt: serverTimestamp(),
      });
      batch.set(doc(this.db, "users", user.uid, "parties", partyId), {
        partyId,
        name,
        code: normalizedCode,
        role: "member",
        joinedAt: serverTimestamp(),
      });
      await batch.commit();
    }

    return partyId;
  }

  async listParties() {
    const user = requireUser(mapFirebaseUser(this.auth.currentUser));
    const { collection, getDocs } = this.firestore;
    const snap = await getDocs(collection(this.db, "users", user.uid, "parties"));

    return snap.docs
      .map((docSnap) => docSnap.data())
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  async getParty(partyId) {
    const { collection, doc, getDoc, getDocs } = this.firestore;
    const [partySnap, membersSnap, matchesSnap, predictionsSnap] = await Promise.all([
      getDoc(doc(this.db, "parties", partyId)),
      getDocs(collection(this.db, "parties", partyId, "members")),
      getDocs(collection(this.db, "parties", partyId, "matches")),
      getDocs(collection(this.db, "parties", partyId, "predictions")),
    ]);

    if (!partySnap.exists()) {
      throw new Error("Party nao encontrada.");
    }

    return {
      party: normalizeTimestamps(partySnap.data()),
      members: membersSnap.docs.map((item) => normalizeTimestamps(item.data())),
      matches: matchesSnap.docs
        .map((item) => normalizeTimestamps(item.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder),
      predictions: predictionsSnap.docs.map((item) => normalizeTimestamps(item.data())),
    };
  }

  async savePrediction(partyId, prediction) {
    const user = requireUser(mapFirebaseUser(this.auth.currentUser));
    const { doc, serverTimestamp, setDoc } = this.firestore;
    const id = `${user.uid}_${prediction.matchId}`;

    await setDoc(
      doc(this.db, "parties", partyId, "predictions", id),
      {
        id,
        uid: user.uid,
        matchId: prediction.matchId,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        winner: prediction.winner || "",
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async saveMatch(partyId, matchPatch) {
    const { doc, serverTimestamp, updateDoc } = this.firestore;
    await updateDoc(doc(this.db, "parties", partyId, "matches", matchPatch.id), {
      homeTeamName: matchPatch.homeTeamName,
      awayTeamName: matchPatch.awayTeamName,
      homeScore: matchPatch.homeScore,
      awayScore: matchPatch.awayScore,
      winner: matchPatch.winner || "",
      status: matchPatch.status,
      updatedAt: serverTimestamp(),
    });
  }

  async saveScoring(partyId, scoring) {
    const { doc, serverTimestamp, updateDoc } = this.firestore;
    await updateDoc(doc(this.db, "parties", partyId), {
      scoring,
      updatedAt: serverTimestamp(),
    });
  }

  async syncSchedule(partyId) {
    const user = requireUser(mapFirebaseUser(this.auth.currentUser));
    const { collection, doc, getDoc, getDocs, serverTimestamp, updateDoc, writeBatch } =
      this.firestore;
    const partyRef = doc(this.db, "parties", partyId);
    const partySnap = await getDoc(partyRef);

    if (!partySnap.exists() || partySnap.data().ownerUid !== user.uid) {
      throw new Error("Apenas o dono da party pode sincronizar a tabela.");
    }

    const [schedule, currentSnap] = await Promise.all([
      loadOfficialWorldCupSchedule(),
      getDocs(collection(this.db, "parties", partyId, "matches")),
    ]);
    const currentMatches = currentSnap.docs.map((item) => item.data());
    const mergedMatches = mergeScheduleMatches(currentMatches, schedule.matches);
    const batch = writeBatch(this.db);

    mergedMatches.forEach((match) => {
      batch.set(doc(this.db, "parties", partyId, "matches", match.id), match, { merge: true });
    });

    await batch.commit();
    await updateDoc(partyRef, {
      scheduleSource: schedule.source,
      updatedAt: serverTimestamp(),
    });

    return schedule.source;
  }

  async upsertUser(firebaseUser, fallbackName) {
    const { doc, serverTimestamp, setDoc } = this.firestore;
    await setDoc(
      doc(this.db, "users", firebaseUser.uid),
      {
        uid: firebaseUser.uid,
        name: firebaseUser.displayName || fallbackName || firebaseUser.email,
        email: firebaseUser.email,
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    );
  }

  async createUniqueCode() {
    const { doc, getDoc } = this.firestore;
    let code = randomCode();
    let snap = await getDoc(doc(this.db, "partyCodes", code));

    while (snap.exists()) {
      code = randomCode();
      snap = await getDoc(doc(this.db, "partyCodes", code));
    }

    return code;
  }
}

function readLocalState() {
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        users: parsed.users || [],
        currentUserId: parsed.currentUserId || null,
        parties: parsed.parties || {},
      };
    }
  } catch (error) {
    console.warn("Nao foi possivel ler o armazenamento local.", error);
  }

  return {
    users: [],
    currentUserId: null,
    parties: {},
  };
}

async function createScheduleSnapshot() {
  try {
    const schedule = await loadOfficialWorldCupSchedule();
    return {
      matches: schedule.matches,
      source: schedule.source,
    };
  } catch (error) {
    console.warn("Nao foi possivel importar a tabela oficial.", error);
    return {
      matches: createInitialMatches(),
      source: {
        provider: "fallback",
        label: "Modelo interno",
        url: "",
        importedAt: new Date().toISOString(),
      },
    };
  }
}

function clonePartyState(entry) {
  return {
    party: structuredClone(entry.party),
    members: structuredClone(entry.members).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    matches: structuredClone(entry.matches).sort((a, b) => a.sortOrder - b.sortOrder),
    predictions: structuredClone(entry.predictions),
  };
}

function normalizeTimestamps(value) {
  return Object.fromEntries(
    Object.entries(value).map(([key, fieldValue]) => {
      if (fieldValue && typeof fieldValue.toDate === "function") {
        return [key, fieldValue.toDate().toISOString()];
      }
      return [key, fieldValue];
    }),
  );
}

function uniqueLocalCode(state) {
  let code = randomCode();
  const codes = new Set(Object.values(state.parties).map(({ party }) => party.code));

  while (codes.has(code)) {
    code = randomCode();
  }

  return code;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(
    "",
  );
}

function mapFirebaseUser(user) {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    name: user.displayName || user.email || "Participante",
    email: user.email || "",
  };
}

function requireUser(user) {
  if (!user) {
    throw new Error("Entre com um usuario para continuar.");
  }

  return user;
}
