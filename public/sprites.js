// ─────────────────────────────────────────────────────────────
// 스프라이트 설정. 이미지를 public/assets/ 에 넣고 아래 주석을 풀어 맞춰주세요.
// - 가로 스트립/그리드 시트 지원 (fw,fh = 프레임 1칸 크기, 프레임 번호는 좌→우, 위→아래)
// - 이미지가 없거나 로드 실패하면 내장 임시 도트 그래픽을 사용합니다.
// - 스프라이트는 오른쪽을 보는 것이 기본(왼쪽은 자동 반전). 발바닥 중앙 기준으로 그려집니다.
// - dw,dh: 화면에 그릴 크기(게임 해상도 480x270 기준), oy: 세로 보정(px)
// anims: { 이름: { f:[프레임들], fps, loop } }
// 사용 이름: player(idle,run,jump,shoot,hurt,dead) santa(idle,walk,throw,dash,slam,stun,dead)
//            snowman(walk) bat(fly) turret(idle) icicle(idle) heart(idle) gift(idle)
// ─────────────────────────────────────────────────────────────
window.SPRITES = {
  // player: { src: 'assets/player.png', fw: 32, fh: 32, dw: 32, dh: 32,
  //   anims: { idle:{f:[0],fps:1}, run:{f:[1,2,3,4],fps:10}, jump:{f:[5],fps:1}, shoot:{f:[6],fps:1}, hurt:{f:[7],fps:1}, dead:{f:[7],fps:1} } },
  // santa:  { src: 'assets/santa.png', fw: 64, fh: 64, dw: 64, dh: 64,
  //   anims: { idle:{f:[0,1],fps:3}, walk:{f:[2,3],fps:6}, throw:{f:[4],fps:1}, dash:{f:[5],fps:1}, slam:{f:[6],fps:1}, stun:{f:[7],fps:1}, dead:{f:[7],fps:1} } },
  // snowman:{ src: 'assets/snowman.png', fw: 24, fh: 24, anims: { walk:{f:[0,1],fps:4} } },
  // bat:    { src: 'assets/bat.png', fw: 24, fh: 16, anims: { fly:{f:[0,1],fps:8} } },
  // turret: { src: 'assets/turret.png', fw: 24, fh: 24, anims: { idle:{f:[0],fps:1} } },
  // icicle: { src: 'assets/icicle.png', fw: 12, fh: 24, anims: { idle:{f:[0],fps:1} } },
  // heart:  { src: 'assets/heart.png', fw: 16, fh: 16, anims: { idle:{f:[0],fps:1} } },
  // gift:   { src: 'assets/gift.png', fw: 12, fh: 12, anims: { idle:{f:[0],fps:1} } },
};
