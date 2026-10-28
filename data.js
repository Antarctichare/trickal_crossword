/**
 * 트릭컬 리바이브 크로스워드 데이터 사전
 * - word: 단어 (공백 없이 정확한 명칭)
 * - category: 사도 / 지명 / 밈 / 아이템 등
 * - image: images/ 폴더 내 파일명 (미등록 시 default.png로 대체)
 * - quote: 정답 맞혔을 때 사도의 대사 (선택 사항)
 */
const TRICKCAL_DICTIONARY = [
  // [사도]
  { word: "에르핀", category: "사도", image: "images/erpin.png", quote: "빵 줘! 빵 내놔!" },
  { word: "티그", category: "사도", image: "images/tigre.png", quote: "내가 엘리아스 최강이다!" },
  { word: "네르", category: "사도", image: "images/ner.png", quote: "교주님, 결재 서류가 밀려있습니다." },
  { word: "아네트", category: "사도", image: "images/anette.png", quote: "모나티엄의 기술력을 보아라!" },
  { word: "사멜리아", category: "사도", image: "images/samelia.png", quote: "후훗, 저와 함께 티타임 어떠신가요?" },
  { word: "코미", category: "사도", image: "images/komi.png", quote: "귀찮아... 그냥 누워있을래..." },
  { word: "버터", category: "사도", image: "images/butter.png", quote: "버터는 아무것도 몰라요오~" },
  { word: "비비", category: "사도", image: "images/vivi.png", quote: "비비의 마법은 완벽해!" },
  { word: "시온", category: "사도", image: "images/shion.png", quote: "어둠의 힘이 깨어난다..." },
  { word: "림", category: "사도", image: "images/rim.png", quote: "유령이라고 무시하지 마!" },
  { word: "실비아", category: "사도", image: "images/sylvia.png", quote: "질서는 반드시 지켜져야 합니다." },
  { word: "디아나", category: "사도", image: "images/diana.png", quote: "세계수의 가호가 함께하길." },
  { word: "죠안", category: "사도", image: "images/joan.png", quote: "모든 것은 기록되어 있습니다." },
  { word: "벨라", category: "사도", image: "images/bella.png", quote: "화려하게 피어나는 불꽃!" },
  { word: "우이", category: "사도", image: "images/ui.png", quote: "우이의 비약을 마셔볼래?" },
  { word: "모모", category: "사도", image: "images/momo.png", quote: "돈이 최고야, 교주!" },
  { word: "우로스", category: "사도", image: "images/uros.png", quote: "용족의 위엄을 보여주지." },
  { word: "루포", category: "사도", image: "images/rupo.png", quote: "늑대의 사냥감을 놓치지 않는다!" },

  // [지명 / 세계관 고유명사]
  { word: "모나티엄", category: "지명", image: "images/monatium.png", quote: "엘프들의 최첨단 과학 도시!" },
  { word: "엘리아스", category: "지명", image: "images/elias.png", quote: "요정들과 온갖 종족이 모여 사는 세상." },
  { word: "세계수", category: "지명", image: "images/worldtree.png", quote: "모든 생명의 근원." },
  { word: "줘팸터", category: "시스템", image: "images/pvp.png", quote: "볼따구를 사정없이 줘패는 곳!" },
  { word: "모카롱", category: "아이템", image: "images/macaron.png", quote: "달콤하고 부드러운 최고의 간식!" },
  { word: "별사탕", category: "아이템", image: "images/candy.png", quote: "영롱하게 빛나는 재화." }
];

// 게임 시작 시 무작위로 주어질 첫 단어(시드) 목록
const SEED_WORDS = ["모나티엄", "사멜리아", "엘리아스", "에르핀", "세계수"];