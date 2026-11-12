---
description: pixelfx 메뉴 — 이펙트 검색/미리보기/게임에 가져오기
argument-hint: "[검색어 또는 category/name]"
---
pixelfx 스킬(.claude/skills/pixelfx)을 사용해서 다음을 처리해: $ARGUMENTS

- 인자가 없으면 `node scripts/fx.mjs installed` 로 게임에 들어 있는 이펙트를 보여주고, 카테고리 목록(`ls vendor/pixelfx/src/fx`)을 메뉴처럼 제시한 뒤 무엇을 원하는지 물어본다.
- 검색어면 `node scripts/fx.mjs list <검색어>` → 후보를 `node scripts/fx.mjs render <id>` 로 렌더해 contact.png 를 직접 보고 고른 뒤 `node scripts/fx.mjs import <id>` 로 설치하고 `public/game.js` 에서 `spawnFx('<이름>', x, y)` 로 연결한다.
- `category/name` 이면 바로 import 해서 연결한다. 옵션은 `--opts '{"palette":[...]}'`.
- Patch Pixel 폰트(gallery/fonts)는 절대 쓰거나 복사하지 않는다.
