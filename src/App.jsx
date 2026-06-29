import { useState, useRef, useCallback, useEffect } from "react";

// ── Supabase config ───────────────────────────────────────────────────────────
const SUPA_URL = "https://keipbvsszoactncwomkr.supabase.co";
const SUPA_KEY = "sb_publishable_s_rknptEry3s4mn_3TnEKA_RswGvpGY";
const headers  = { "Content-Type":"application/json", "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` };

async function dbFetch(path, opts={}) {
  const res = await fetch(`${SUPA_URL}/rest/v1${path}`, { ...opts, headers: { ...headers, ...(opts.headers||{}) } });
  if (!res.ok) { const e = await res.text(); throw new Error(e); }
  if (res.status === 204) return null;
  return res.json();
}

const dbGetAll  = ()            => dbFetch("/cobracoes?select=*&order=created_at.desc");
const dbInsert  = (row)         => dbFetch("/cobracoes", { method:"POST", body: JSON.stringify(row), headers:{"Prefer":"return=representation"} });
const dbDelete  = (id)          => dbFetch(`/cobracoes?id=eq.${id}`, { method:"DELETE" });

// ── Constantes ────────────────────────────────────────────────────────────────
const ZONES = [
  { id:"tl", label:"↖ Esq\nSup" }, { id:"tc", label:"↑ Cen\nSup" }, { id:"tr", label:"↗ Dir\nSup" },
  { id:"bl", label:"↙ Esq\nInf" }, { id:"bc", label:"↓ Cen\nInf" }, { id:"br", label:"↘ Dir\nInf" },
];
const ZONE_LABELS = { tl:"Esq. Sup", tc:"Cen. Sup", tr:"Dir. Sup", bl:"Esq. Inf", bc:"Cen. Inf", br:"Dir. Inf" };

const emptyForm = () => ({
  jogador:"", camisa:"", time:"", pe:"", zona:"", resultado:"gol",
  data: new Date().toISOString().split("T")[0], adversario:"", rodada:""
});

const playerKey = (k) => `${(k.jogador||"").trim().toLowerCase()}#${(k.camisa||"").trim()}`;

// ── Mic ───────────────────────────────────────────────────────────────────────
function MicButton({ onTranscript }) {
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => "webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  const recRef = useRef(null);
  const toggle = useCallback(() => {
    if (!supported) return alert("Use Chrome ou Edge.");
    if (listening) { recRef.current?.stop(); setListening(false); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang="pt-BR"; rec.continuous=false; rec.interimResults=false;
    recRef.current = rec;
    rec.onresult = (e) => onTranscript(Array.from(e.results).map(r=>r[0].transcript).join(" ").trim());
    rec.onerror = () => setListening(false);
    rec.onend   = () => setListening(false);
    rec.start(); setListening(true);
  }, [listening, supported, onTranscript]);
  if (!supported) return null;
  return (
    <button type="button" onClick={toggle}
      className={`absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center transition-all z-10 ${listening?"bg-red-500 animate-pulse":"bg-[#1e3a5f] hover:bg-[#3b82f6]"}`}>
      <span className="text-xs">{listening?"⏹":"🎙"}</span>
    </button>
  );
}
function VoiceInput({ value, onChange, placeholder, className }) {
  return (
    <div className="relative">
      <input className={`${className} pr-10`} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} />
      <MicButton onTranscript={onChange} />
    </div>
  );
}

// ── Stats ─────────────────────────────────────────────────────────────────────
function calcStats(kicks) {
  const total = kicks.length;
  const gols  = kicks.filter(k=>k.resultado==="gol").length;
  const defs  = kicks.filter(k=>k.resultado==="defendido").length;
  const fora  = kicks.filter(k=>k.resultado==="fora").length;
  const conv  = total>0 ? Math.round(gols/total*100) : 0;
  const byZone = {};
  kicks.forEach(k=>{
    if(!k.zona) return;
    if(!byZone[k.zona]) byZone[k.zona]={total:0,gols:0,defs:0,fora:0};
    byZone[k.zona].total++;
    byZone[k.zona][k.resultado]++;
  });
  const topZone    = Object.entries(byZone).sort((a,b)=>b[1].total-a[1].total)[0];
  const topGolZone = Object.entries(byZone).sort((a,b)=>b[1].gols-a[1].gols)[0];
  const peDir = kicks.filter(k=>k.pe==="direito").length;
  const peEsq = kicks.filter(k=>k.pe==="esquerdo").length;
  const pePref = peDir>=peEsq&&peDir>0?"Direito":peEsq>0?"Esquerdo":null;
  return { total, gols, defs, fora, conv, byZone, topZone, topGolZone, peDir, peEsq, pePref };
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function Heatmap({ kicks, size="md" }) {
  const cellW = size==="lg"?"w-24 h-20":size==="sm"?"w-10 h-8":"w-16 h-14";
  const txtSz = size==="lg"?"text-base":size==="sm"?"text-[9px]":"text-xs";
  const subSz = size==="lg"?"text-xs":"text-[8px]";
  return (
    <div className="border-2 border-[#1e3a5f] rounded overflow-hidden">
      <div className="grid grid-cols-3">
        {ZONES.map(z=>{
          const inZ = kicks.filter(k=>k.zona===z.id);
          const g=inZ.filter(k=>k.resultado==="gol").length;
          const d=inZ.filter(k=>k.resultado==="defendido").length;
          const f=inZ.filter(k=>k.resultado==="fora").length;
          const n=inZ.length, mx=Math.max(g,d,f,0);
          let bg="bg-[#0a1628]";
          if(n>0) bg=(mx===g&&g>0)?"bg-[#22c55e]":(mx===d&&d>0)?"bg-[#f59e0b]":"bg-[#ef4444]";
          return (
            <div key={z.id} className={`${bg} ${cellW} border border-[#1e3a5f] flex flex-col items-center justify-center`}>
              {n>0 && <span className={`${txtSz} font-black text-white leading-none`}>{n}</span>}
              {n>0 && size!=="sm" && <span className={`${subSz} text-white/80 leading-none`}>{g}G {d}D {f}F</span>}
            </div>
          );
        })}
      </div>
      <div className="bg-[#1e3a5f] py-0.5 text-center">
        <span className="text-[9px] text-[#4a6fa5]">🟢 Gol &nbsp;🟡 Defendido &nbsp;🔴 Fora</span>
      </div>
    </div>
  );
}

// ── Danger badge ──────────────────────────────────────────────────────────────
function DangerBadge({ conv }) {
  if(conv>=75) return <span className="text-[10px] font-bold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">⚠️ Alto risco</span>;
  if(conv>=50) return <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full">⚡ Moderado</span>;
  return <span className="text-[10px] font-bold bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">🛡 Vulnerável</span>;
}

// ── Sort ──────────────────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { id:"risco",     label:"Maior risco"    },
  { id:"cobracoes", label:"Mais cobranças" },
  { id:"conversao", label:"Maior conversão"},
  { id:"gols",      label:"Mais gols"      },
];
function sortPlayers(players, sort) {
  return [...players].sort((a,b)=>{
    const sa=calcStats(a.kicks), sb=calcStats(b.kicks);
    if(sort==="cobracoes") return sb.total-sa.total;
    if(sort==="conversao") return sb.conv-sa.conv;
    if(sort==="gols")      return sb.gols-sa.gols;
    const ra=sa.conv*Math.log(sa.total+1), rb=sb.conv*Math.log(sb.total+1);
    return rb-ra;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [kicks, setKicks]       = useState([]);
  const [form, setForm]         = useState(emptyForm());
  const [view, setView]         = useState("goleiro");
  const [selected, setSelected] = useState(null);
  const [sort, setSort]         = useState("risco");
  const [search, setSearch]     = useState("");
  const [lastData, setLastData] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState(null);
  const [syncMsg, setSyncMsg]   = useState("");

  // Carrega do Supabase
  useEffect(()=>{
    setLoading(true);
    dbGetAll()
      .then(data => { setKicks(data||[]); setError(null); })
      .catch(()  => setError("Erro ao conectar com o banco. Verifique sua conexão."))
      .finally(()=> setLoading(false));
  },[]);

  const addKick = async () => {
    if(!form.jogador||!form.zona){ alert("Preencha o nome e a zona."); return; }
    setSaving(true);
    try {
      const [inserted] = await dbInsert({
        jogador:form.jogador, camisa:form.camisa, time:form.time, pe:form.pe,
        zona:form.zona, resultado:form.resultado, rodada:form.rodada,
        data:form.data||null, adversario:form.adversario,
      });
      setKicks(ks=>[inserted, ...ks]);
      setLastData({ jogador:form.jogador, camisa:form.camisa, time:form.time,
                    pe:form.pe, adversario:form.adversario, rodada:form.rodada, data:form.data });
      setForm(f=>({...f, zona:"", resultado:"gol"}));
      setSyncMsg("✅ Salvo na nuvem");
      setTimeout(()=>setSyncMsg(""),2000);
    } catch(e) {
      alert("Erro ao salvar: " + e.message);
    } finally { setSaving(false); }
  };

  const removeKick = async (id) => {
    try {
      await dbDelete(id);
      setKicks(ks=>ks.filter(k=>k.id!==id));
    } catch(e) { alert("Erro ao remover: "+e.message); }
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const data = await dbGetAll();
      setKicks(data||[]);
      setSyncMsg("🔄 Atualizado");
      setTimeout(()=>setSyncMsg(""),2000);
    } catch { setError("Erro ao sincronizar."); }
    finally { setLoading(false); }
  };

  const repeatLast = () => {
    if(!lastData) return;
    setForm(f=>({...f, ...lastData, zona:"", resultado:"gol"}));
  };

  // Agrupa por jogador
  const allPlayers = (() => {
    const map = {};
    kicks.forEach(k=>{
      const key = playerKey(k);
      if(!map[key]) map[key]={key,jogador:k.jogador,camisa:k.camisa,time:k.time||"",kicks:[]};
      map[key].kicks.push(k);
      if(k.time) map[key].time=k.time;
    });
    return Object.values(map);
  })();

  const filteredPlayers = sortPlayers(
    allPlayers.filter(p=>
      p.jogador.toLowerCase().includes(search.toLowerCase())||
      (p.camisa&&p.camisa.includes(search))||
      (p.time&&p.time.toLowerCase().includes(search.toLowerCase()))
    ), sort
  );

  const selPlayer = selected ? allPlayers.find(p=>p.key===selected) : null;

  const ic = "w-full bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg px-3 py-2 text-white placeholder-[#4a6fa5] focus:outline-none focus:border-[#3b82f6] text-sm";
  const lc = "block text-xs font-semibold text-[#7fb3f5] uppercase tracking-wider mb-1";

  if(loading) return (
    <div className="min-h-screen bg-[#060e1a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">🥅</div>
        <p className="text-[#7fb3f5] font-semibold">Carregando dados da nuvem...</p>
      </div>
    </div>
  );

  if(error) return (
    <div className="min-h-screen bg-[#060e1a] flex items-center justify-center p-4">
      <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 text-center max-w-sm">
        <p className="text-3xl mb-2">⚠️</p>
        <p className="text-red-400 font-semibold mb-3">{error}</p>
        <button onClick={refresh} className="px-4 py-2 bg-[#3b82f6] rounded-lg text-sm font-medium">Tentar novamente</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060e1a] text-white font-sans">
      {/* NAV */}
      <div className="sticky top-0 z-50 bg-[#060e1a] border-b border-[#1e3a5f] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#3b82f6] rounded-lg flex items-center justify-center font-bold">🥅</div>
          <div>
            <span className="font-bold tracking-tight">Scout Pênaltis</span>
            <span className="ml-2 text-xs text-[#4a6fa5]">{kicks.length} cobranças · {allPlayers.length} batedores</span>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          {syncMsg && <span className="text-xs text-green-400 mr-1">{syncMsg}</span>}
          <button onClick={refresh} title="Atualizar" className="p-1.5 text-[#4a6fa5] hover:text-white transition-colors">🔄</button>
          <button onClick={()=>{setView("goleiro");setSelected(null);}}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view==="goleiro"||view==="detalhe"?"bg-[#3b82f6] text-white":"text-[#4a6fa5] hover:text-white"}`}>
            🧤 Goleiro
          </button>
          <button onClick={()=>setView("registrar")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${view==="registrar"?"bg-[#3b82f6] text-white":"text-[#4a6fa5] hover:text-white"}`}>
            ➕ Registrar
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-3">

        {/* ══ TELA DO GOLEIRO ══════════════════════════════════════════════ */}
        {view==="goleiro" && (
          <>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input className={`${ic} pl-3`} placeholder="🔍 Buscar por nome, camisa ou time..."
                  value={search} onChange={e=>setSearch(e.target.value)} />
                {search && <button onClick={()=>setSearch("")} className="absolute right-3 top-2.5 text-[#4a6fa5] hover:text-white text-xs">✕</button>}
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1">
              {SORT_OPTIONS.map(o=>(
                <button key={o.id} onClick={()=>setSort(o.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border whitespace-nowrap transition-colors ${sort===o.id?"bg-[#3b82f6] border-[#3b82f6] text-white":"border-[#1e3a5f] text-[#4a6fa5] hover:text-white"}`}>
                  {o.label}
                </button>
              ))}
            </div>

            {filteredPlayers.length===0 ? (
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-12 text-center">
                <p className="text-4xl mb-2">🥅</p>
                <p className="text-[#4a6fa5]">{search?"Nenhum batedor encontrado.":"Nenhuma cobrança registrada ainda."}</p>
                {!search && <button onClick={()=>setView("registrar")} className="mt-3 px-4 py-2 bg-[#3b82f6] rounded-lg text-sm font-medium">Registrar primeira cobrança</button>}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredPlayers.map((p,idx)=>{
                  const s = calcStats(p.kicks);
                  return (
                    <button key={p.key} onClick={()=>{setSelected(p.key);setView("detalhe");}}
                      className="w-full bg-[#0a1628] border border-[#1e3a5f] hover:border-[#3b82f6] rounded-xl p-3 text-left transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 mt-0.5 ${idx===0?"bg-yellow-500 text-black":idx===1?"bg-gray-400 text-black":idx===2?"bg-amber-700 text-white":"bg-[#1e3a5f] text-[#7fb3f5]"}`}>
                          {idx+1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-base">{p.jogador}</span>
                            {p.camisa && <span className="text-sm text-[#4a6fa5]">#{p.camisa}</span>}
                            {p.time && <span className="text-xs bg-[#1e3a5f] text-[#7fb3f5] px-2 py-0.5 rounded-full">{p.time}</span>}
                            <DangerBadge conv={s.conv} />
                          </div>
                          <div className="flex items-center gap-3 text-xs mb-1.5 flex-wrap">
                            <span className="text-[#4a6fa5]">{s.total} cobranças</span>
                            <span className="text-green-400 font-bold">{s.conv}% conv.</span>
                            <span className="text-white">{s.gols}G</span>
                            <span className="text-orange-400">{s.defs}D</span>
                            <span className="text-red-400">{s.fora}F</span>
                            {s.pePref && <span className="text-[#7fb3f5]">🦶 {s.pePref}</span>}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {s.topZone && (
                              <span className="text-xs bg-[#060e1a] border border-[#1e3a5f] px-2 py-0.5 rounded text-[#7fb3f5]">
                                🎯 <strong className="text-white">{ZONE_LABELS[s.topZone[0]]}</strong> ({s.topZone[1]}x)
                              </span>
                            )}
                            {s.topGolZone && s.topGolZone[0]!==s.topZone?.[0] && (
                              <span className="text-xs bg-[#060e1a] border border-[#1e3a5f] px-2 py-0.5 rounded text-green-400">
                                ✅ <strong>{ZONE_LABELS[s.topGolZone[0]]}</strong> ({s.topGolZone[1].gols}G)
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="shrink-0"><Heatmap kicks={p.kicks} size="sm" /></div>
                        <span className="text-[#4a6fa5] self-center">›</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ══ DETALHE ══════════════════════════════════════════════════════ */}
        {view==="detalhe" && selPlayer && (()=>{
          const s = calcStats(selPlayer.kicks);
          const rodadas = [...new Set(selPlayer.kicks.map(k=>k.rodada).filter(Boolean))].sort();
          return (
            <>
              <button onClick={()=>setView("goleiro")} className="text-[#7fb3f5] hover:text-white text-sm transition-colors">← Voltar</button>

              <div className="bg-[#0a1628] border-2 border-[#3b82f6] rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-2xl font-black">{selPlayer.jogador}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {selPlayer.camisa && <span className="text-[#4a6fa5]">#{selPlayer.camisa}</span>}
                      {selPlayer.time && <span className="text-sm bg-[#1e3a5f] text-[#7fb3f5] px-2 py-0.5 rounded-full">{selPlayer.time}</span>}
                      <DangerBadge conv={s.conv} />
                      {rodadas.length>0 && <span className="text-xs text-[#4a6fa5]">Rodadas: {rodadas.join(", ")}</span>}
                    </div>
                  </div>
                  {s.pePref && (
                    <div className="bg-[#1e3a5f] rounded-xl p-3 text-center shrink-0">
                      <p className="text-2xl">🦶</p>
                      <p className="text-xs font-bold text-white mt-0.5">{s.pePref}</p>
                      <p className="text-[10px] text-[#4a6fa5]">Pé dom.</p>
                    </div>
                  )}
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    {v:`${s.conv}%`,l:"Conversão",  c:"text-white"},
                    {v:s.total,     l:"Cobranças",  c:"text-[#7fb3f5]"},
                    {v:s.gols,      l:"Gols",       c:"text-green-400"},
                    {v:s.defs+s.fora,l:"Erros",     c:"text-red-400"},
                  ].map(({v,l,c})=>(
                    <div key={l} className="bg-[#060e1a] rounded-lg p-3 text-center border border-[#1e3a5f]">
                      <p className={`text-xl font-black ${c}`}>{v}</p>
                      <p className="text-[10px] text-[#4a6fa5] mt-0.5">{l}</p>
                    </div>
                  ))}
                </div>

                {/* Alerta goleiro */}
                {s.topZone && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
                    <p className="text-xs font-bold text-red-400 uppercase mb-1">⚠️ Atenção Goleiro</p>
                    <p className="text-sm text-white leading-relaxed">
                      Bate com mais frequência em <strong className="text-yellow-400">{ZONE_LABELS[s.topZone[0]]}</strong>
                      {s.topGolZone && <> · Maior conversão em <strong className="text-green-400">{ZONE_LABELS[s.topGolZone[0]]}</strong></>}
                      {s.pePref && <span className="text-[#7fb3f5]"> · Pé {s.pePref}</span>}
                    </p>
                  </div>
                )}

                {/* Heatmap */}
                <p className="text-xs font-bold text-[#7fb3f5] uppercase mb-2">🎯 Mapa de Cobranças</p>
                <div className="flex justify-center mb-4">
                  <Heatmap kicks={selPlayer.kicks} size="lg" />
                </div>

                {/* Por zona */}
                <div className="grid grid-cols-3 gap-1">
                  {ZONES.map(z=>{
                    const inZ = selPlayer.kicks.filter(k=>k.zona===z.id);
                    if(inZ.length===0) return null;
                    const g=inZ.filter(k=>k.resultado==="gol").length;
                    const pct=Math.round(g/inZ.length*100);
                    return (
                      <div key={z.id} className="bg-[#0d1b2a] rounded p-2 border border-[#1e3a5f] text-center">
                        <p className="text-[10px] text-[#4a6fa5] mb-0.5">{ZONE_LABELS[z.id]}</p>
                        <p className="text-sm font-bold">{inZ.length}x</p>
                        <p className="text-[10px] text-green-400">{pct}% conv</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Histórico */}
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4">
                <p className="text-xs font-bold text-[#7fb3f5] uppercase mb-2">Histórico completo</p>
                <div className="space-y-1">
                  {selPlayer.kicks.slice().sort((a,b)=>(b.data||"").localeCompare(a.data||"")).map(k=>(
                    <div key={k.id} className="flex items-center gap-2 text-sm bg-[#0d1b2a] rounded-lg px-3 py-1.5 border border-[#1e3a5f]">
                      {k.rodada && <span className="text-[10px] bg-[#1e3a5f] text-[#7fb3f5] px-1.5 rounded font-bold shrink-0">R{k.rodada}</span>}
                      <span className="text-xs text-[#4a6fa5] shrink-0">{k.data?k.data.split("-").reverse().join("/"):"—"}</span>
                      {k.adversario && <span className="text-xs text-[#7fb3f5] truncate">vs {k.adversario}</span>}
                      {k.pe && <span className="text-xs text-[#4a6fa5]">({k.pe})</span>}
                      <span className="text-xs text-[#7fb3f5] shrink-0">{ZONE_LABELS[k.zona]}</span>
                      <span className={`ml-auto text-xs font-semibold shrink-0 ${k.resultado==="gol"?"text-green-400":k.resultado==="defendido"?"text-orange-400":"text-red-400"}`}>
                        {k.resultado==="gol"?"✅ Gol":k.resultado==="defendido"?"🛑 Def":"❌ Fora"}
                      </span>
                      <button onClick={()=>removeKick(k.id)} className="text-[#4a6fa5] hover:text-red-400 text-xs shrink-0 ml-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          );
        })()}

        {/* ══ REGISTRAR ════════════════════════════════════════════════════ */}
        {view==="registrar" && (
          <>
            <div className="flex items-center justify-between bg-[#0d1b2a] border border-[#1e3a5f] rounded-lg px-3 py-2 text-xs">
              <span className="text-green-400">☁️ Dados salvos na nuvem · {kicks.length} cobranças</span>
              <button onClick={refresh} className="text-[#7fb3f5] hover:text-white transition-colors">🔄 Atualizar</button>
            </div>

            <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-[#7fb3f5] uppercase tracking-widest">➕ Nova Cobrança</h2>
                {lastData && (
                  <button onClick={repeatLast} className="text-xs bg-[#1e3a5f] hover:bg-[#3b82f6] px-2 py-1 rounded-lg text-white transition-colors">
                    🔁 Repetir {lastData.jogador}
                  </button>
                )}
              </div>

              {/* Contexto */}
              <div className="grid grid-cols-3 gap-2 mb-2">
                <div>
                  <label className={lc}>Rodada</label>
                  <input className={ic} placeholder="Ex: 3" value={form.rodada} onChange={e=>setForm(f=>({...f,rodada:e.target.value}))} />
                </div>
                <div>
                  <label className={lc}>Data</label>
                  <input type="date" className={ic} value={form.data} onChange={e=>setForm(f=>({...f,data:e.target.value}))} />
                </div>
                <div>
                  <label className={lc}>Adversário</label>
                  <VoiceInput className={ic} placeholder="Time" value={form.adversario} onChange={v=>setForm(f=>({...f,adversario:v}))} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-2">
                <div className="col-span-2">
                  <label className={lc}>Jogador *</label>
                  <VoiceInput className={ic} placeholder="Nome do batedor" value={form.jogador} onChange={v=>setForm(f=>({...f,jogador:v}))} />
                </div>
                <div>
                  <label className={lc}>Camisa #</label>
                  <input className={ic} placeholder="Nº" value={form.camisa} onChange={e=>setForm(f=>({...f,camisa:e.target.value}))} />
                </div>
              </div>

              <div className="mb-2">
                <label className={lc}>Time do batedor</label>
                <VoiceInput className={ic} placeholder="Time" value={form.time} onChange={v=>setForm(f=>({...f,time:v}))} />
              </div>

              <div className="mb-2">
                <label className={lc}>🦶 Pé Dominante</label>
                <div className="flex gap-2">
                  {[["direito","👟 Direito"],["esquerdo","👟 Esquerdo"]].map(([v,l])=>(
                    <button key={v} type="button" onClick={()=>setForm(f=>({...f,pe:f.pe===v?"":v}))}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.pe===v?"bg-[#1e3a5f] border-[#3b82f6] text-white":"border-[#1e3a5f] text-[#4a6fa5] hover:text-white"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-2">
                <label className={lc}>Resultado</label>
                <div className="flex gap-1">
                  {[["gol","✅ Gol"],["defendido","🛑 Defendido"],["fora","❌ Fora"]].map(([v,l])=>(
                    <button key={v} type="button" onClick={()=>setForm(f=>({...f,resultado:v}))}
                      className={`flex-1 py-2 rounded text-xs font-bold border transition-colors ${form.resultado===v?"bg-[#3b82f6] border-[#3b82f6] text-white":"border-[#1e3a5f] text-[#4a6fa5] hover:text-white"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className={lc}>Zona da cobrança *</label>
                <div className="border-2 border-[#1e3a5f] rounded-lg overflow-hidden">
                  <div className="grid grid-cols-3">
                    {ZONES.map(z=>(
                      <button key={z.id} type="button" onClick={()=>setForm(f=>({...f,zona:z.id}))}
                        className={`py-3 text-xs font-medium border border-[#1e3a5f] transition-colors whitespace-pre-line leading-tight ${form.zona===z.id?"bg-[#3b82f6] text-white":"bg-[#0d1b2a] text-[#4a6fa5] hover:text-white"}`}>
                        {z.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-center bg-[#1e3a5f] py-1"><span className="text-[10px] text-[#4a6fa5]">⬛ Gol</span></div>
                </div>
              </div>

              <button onClick={addKick} disabled={saving}
                className={`w-full py-3 rounded-lg text-sm font-bold text-white transition-colors ${saving?"bg-[#1e3a5f] cursor-wait":"bg-[#3b82f6] hover:bg-blue-400"}`}>
                {saving ? "⏳ Salvando na nuvem..." : "+ Registrar Cobrança"}
              </button>
            </div>

            {kicks.length>0 && (
              <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-4">
                <p className="text-xs font-bold text-[#7fb3f5] uppercase mb-2">Últimas cobranças</p>
                <div className="space-y-1">
                  {kicks.slice(0,6).map(k=>(
                    <div key={k.id} className="flex items-center gap-2 text-sm bg-[#0d1b2a] rounded-lg px-3 py-2 border border-[#1e3a5f]">
                      {k.rodada && <span className="text-[10px] bg-[#1e3a5f] text-[#7fb3f5] px-1.5 rounded font-bold">R{k.rodada}</span>}
                      <span className="font-medium">{k.jogador}</span>
                      {k.camisa && <span className="text-[#4a6fa5] text-xs">#{k.camisa}</span>}
                      <span className="text-xs text-[#7fb3f5]">{ZONE_LABELS[k.zona]}</span>
                      <span className={`ml-auto text-xs font-semibold ${k.resultado==="gol"?"text-green-400":k.resultado==="defendido"?"text-orange-400":"text-red-400"}`}>
                        {k.resultado==="gol"?"✅":k.resultado==="defendido"?"🛑":"❌"}
                      </span>
                      <button onClick={()=>removeKick(k.id)} className="text-[#4a6fa5] hover:text-red-400 text-xs">✕</button>
                    </div>
                  ))}
                </div>
                {kicks.length>6 && <p className="text-xs text-[#4a6fa5] mt-2 text-center">+{kicks.length-6} no histórico</p>}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
