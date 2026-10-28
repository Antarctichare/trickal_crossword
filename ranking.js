// ranking.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase 설정
const firebaseConfig = {
  apiKey: "AIzaSyCAzG2t9MgcI8Z5bCKSc0UUXHp0SfB7dTw",
  authDomain: "trickal-ca0c8.firebaseapp.com",
  projectId: "trickal-ca0c8",
  storageBucket: "trickal-ca0c8.firebasestorage.app",
  messagingSenderId: "871313152794",
  appId: "1:871313152794:web:aebc33f32b8087bb8eaaa3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const COLLECTION_NAME = "scores";
const STORAGE_KEY_LAST_NICK = "last_nickname";

/**
 * 마지막으로 사용한 닉네임 가져오기 (localStorage)
 */
export function getLastNickname() {
  return localStorage.getItem(STORAGE_KEY_LAST_NICK) || "";
}

/**
 * 닉네임 유효성 검사 (2~10자)
 */
export function validateNickname(nick) {
  if (!nick) return { valid: false, message: "닉네임을 입력해 주세요." };
  const trimmed = nick.trim();
  if (trimmed.length < 2 || trimmed.length > 10) {
    return { valid: false, message: "닉네임은 2자 이상 10자 이하이어야 합니다." };
  }
  return { valid: true, nickname: trimmed };
}

/**
 * TOP N 랭킹 목록 조회
 * @param {number} topLimit - 가져올 순위 수 (기본 10)
 */
export async function getLeaderboard(topLimit = 10) {
  try {
    const scoresRef = collection(db, COLLECTION_NAME);
    const q = query(scoresRef, orderBy("score", "desc"), limit(topLimit));
    const querySnapshot = await getDocs(q);

    const rankings = [];
    let rank = 1;
    querySnapshot.forEach((docSnap) => {
      rankings.push({
        rank: rank++,
        nick: docSnap.data().nick,
        score: docSnap.data().score,
        words: docSnap.data().words ?? 0
      });
    });

    return { success: true, data: rankings };
  } catch (error) {
    console.error("랭킹 조회 실패:", error);
    return { success: false, error };
  }
}

/**
 * 점수 등록/갱신
 * 기존 최고 점수보다 높을 때만 저장 (보안 규칙 준수)
 * @param {string} nickname 
 * @param {number} score 
 * @param {number} words 
 */
export async function submitScore(nickname, score, words = 0) {
  const check = validateNickname(nickname);
  if (!check.valid) {
    return { success: false, message: check.message };
  }

  const cleanNick = check.nickname;
  // 다음 접속 시 자동 입력을 위해 로컬에 저장
  localStorage.setItem(STORAGE_KEY_LAST_NICK, cleanNick);

  // Firestore 규칙에 맞게 정수(int) 변환
  const newScore = Math.floor(score);
  const wordCount = Math.floor(words);

  const docRef = doc(db, COLLECTION_NAME, cleanNick);

  try {
    const existingSnap = await getDoc(docRef);

    if (existingSnap.exists()) {
      const currentScore = existingSnap.data().score || 0;
      if (newScore <= currentScore) {
        return { 
          success: true, 
          updated: false, 
          message: `기존 최고 기록(${currentScore}점)을 넘지 못했습니다.` 
        };
      }
    }

    // 신규 등록 또는 최고 점수 갱신
    // 보안 규칙에서 keys().hasOnly(['nick', 'score', 'words'])를 검사하므로 3개 필드만 전송
    await setDoc(docRef, {
      nick: cleanNick,
      score: newScore,
      words: wordCount
    });

    return { success: true, updated: true, message: "새로운 최고 기록이 등록되었습니다!" };
  } catch (error) {
    console.error("점수 등록 실패:", error);
    return { 
      success: false, 
      message: "점수 저장 중 권한/네트워크 오류가 발생했습니다.", 
      error 
    };
  }
}