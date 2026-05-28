export type LoginLockoutState = {
  emailKey: string;
  attempts: number;
  lockUntil: number | null;
  locked: boolean;
  remainingSeconds: number;
};
const PREFIX='copilot-login-lockout:';
const WINDOW_MS=5*60*1000;
const MAX_ATTEMPTS=3;
type Stored={attempts:number;lockUntil:number|null;updatedAt:number};
function normalizeEmail(email:string){return String(email||'').trim().toLowerCase()||'global';}
function getKey(email:string){return `${PREFIX}${normalizeEmail(email)}`;}
function read(email:string):Stored{if(typeof window==='undefined')return{attempts:0,lockUntil:null,updatedAt:Date.now()};try{const raw=window.localStorage.getItem(getKey(email));if(!raw)return{attempts:0,lockUntil:null,updatedAt:Date.now()};const parsed=JSON.parse(raw) as Stored;return{attempts:Number(parsed?.attempts||0),lockUntil:parsed?.lockUntil?Number(parsed.lockUntil):null,updatedAt:Number(parsed?.updatedAt||Date.now())};}catch{return{attempts:0,lockUntil:null,updatedAt:Date.now()};}}
function writeState(email:string,state:Stored){if(typeof window==='undefined')return;window.localStorage.setItem(getKey(email),JSON.stringify(state));}
export function getLoginLockoutState(email:string):LoginLockoutState{const emailKey=normalizeEmail(email);const state=read(emailKey);const now=Date.now();const lockUntil=state.lockUntil&&state.lockUntil>now?state.lockUntil:null;if(state.lockUntil&&state.lockUntil<=now){const reset={attempts:0,lockUntil:null,updatedAt:now};writeState(emailKey,reset);return{emailKey,attempts:0,lockUntil:null,locked:false,remainingSeconds:0};}const remainingSeconds=lockUntil?Math.max(0,Math.ceil((lockUntil-now)/1000)):0;return{emailKey,attempts:Number(state.attempts||0),lockUntil,locked:Boolean(lockUntil),remainingSeconds};}
export function registerFailedLoginAttempt(email:string){const emailKey=normalizeEmail(email);const current=read(emailKey);const now=Date.now();const attempts=Number(current.attempts||0)+1;const lockUntil=attempts>=MAX_ATTEMPTS?now+WINDOW_MS:null;writeState(emailKey,{attempts,lockUntil,updatedAt:now});return getLoginLockoutState(emailKey);}
export function clearLoginAttempts(email:string){const emailKey=normalizeEmail(email);writeState(emailKey,{attempts:0,lockUntil:null,updatedAt:Date.now()});}
export function formatRemaining(seconds:number){const mins=Math.floor(seconds/60);const secs=seconds%60;return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;}
