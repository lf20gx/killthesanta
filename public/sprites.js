// ─────────────────────────────────────────────────────────────
// 스프라이트 설정 (santa=보스, player_ice/player_red=선택 가능한 플레이어). 나머지 몹 이미지는 추가하면 자동 적용됩니다.
// - 가로 스트립/그리드 시트 지원 (fw,fh = 프레임 1칸 크기, 프레임 번호는 좌→우, 위→아래)
// - 이미지가 없거나 로드 실패하면 내장 임시 도트 그래픽을 사용합니다.
// - 스프라이트는 오른쪽을 보는 것이 기본(왼쪽은 자동 반전). 발바닥 중앙 기준으로 그려집니다.
// - dw,dh: 화면에 그릴 크기(게임 해상도 480x270 기준), oy: 세로 보정(px)
// anims: { 이름: { f:[프레임들], fps, loop } }
// 사용 이름: player(idle,run,jump,shoot,hurt,dead) santa(idle,walk,throw,dash,slam,stun,dead)
//            snowman(walk) bat(fly) turret(idle) icicle(idle) heart(idle) gift(idle)
// ─────────────────────────────────────────────────────────────
window.SPRITES = {
  santa: { src: 'assets/santa.png', fw: 117, fh: 139, dw: 58.5, dh: 69.5, oy: 1,
    anims: { idle:{f:[0,1],fps:3}, walk:{f:[2,3,4,5],fps:7}, throw:{f:[6,7],fps:4}, dash:{f:[5],fps:1}, slam:{f:[7],fps:1}, stun:{f:[8],fps:1}, dead:{f:[9,10,11,12],fps:5,loop:false} } },
  player_ice: { src: 'assets/player_ice.png', fw: 81, fh: 68, dw: 53, dh: 44.5, oy: 1,
    anims: { idle:{f:[0],fps:1}, run:{f:[1,2,3,4],fps:10}, jump:{f:[2],fps:1}, shoot:{f:[5],fps:1}, hurt:{f:[6],fps:1}, dead:{f:[7],fps:1} } },
  player_red: { src: 'assets/player_red.png', fw: 60, fh: 62, dw: 39, dh: 40.5, oy: 1,
    anims: { idle:{f:[0],fps:1}, run:{f:[1,2,3,4],fps:10}, jump:{f:[2],fps:1}, shoot:{f:[7],fps:1}, hurt:{f:[8],fps:1}, dead:{f:[9],fps:1} } },
  // snowman / bat / turret / icicle / heart / gift : 이미지 없음 → 내장 도트 사용
};
