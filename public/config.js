// 랭킹 저장소 설정 (우선순위: Supabase > API_BASE 서버 > 브라우저 로컬)
// Supabase: Project Settings > API 의 Project URL 과 anon(public) key 를 넣으세요. anon key 는 공개해도 되는 키입니다.
window.SUPABASE_URL = 'https://vuqplycpejodbuepedlu.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_J4SY6swater2if3ZNoGDLg_go9q84cW';
// 자체 서버(server.js)를 쓸 때만. 같은 서버에서 서빙하면 ''.
window.API_BASE = '';
