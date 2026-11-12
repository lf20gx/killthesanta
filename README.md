# KILL THE SANTA 🎅💀

스마트폰 **가로 화면** 횡스크롤 액션 (록맨 스타일). 보스의 방까지 잡몹·지형 함정을 뚫고 가서 사악한 산타를 처치하세요.

## 실행
```bash
npm start        # http://localhost:3000  (의존성 없음, Node 18+)
```
- 랭킹은 서버의 `data/ranking.json`에 상위 10명만 저장됩니다 (`DATA_DIR` 환경변수로 위치 변경, `PORT`로 포트 변경).
- Render / Railway / Fly.io 등에 올릴 땐 **영구 디스크(Volume)** 를 `DATA_DIR`에 마운트해야 랭킹이 재배포 후에도 유지됩니다.
- 서버 없이 정적 호스팅(GitHub Pages)만 쓰면 랭킹은 기기 로컬에 저장됩니다. 별도 서버를 쓰려면 `public/config.js`의 `API_BASE`를 지정하세요.

## 조작
- 모바일: 화면의 ◀ ▶ / 점프 / 발사 버튼 (멀티터치, 슬라이드 지원)
- PC: ← → 이동, Z·Space 점프(길게=높이), X·J 발사

## 점수
| 항목 | 점수 |
|---|---|
| 보스 방 접근 | 거리 비례 최대 5,000 |
| 잡몹 처치 | 몹별 50~200 |
| 보스 데미지 | 1타당 100 (HP 40) |
| 클리어 보너스 | 10,000 |
| **시간 보너스** | (300초 − 클리어 시간) × 100 |

사망하거나 클리어하면 이름(8자)을 남겨 TOP 10에 도전합니다.

## 스프라이트 교체
`public/sprites.js` 의 주석 예시를 풀고 이미지를 `public/assets/` 에 넣으세요. (프레임 크기/애니메이션 프레임 번호만 맞추면 됩니다.) 이미지가 없으면 내장 임시 도트 그래픽이 사용됩니다.

## 이펙트 파이프라인 (pixelfx)
`pixelfx`(v0.3.1, 커밋 고정: `scripts/pixelfx.lock.json`) → 렌더 → 스프라이트 시트(PNG+JSON) → `public/assets/fx/` → 게임의 `spawnFx(name, x, y)`.
```bash
node scripts/fx.mjs setup                  # 고정 커밋으로 vendor/pixelfx 받기 (gallery/Patch Pixel 폰트는 받지 않음)
node scripts/fx.mjs list frost             # 검색
node scripts/fx.mjs render ice/frost-nova  # 미리보기 contact.png
node scripts/fx.mjs import impacts/hit-spark --as hit-spark
node scripts/fx.mjs menu                   # 대화형 메뉴
```
Claude Code에서는 `.claude/skills/pixelfx` 스킬과 `/fx` 명령을 쓰세요. 라이선스/크레딧: `THIRD_PARTY_NOTICES.md`.
