import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const QUARTERS = ["Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"];
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const BROKER_COLORS = ["#3B82F6", "#8B5CF6", "#06B6D4", "#F59E0B", "#EC4899"];
const COMMODITY_COLORS = ["#EF4444", "#F97316", "#EAB308", "#10B981", "#8B5CF6"];
const STORAGE_KEY = "fy26-financial-tracker:v1";

// ── Design tokens ──
const T = {
  sidebar: "#0D1117",
  sidebarBorder: "rgba(255,255,255,0.07)",
  bg: "#F0F4F8",
  card: "#FFFFFF",
  cardBorder: "#E8EDF3",
  cardShadow: "0 1px 4px rgba(15,23,42,0.06), 0 6px 24px rgba(15,23,42,0.04)",
  text: "#0F172A",
  textSub: "#64748B",
  textMuted: "#94A3B8",
  border: "#E2E8F0",
  rowAlt: "#FAFBFC",
  pos: "#059669",
  neg: "#DC2626",
  posLight: "#ECFDF5",
  negLight: "#FEF2F2",
  tableHead: "#F8FAFC",
};

const fmt = (n) => {
  if (n === 0 || n === undefined || n === null || isNaN(n)) return "—";
  const abs = Math.abs(n);
  const s = abs >= 10000000 ? `${(abs/10000000).toFixed(2)} Cr` : abs >= 100000 ? `${(abs/100000).toFixed(2)} L` : abs.toLocaleString("en-IN");
  return n < 0 ? `(${s})` : s;
};

const pct = (n) => (!n || isNaN(n)) ? "—" : `${(n * 100).toFixed(1)}%`;
const pnlColor = (n) => n > 0 ? T.pos : n < 0 ? T.neg : T.textMuted;

const initQuarterlyFnO = () => QUARTERS.map(() => ({ gross: 0, charges: 0, other: 0, remarks: "" }));
const initQuarterlyEquity = () => QUARTERS.map(() => ({
  stcg: 0,
  ltcg: 0,
  dividends: 0,
  charges: 0,
  other: 0,
  remarks: ""
}));
const initQuarterlyCommodity = () => QUARTERS.map(() => ({ gross: 0, charges: 0, other: 0, remarks: "" }));
const initCrypto = () => ({ spot: 0, derivatives: 0, airdrops: 0, spotTds: 0, derivTds: 0, airdropTds: 0 });
const initMonthBiz = () => MONTHS.map(() => ({ client: "", revenue: 0, expenses: 0, notes: "" }));
const createBroker = (id, name = `Broker ${id}`) => ({ id, name, quarters: initQuarterlyFnO() });
const createCommBroker = (id, name = `Exchange ${id}`) => ({ id, name, quarters: initQuarterlyCommodity() });
const fnoNet = (data) => data.map(q => q.gross - q.charges - q.other);
const fnoTotal = (data) => fnoNet(data).reduce((a, b) => a + b, 0);
const eqNet = (data) => data.map(q => (q.stcg || 0) + (q.ltcg || 0) + (q.dividends || 0) - (q.charges || 0) - (q.other || 0));
const eqTotal = (data) => eqNet(data).reduce((a, b) => a + b, 0);
const commNet = (data) => data.map(q => q.gross - q.charges - q.other);
const commTotal = (data) => commNet(data).reduce((a, b) => a + b, 0);

// ── Inputs ──
const NumberInput = ({ value, onChange, accent = false }) => {
  const [draft, setDraft] = useState(value === 0 ? "" : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value === 0 ? "" : String(value)); }, [value, focused]);
  const commit = (v) => {
    if (v === "" || v === "-" || v === "." || v === "-.") { onChange(0); return; }
    const p = Number(v);
    onChange(Number.isFinite(p) ? p : 0);
  };
  return (
    <input type="text" inputMode="decimal" value={draft} placeholder="0"
      onChange={e => {
        const v = e.target.value.replace(/,/g, "");
        if (/^-?\d*\.?\d*$/.test(v)) { setDraft(v); if (v !== "" && v !== "-" && v !== "." && v !== "-.") commit(v); }
      }}
      style={{
        background: focused ? "#FFFFFF" : "#F8FAFC",
        border: `1px solid ${focused ? "#3B82F6" : T.border}`,
        borderRadius: 8, color: accent ? "#2563EB" : T.text,
        padding: "8px 10px", width: "100%",
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
        outline: "none", textAlign: "right",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
        transition: "all 0.15s",
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); commit(draft); }}
      onWheel={e => e.currentTarget.blur()}
      onKeyDown={e => e.stopPropagation()}
    />
  );
};

const TextInput = ({ value, onChange, placeholder = "" }) => {
  const [draft, setDraft] = useState(value || "");
  const [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value || ""); }, [value, focused]);
  return (
    <input type="text" value={draft} placeholder={placeholder} autoComplete="off" spellCheck={false}
      onChange={e => { setDraft(e.target.value); onChange(e.target.value); }}
      style={{
        background: focused ? "#FFFFFF" : "#F8FAFC",
        border: `1px solid ${focused ? "#3B82F6" : T.border}`,
        borderRadius: 8, color: T.text, padding: "8px 10px", width: "100%",
        fontFamily: "'DM Sans', sans-serif", fontSize: 12, outline: "none",
        boxShadow: focused ? "0 0 0 3px rgba(59,130,246,0.12)" : "none",
        transition: "all 0.15s",
      }}
      onFocus={() => setFocused(true)}
      onBlur={() => { setFocused(false); onChange(draft); }}
      onKeyDown={e => e.stopPropagation()}
    />
  );
};

// ── Layout primitives ──
const Card = ({ children, style: s }) => (
  <div style={{
    background: T.card, borderRadius: 16,
    border: `1px solid ${T.cardBorder}`,
    boxShadow: T.cardShadow,
    overflow: "hidden", marginBottom: 20,
    ...s,
  }}>{children}</div>
);

const Table = ({ children }) => (
  <div style={{ overflowX: "auto" }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
  </div>
);

const TH = ({ children, w, left }) => (
  <th style={{
    padding: "10px 14px", fontSize: 11, fontWeight: 600, color: T.textSub,
    textTransform: "uppercase", letterSpacing: "0.5px",
    textAlign: left ? "left" : "right",
    fontFamily: "'DM Sans', sans-serif", width: w,
    background: T.tableHead, borderBottom: `1px solid ${T.border}`,
    whiteSpace: "nowrap",
  }}>{children}</th>
);

const TD = ({ children, color, bold, mono, left }) => (
  <td style={{
    padding: "9px 14px", fontSize: 13, color: color || T.text,
    fontWeight: bold ? 700 : 400, textAlign: left ? "left" : "right",
    fontFamily: mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
    borderBottom: `1px solid ${T.border}`,
  }}>{children}</td>
);

const TotalRow = ({ cells }) => (
  <tr style={{ background: "#F0F4F8" }}>
    {cells.map((c, i) => (
      <td key={i} style={{
        padding: "11px 14px", fontSize: 13, fontWeight: 700,
        color: c.color || T.text, textAlign: i === 0 ? "left" : "right",
        fontFamily: c.mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
        borderTop: `2px solid ${T.border}`,
      }}>{c.value}</td>
    ))}
  </tr>
);

// ── Section header — minimal bar style ──
const SectionHeader = ({ title, accent = "#3B82F6", action }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "18px 20px 14px", borderBottom: `1px solid ${T.border}`,
    marginBottom: 0,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 3, height: 18, borderRadius: 2, background: accent }} />
      <span style={{ fontSize: 13, fontWeight: 700, color: T.text, letterSpacing: "0.2px", fontFamily: "'DM Sans', sans-serif", textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {title}
      </span>
    </div>
    {action}
  </div>
);

// ── Broker tables ──
const BrokerTable = ({ broker, accent, brokerCount, onUpdate, onUpdateName, onRemove, netFn, totalFn }) => {
  const nets = netFn(broker.quarters);
  const totGross = broker.quarters.reduce((a, q) => a + q.gross, 0);
  const totCharges = broker.quarters.reduce((a, q) => a + q.charges, 0);
  const totOther = broker.quarters.reduce((a, q) => a + q.other, 0);
  const totNet = totalFn(broker.quarters);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 20px 10px", flexWrap: "wrap" }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: accent, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 180, maxWidth: 280 }}>
          <TextInput value={broker.name} onChange={v => onUpdateName(broker.id, v)} placeholder="Broker / Exchange name" />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: pnlColor(totNet) }}>
            {fmt(totNet)}
          </span>
          {brokerCount > 1 && (
            <button onClick={() => onRemove(broker.id)} style={{
              border: `1px solid ${T.border}`, background: "transparent", color: T.neg,
              borderRadius: 6, padding: "5px 10px", fontSize: 11, fontWeight: 600,
              cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>Remove</button>
          )}
        </div>
      </div>
      <Table>
        <thead>
          <tr>
            <TH left w="140px">Quarter</TH>
            <TH>Gross PnL</TH><TH>Charges</TH><TH>Other Costs</TH>
            <TH>Net PnL</TH><TH w="140px">Remarks</TH>
          </tr>
        </thead>
        <tbody>
          {QUARTERS.map((q, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? T.card : T.rowAlt }}>
              <TD left><span style={{ color: T.textSub, fontSize: 12 }}>{q}</span></TD>
              <TD><NumberInput value={broker.quarters[i].gross} onChange={v => onUpdate(broker.id, i, "gross", v)} accent /></TD>
              <TD><NumberInput value={broker.quarters[i].charges} onChange={v => onUpdate(broker.id, i, "charges", v)} /></TD>
              <TD><NumberInput value={broker.quarters[i].other} onChange={v => onUpdate(broker.id, i, "other", v)} /></TD>
              <TD color={pnlColor(nets[i])} bold mono>{fmt(nets[i])}</TD>
              <TD><TextInput value={broker.quarters[i].remarks} onChange={v => onUpdate(broker.id, i, "remarks", v)} placeholder="Notes" /></TD>
            </tr>
          ))}
          <TotalRow cells={[
            { value: `${broker.name} Total` },
            { value: fmt(totGross), color: T.textMuted, mono: true },
            { value: fmt(totCharges), color: T.textMuted, mono: true },
            { value: fmt(totOther), color: T.textMuted, mono: true },
            { value: fmt(totNet), color: pnlColor(totNet), mono: true },
            { value: "" },
          ]} />
        </tbody>
      </Table>
    </div>
  );
};

// ── Equity table ──
const EquityTable = ({ data, setter, label, onUpdateEq }) => {
  const nets = eqNet(data);
  const tot = eqTotal(data);
  const totStcg = data.reduce((a, q) => a + (q.stcg || 0), 0);
  const totLtcg = data.reduce((a, q) => a + (q.ltcg || 0), 0);
  const totDiv = data.reduce((a, q) => a + (q.dividends || 0), 0);
  const totChrg = data.reduce((a, q) => a + (q.charges || 0), 0);
  const totOther = data.reduce((a, q) => a + (q.other || 0), 0);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px 10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{label}</span>
        </div>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 15, fontWeight: 700, color: pnlColor(tot) }}>{fmt(tot)}</span>
      </div>
      <Table>
        <thead><tr>
          <TH left w="140px">Quarter</TH>
          <TH>STCG</TH><TH>LTCG</TH><TH>Dividends</TH><TH>Charges</TH><TH>Other Costs</TH><TH>Net PnL</TH><TH w="120px">Remarks</TH>
        </tr></thead>
        <tbody>
          {QUARTERS.map((q, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? T.card : T.rowAlt }}>
              <TD left><span style={{ color: T.textSub, fontSize: 12 }}>{q}</span></TD>
              <TD><NumberInput value={data[i].stcg || 0} onChange={v => onUpdateEq(setter, i, "stcg", v)} accent /></TD>
              <TD><NumberInput value={data[i].ltcg || 0} onChange={v => onUpdateEq(setter, i, "ltcg", v)} /></TD>
              <TD><NumberInput value={data[i].dividends || 0} onChange={v => onUpdateEq(setter, i, "dividends", v)} /></TD>
              <TD><NumberInput value={data[i].charges || 0} onChange={v => onUpdateEq(setter, i, "charges", v)} /></TD>
              <TD><NumberInput value={data[i].other || 0} onChange={v => onUpdateEq(setter, i, "other", v)} /></TD>
              <TD color={pnlColor(nets[i])} bold mono>{fmt(nets[i])}</TD>
              <TD><TextInput value={data[i].remarks} onChange={v => onUpdateEq(setter, i, "remarks", v)} placeholder="Notes" /></TD>
            </tr>
          ))}
          <TotalRow cells={[
            { value: "Total" },
            { value: fmt(totStcg), color: T.textMuted, mono: true },
            { value: fmt(totLtcg), color: T.textMuted, mono: true },
            { value: fmt(totDiv), color: T.textMuted, mono: true },
            { value: fmt(totChrg), color: T.textMuted, mono: true },
            { value: fmt(totOther), color: T.textMuted, mono: true },
            { value: fmt(tot), color: pnlColor(tot), mono: true },
            { value: "" },
          ]} />
        </tbody>
      </Table>
    </div>
  );
};

// ── Stat card ──
const StatCard = ({ label, value, color, accent, sub }) => (
  <div style={{
    background: T.card, borderRadius: 14, padding: "16px 18px",
    border: `1px solid ${T.cardBorder}`,
    boxShadow: T.cardShadow,
    flex: "1 1 150px", minWidth: 140,
    borderTop: `3px solid ${accent || color || T.border}`,
  }}>
    <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color || T.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
  </div>
);

// ── KPI strip ──
const KPIStrip = ({ items }) => (
  <Card style={{ marginBottom: 20 }}>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${items.length}, 1fr)`, minWidth: 0 }}>
      {items.map((item, i) => (
        <div key={item.label} style={{
          padding: "18px 20px",
          borderRight: i < items.length - 1 ? `1px solid ${T.border}` : "none",
        }}>
          <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{item.label}</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: item.color || T.text, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.5px" }}>{item.value}</div>
          {item.sub && <div style={{ fontSize: 11, color: T.textMuted, marginTop: 4, fontFamily: "'DM Sans', sans-serif" }}>{item.sub}</div>}
        </div>
      ))}
    </div>
  </Card>
);

// ── Combined total bar ──
const TotalBar = ({ label, total, quarters, accent }) => (
  <div style={{
    margin: "0 20px 20px",
    background: `linear-gradient(135deg, ${accent}0A, ${accent}05)`,
    border: `1px solid ${accent}22`,
    borderRadius: 12, padding: "14px 18px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    flexWrap: "wrap", gap: 12,
  }}>
    <div>
      <div style={{ fontSize: 11, color: T.textSub, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: pnlColor(total), fontFamily: "'JetBrains Mono', monospace" }}>{fmt(total)}</div>
    </div>
    <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
      {QUARTERS.map((q, qi) => (
        <div key={q}>
          <div style={{ fontSize: 10, color: T.textMuted, marginBottom: 3 }}>{q.replace(" (", "\n(")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: pnlColor(quarters[qi]), fontFamily: "'JetBrains Mono', monospace" }}>{fmt(quarters[qi])}</div>
        </div>
      ))}
    </div>
  </div>
);

// ── Nav items ──
const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard",  accent: "#10B981", icon: "◈" },
  { id: "fno",       label: "F&O PnL",    accent: "#3B82F6", icon: "▲" },
  { id: "equity",    label: "Equity",     accent: "#10B981", icon: "◉" },
  { id: "crypto",    label: "Crypto",     accent: "#F59E0B", icon: "◆" },
  { id: "commodity", label: "Commodity",  accent: "#EF4444", icon: "◎" },
  { id: "business",  label: "Business",   accent: "#06B6D4", icon: "◇" },
];

const PRINT_STYLES = `
  .print-only { display: none !important; }
  .mobile-bar  { display: none !important; }
@media print {
  body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  nav, #pdf-toolbar { display: none !important; }
  .screen-only { display: none !important; }
  .print-only  { display: block !important; }
  main { margin: 0 !important; padding: 12px 20px !important; overflow: visible !important; }
  .card-no-break { page-break-inside: avoid; }
  @page { margin: 10mm; size: A4 landscape; }
}
@media (max-width: 767px) {
  .mobile-bar { display: flex !important; }
}
`;

// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const fileInputRef = useRef(null);
  const scrollRef    = useRef(null);
  const brokerIdRef  = useRef(2);
  const commBrokerIdRef = useRef(2);

  const [activeTab,   setActiveTab]   = useState("dashboard");
  const [userName,    setUserName]    = useState("User");
  const [editingName, setEditingName] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [navOpen,     setNavOpen]     = useState(false);
  const [isMobile,    setIsMobile]    = useState(() => typeof window !== "undefined" && window.innerWidth < 768);

  const [fnoBrokers,  setFnoBrokers]  = useState([createBroker(1, "Primary Broker")]);
  const [eqYou,       setEqYou]       = useState(initQuarterlyEquity());
  const [crypto,      setCrypto]      = useState(initCrypto());
  const [biz,         setBiz]         = useState(initMonthBiz());
  const [commBrokers, setCommBrokers] = useState([createCommBroker(1, "MCX")]);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const handleTabChange = (id) => {
    setActiveTab(id);
    if (isMobile) setNavOpen(false);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  };

  // Persist & restore
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.userName === "string") setUserName(d.userName);
      if (Array.isArray(d.fnoBrokers) && d.fnoBrokers.length) {
        setFnoBrokers(d.fnoBrokers);
        brokerIdRef.current = Math.max(...d.fnoBrokers.map(b => b.id || 0), 1) + 1;
      }
      if (Array.isArray(d.eqYou) && d.eqYou.length === QUARTERS.length) setEqYou(d.eqYou);
      if (d.crypto && typeof d.crypto === "object") setCrypto(d.crypto);
      if (Array.isArray(d.biz) && d.biz.length === MONTHS.length) setBiz(d.biz);
      if (Array.isArray(d.commBrokers) && d.commBrokers.length) {
        setCommBrokers(d.commBrokers);
        commBrokerIdRef.current = Math.max(...d.commBrokers.map(b => b.id || 0), 1) + 1;
      }
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const on = () => setIsPrintMode(true);
    const off = () => setIsPrintMode(false);
    window.addEventListener("beforeprint", on);
    window.addEventListener("afterprint", off);
    return () => { window.removeEventListener("beforeprint", on); window.removeEventListener("afterprint", off); };
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ userName, fnoBrokers, eqYou, crypto, biz, commBrokers })); }
    catch (e) { console.error(e); }
  }, [userName, fnoBrokers, eqYou, crypto, biz, commBrokers]);

  // ── Computed ──
  const fnoGrossTotal   = fnoBrokers.reduce((s, b) => s + b.quarters.reduce((a, q) => a + q.gross, 0), 0);
  const fnoChargesTotal = fnoBrokers.reduce((s, b) => s + b.quarters.reduce((a, q) => a + q.charges, 0), 0);
  const fnoOtherTotal   = fnoBrokers.reduce((s, b) => s + b.quarters.reduce((a, q) => a + q.other, 0), 0);
  const fnoQuarterTotals = QUARTERS.map((_, qi) => fnoBrokers.reduce((s, b) => s + fnoNet(b.quarters)[qi], 0));
  const fnoCombinedTotal = fnoBrokers.reduce((s, b) => s + fnoTotal(b.quarters), 0);

  // eslint-disable-next-line no-shadow
  // eqNet and eqTotal are now defined globally and use the correct fields
  const eqChargesTotal  = eqYou.reduce((s, q) => s + (q.charges || 0), 0);
  const eqGrossRealised = eqYou.reduce((s, q) => s + (q.stcg || 0) + (q.ltcg || 0) + (q.dividends || 0), 0);

  const cryptoNets = useMemo(() => ({
    spot:  crypto.spot  - crypto.spotTds,
    deriv: crypto.derivatives - crypto.derivTds,
    air:   crypto.airdrops   - crypto.airdropTds,
    total: (crypto.spot - crypto.spotTds) + (crypto.derivatives - crypto.derivTds) + (crypto.airdrops - crypto.airdropTds),
  }), [crypto]);

  const bizMonthNet    = biz.map(m => m.revenue - m.expenses);
  const bizQtrs        = [0,1,2,3].map(q => bizMonthNet.slice(q*3, q*3+3).reduce((a,b) => a+b, 0));
  const bizTotal       = bizMonthNet.reduce((a, b) => a + b, 0);
  const bizRevenueTotal = biz.reduce((s, m) => s + m.revenue, 0);
  const bizExpenseTotal = biz.reduce((s, m) => s + m.expenses, 0);

  const commGrossTotal   = commBrokers.reduce((s, b) => s + b.quarters.reduce((a, q) => a + q.gross, 0), 0);
  const commChargesTotal = commBrokers.reduce((s, b) => s + b.quarters.reduce((a, q) => a + q.charges, 0), 0);
  const commOtherTotal   = commBrokers.reduce((s, b) => s + b.quarters.reduce((a, q) => a + q.other, 0), 0);
  const commQuarterTotals = QUARTERS.map((_, qi) => commBrokers.reduce((s, b) => s + commNet(b.quarters)[qi], 0));
  const commCombinedTotal = commBrokers.reduce((s, b) => s + commTotal(b.quarters), 0);

  const cryptoGrossTotal = crypto.spot + crypto.derivatives + crypto.airdrops;
  const cryptoTaxTotal   = crypto.spotTds + crypto.derivTds + crypto.airdropTds;
  const totalChargesAndTaxes = fnoChargesTotal + eqChargesTotal + cryptoTaxTotal + commChargesTotal;
  const totalOtherDebits     = fnoOtherTotal + bizExpenseTotal + commOtherTotal;
  const grossRealised        = fnoGrossTotal + eqGrossRealised + cryptoGrossTotal + bizRevenueTotal + commGrossTotal;

  const totalIncome = useMemo(() =>
    fnoCombinedTotal + eqTotal(eqYou) + cryptoNets.total + bizTotal + commCombinedTotal,
  [fnoCombinedTotal, eqYou, cryptoNets, bizTotal, commCombinedTotal]);

  // ── Handlers ──
  const updateFnO = (id, qi, f, v) => setFnoBrokers(p => p.map(b => b.id !== id ? b : { ...b, quarters: b.quarters.map((q, i) => i === qi ? { ...q, [f]: v } : q) }));
  const updateBrokerName = (id, name) => setFnoBrokers(p => p.map(b => b.id === id ? { ...b, name } : b));
  const addBroker = () => { const id = brokerIdRef.current++; setFnoBrokers(p => [...p, createBroker(id)]); };
  const removeBroker = (id) => setFnoBrokers(p => p.length === 1 ? p : p.filter(b => b.id !== id));

  const updateEq = (setter, qi, f, v) => setter(p => p.map((q, i) => i === qi ? { ...q, [f]: v } : q));
  const updateBiz = (mi, f, v) => setBiz(p => p.map((m, i) => i === mi ? { ...m, [f]: v } : m));

  const updateComm = (id, qi, f, v) => setCommBrokers(p => p.map(b => b.id !== id ? b : { ...b, quarters: b.quarters.map((q, i) => i === qi ? { ...q, [f]: v } : q) }));
  const updateCommBrokerName = (id, name) => setCommBrokers(p => p.map(b => b.id === id ? { ...b, name } : b));
  const addCommBroker = () => { const id = commBrokerIdRef.current++; setCommBrokers(p => [...p, createCommBroker(id)]); };
  const removeCommBroker = (id) => setCommBrokers(p => p.length === 1 ? p : p.filter(b => b.id !== id));

  const resetAllData = useCallback(() => {
    setUserName("User"); setEditingName(false);
    setFnoBrokers([createBroker(1, "Primary Broker")]); setEqYou(initQuarterlyEquity());
    setCrypto(initCrypto()); setBiz(initMonthBiz());
    setCommBrokers([createCommBroker(1, "MCX")]);
    brokerIdRef.current = 2; commBrokerIdRef.current = 2;
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), version: 1, data: { userName, fnoBrokers, eqYou, crypto, biz, commBrokers } }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fy26-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(url);
  }, [userName, fnoBrokers, eqYou, crypto, biz, commBrokers]);

  const importData = useCallback((e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const d = parsed?.data ?? parsed;
        if (typeof d.userName === "string") setUserName(d.userName);
        if (Array.isArray(d.fnoBrokers) && d.fnoBrokers.length) { setFnoBrokers(d.fnoBrokers); brokerIdRef.current = Math.max(...d.fnoBrokers.map(b => b.id||0), 1) + 1; }
        if (Array.isArray(d.eqYou) && d.eqYou.length === QUARTERS.length) {
          // Migrate old equity data if needed
          const migrated = d.eqYou.map(q => {
            if (q.stcg === undefined && q.ltcg === undefined && q.dividends === undefined) {
              // Old format: only gross, charges, other, remarks
              return {
                stcg: q.gross || 0,
                ltcg: 0,
                dividends: 0,
                charges: q.charges || 0,
                other: q.other || 0,
                remarks: q.remarks || ""
              };
            }
            return {
              stcg: q.stcg || 0,
              ltcg: q.ltcg || 0,
              dividends: q.dividends || 0,
              charges: q.charges || 0,
              other: q.other || 0,
              remarks: q.remarks || ""
            };
          });
          setEqYou(migrated);
        }
        if (d.crypto) setCrypto(d.crypto);
        if (Array.isArray(d.biz) && d.biz.length === MONTHS.length) setBiz(d.biz);
        if (Array.isArray(d.commBrokers) && d.commBrokers.length) { setCommBrokers(d.commBrokers); commBrokerIdRef.current = Math.max(...d.commBrokers.map(b => b.id||0), 1) + 1; }
      } catch { window.alert("Invalid file. Please choose a valid tracker JSON export."); }
      finally { e.target.value = ""; }
    };
    reader.readAsText(file);
  }, []);

  const reportDate = useMemo(() => new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }), []);
  const handleDownloadPDF = () => { setIsPrintMode(true); setActiveTab("dashboard"); window.setTimeout(() => window.print(), 80); };

  // ── Sidebar ──
  const Sidebar = () => (
    <nav style={{
      width: 244,
      background: T.sidebar,
      display: "flex",
      flexDirection: "column",
      height: "100vh",
      overflow: "hidden",
      ...(isMobile ? {
        position: "fixed", top: 0, right: 0, left: "auto",
        zIndex: 1000, width: 264,
        transform: navOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
        boxShadow: navOpen ? "-8px 0 40px rgba(0,0,0,0.4)" : "none",
        overflowY: "auto",
      } : {
        position: "fixed", top: 0, left: 0,
        zIndex: 100,
        boxShadow: "1px 0 0 rgba(255,255,255,0.04)",
      }),
    }}>
      {/* Brand */}
      <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${T.sidebarBorder}` }}>
        {isMobile && (
          <button onClick={() => setNavOpen(false)} style={{
            float: "right", background: "none", border: "none",
            color: "#64748B", fontSize: 16, cursor: "pointer", padding: "2px 4px",
          }}>✕</button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #10B981, #3B82F6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 800, color: "#fff",
          }}>₹</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.3px" }}>FY 2025-26</div>
            <div style={{ fontSize: 10, color: "#475569", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase" }}>Finance Tracker</div>
          </div>
        </div>

        {/* User */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, #3B82F6, #8B5CF6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          {editingName ? (
            <input autoFocus value={userName}
              onChange={e => setUserName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={e => e.key === "Enter" && setEditingName(false)}
              style={{ background: "transparent", border: "none", color: "#F1F5F9", fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%" }}
            />
          ) : (
            <span style={{ fontSize: 13, fontWeight: 600, color: "#E2E8F0", flex: 1 }}>{userName}</span>
          )}
          <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 11, padding: 2, lineHeight: 1, flexShrink: 0 }}>✏</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "12px 10px", flex: 1 }}>
        <div style={{ fontSize: 9, color: "#334155", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", padding: "4px 10px 10px" }}>Navigation</div>
        {NAV_ITEMS.map(item => {
          const active = activeTab === item.id;
          return (
            <button key={item.id} onClick={() => handleTabChange(item.id)} style={{
              width: "100%", background: active ? `${item.accent}15` : "transparent",
              border: "none",
              borderRadius: 8,
              padding: "9px 12px",
              display: "flex", alignItems: "center", gap: 10,
              cursor: "pointer",
              marginBottom: 2,
              transition: "all 0.15s",
            }}>
              <div style={{ width: 3, height: 16, borderRadius: 2, background: active ? item.accent : "transparent", flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: active ? "#EAF4FF" : "#94A3B8", fontWeight: active ? 700 : 500, fontFamily: "'DM Sans', sans-serif", flex: 1, textAlign: "left" }}>
                {item.label}
              </span>
              {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: item.accent, flexShrink: 0 }} />}
            </button>
          );
        })}
      </div>

      {/* Bottom toolbar */}
      <div id="pdf-toolbar" style={{ padding: "16px 14px", borderTop: `1px solid ${T.sidebarBorder}` }}>
        <button onClick={handleDownloadPDF} style={{
          width: "100%", padding: "10px", borderRadius: 8, border: "none",
          background: "linear-gradient(135deg, #3B82F6, #6D28D9)",
          color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer",
          fontFamily: "'DM Sans', sans-serif",
          marginBottom: 8,
        }}>
          Download PDF Report
        </button>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          {[["Export", exportData], ["Import", () => fileInputRef.current?.click()]].map(([label, fn]) => (
            <button key={label} onClick={fn} style={{
              padding: "8px", borderRadius: 7, border: `1px solid ${T.sidebarBorder}`,
              background: "rgba(255,255,255,0.04)", color: "#94A3B8",
              fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}>{label} JSON</button>
          ))}
        </div>
        <button onClick={resetAllData} style={{
          width: "100%", padding: "7px", borderRadius: 7,
          border: "1px solid rgba(239,68,68,0.2)",
          background: "rgba(239,68,68,0.08)", color: "#F87171",
          fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
        }}>Reset All Data</button>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={importData} style={{ display: "none" }} />
        <div style={{ marginTop: 10, fontSize: 10, color: "#334155", textAlign: "center" }}>Data saved in browser localStorage</div>
      </div>
    </nav>
  );

  // ── Add button ──
  const AddBtn = ({ onClick, label, color }) => (
    <button onClick={onClick} style={{
      border: `1px solid ${color}40`, background: `${color}10`,
      color: color, borderRadius: 7, padding: "7px 14px",
      fontSize: 12, fontWeight: 700, cursor: "pointer",
      fontFamily: "'DM Sans', sans-serif",
    }}>{label}</button>
  );

  // ── Section page wrapper ──
  const PageTitle = ({ title, sub }) => (
    <div style={{ marginBottom: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: T.text, letterSpacing: "-0.5px" }}>{title}</h1>
      {sub && <p style={{ fontSize: 13, color: T.textSub, margin: "4px 0 0" }}>{sub}</p>}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      fontFamily: "'DM Sans', sans-serif",
      color: T.text,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700;9..40,800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Mobile backdrop */}
      {isMobile && navOpen && (
        <div onClick={() => setNavOpen(false)} style={{
          position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 999,
          backdropFilter: "blur(2px)",
        }} />
      )}

      <Sidebar />

      {/* Main */}
      <main ref={scrollRef} style={{
        marginLeft: isMobile ? 0 : 244,
        minHeight: "100vh",
        overflow: "auto",
        padding: isMobile ? "0 14px 32px" : "32px 36px",
      }}>

        {/* Mobile top bar */}
        <div className="mobile-bar" style={{
          display: "none",
          justifyContent: "space-between", alignItems: "center",
          padding: "16px 2px 18px",
          borderBottom: `1px solid ${T.border}`,
          marginBottom: 22,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>FY 2025-26</div>
            <div style={{ fontSize: 11, color: T.textSub }}>Finance Tracker</div>
          </div>
          <button onClick={() => setNavOpen(true)} aria-label="Open menu" style={{
            background: T.sidebar, border: "none", borderRadius: 10,
            padding: "10px 12px", cursor: "pointer",
            display: "flex", flexDirection: "column", gap: 4.5,
            alignItems: "center",
          }}>
            {[0,1,2].map(i => <span key={i} style={{ display: "block", width: 18, height: 2, background: "#94A3B8", borderRadius: 1 }} />)}
          </button>
        </div>

        {/* Print header */}
        {isPrintMode && (
          <div className="print-only" style={{
            marginBottom: 24, padding: "18px 24px", borderRadius: 12,
            background: T.sidebar, border: `1px solid ${T.sidebarBorder}`,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: "#F1F5F9" }}>FY 2025-26 Financial Tracker</div>
                <div style={{ marginTop: 4, fontSize: 13, color: "#64748B" }}>Consolidated report for {userName}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "#64748B" }}>Net Realised P&L</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: pnlColor(totalIncome) }}>{fmt(totalIncome)}</div>
                <div style={{ fontSize: 11, color: "#64748B", marginTop: 4 }}>{reportDate}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── DASHBOARD ── */}
        {(activeTab === "dashboard" || isPrintMode) && (
          <>
            <PageTitle
              title={`${userName}'s Dashboard`}
              sub="FY 2025-26 · Consolidated Financial Overview"
            />

            {/* KPI strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Net Realised P&L", value: fmt(totalIncome), color: pnlColor(totalIncome), accent: pnlColor(totalIncome) },
                { label: "Gross Realised",   value: fmt(grossRealised), color: T.text, accent: "#3B82F6" },
                { label: "Charges & Taxes",  value: fmt(totalChargesAndTaxes), color: T.textSub, accent: "#6366F1" },
                { label: "Other Debits",     value: fmt(totalOtherDebits), color: T.textSub, accent: "#F59E0B" },
                { label: "Unrealised P&L",   value: "—", color: T.textMuted, accent: T.textMuted },
              ].map(k => <StatCard key={k.label} {...k} />)}
            </div>

            {/* Segment stat cards */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
              {[
                { label: "F&O",       value: fmt(fnoCombinedTotal),    color: pnlColor(fnoCombinedTotal),    accent: "#3B82F6" },
                { label: "Equity",    value: fmt(eqTotal(eqYou)),      color: pnlColor(eqTotal(eqYou)),      accent: "#10B981" },
                { label: "Crypto",    value: fmt(cryptoNets.total),     color: pnlColor(cryptoNets.total),     accent: "#F59E0B" },
                { label: "Commodity", value: fmt(commCombinedTotal),   color: pnlColor(commCombinedTotal),   accent: "#EF4444" },
                { label: "Business",  value: fmt(bizTotal),             color: pnlColor(bizTotal),             accent: "#06B6D4" },
              ].map(s => <StatCard key={s.label} {...s} />)}
            </div>

            {/* Income streams table */}
            <Card>
              <SectionHeader title="Income Streams — Quarterly Breakdown" accent="#10B981" />
              <Table>
                <thead>
                  <tr>
                    <TH left>Stream</TH>
                    <TH>Q1 Apr–Jun</TH><TH>Q2 Jul–Sep</TH><TH>Q3 Oct–Dec</TH><TH>Q4 Jan–Mar</TH>
                    <TH>FY Total</TH><TH>Share</TH>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { name: `F&O`,       qtrs: fnoQuarterTotals,    color: "#3B82F6" },
                    { name: `Equity`,    qtrs: eqNet(eqYou),        color: "#10B981" },
                    { name: "Crypto",    qtrs: [cryptoNets.total, 0, 0, 0], color: "#F59E0B" },
                    { name: "Commodity", qtrs: commQuarterTotals,   color: "#EF4444" },
                    { name: "Business",  qtrs: bizQtrs,             color: "#06B6D4" },
                  ].map((s, i) => {
                    const total = s.qtrs.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? T.card : T.rowAlt }}>
                        <TD left>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                            <span style={{ fontWeight: 500 }}>{s.name}</span>
                          </div>
                        </TD>
                        {s.qtrs.map((v, qi) => <TD key={qi} color={pnlColor(v)} mono>{fmt(v)}</TD>)}
                        <TD color={pnlColor(total)} bold mono>{fmt(total)}</TD>
                        <TD>
                          {total !== 0 && totalIncome !== 0 && (
                            <span style={{
                              background: total >= 0 ? T.posLight : T.negLight,
                              color: pnlColor(total), borderRadius: 4,
                              padding: "2px 6px", fontSize: 11, fontWeight: 600,
                            }}>{pct(total / totalIncome)}</span>
                          )}
                        </TD>
                      </tr>
                    );
                  })}
                  <TotalRow cells={[
                    { value: "TOTAL" },
                    ...QUARTERS.map((_, qi) => {
                      const v = fnoQuarterTotals[qi] + eqNet(eqYou)[qi] + (qi === 0 ? cryptoNets.total : 0) + commQuarterTotals[qi] + bizQtrs[qi];
                      return { value: fmt(v), color: pnlColor(v), mono: true };
                    }),
                    { value: fmt(totalIncome), color: pnlColor(totalIncome), mono: true },
                    { value: "" },
                  ]} />
                </tbody>
              </Table>
            </Card>
          </>
        )}

        {/* ── F&O ── */}
        {(activeTab === "fno" || isPrintMode) && (
          <>
            <PageTitle title="F&O PnL" sub="Futures & Options — quarterly by broker" />
            <Card>
              <SectionHeader
                title={`${userName} — F&O by Broker`}
                accent="#3B82F6"
                action={!isPrintMode && <AddBtn onClick={addBroker} label="+ Add Broker" color="#3B82F6" />}
              />
              <div style={{ padding: "4px 0" }}>
                {fnoBrokers.map((b, i) => (
                  <div key={b.id} style={{ borderBottom: i < fnoBrokers.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <BrokerTable broker={b} accent={BROKER_COLORS[i % BROKER_COLORS.length]}
                      brokerCount={fnoBrokers.length}
                      onUpdate={updateFnO} onUpdateName={updateBrokerName} onRemove={removeBroker}
                      netFn={fnoNet} totalFn={fnoTotal}
                    />
                  </div>
                ))}
              </div>
              <TotalBar label="Combined F&O Total" total={fnoCombinedTotal} quarters={fnoQuarterTotals} accent="#3B82F6" />
            </Card>
          </>
        )}

        {/* ── EQUITY ── */}
        {(activeTab === "equity" || isPrintMode) && (
          <>
        
            <PageTitle title="Equity PnL" sub="Realized equity gains, charges and dividends" />
            <Card >
              <SectionHeader title={`${userName} — Equity`} accent="#10B981" />
              <div style={{ padding: "12px 12px" }}>
              <EquityTable data={eqYou} setter={setEqYou} label={userName} onUpdateEq={updateEq} />
              </div>
              <TotalBar label="Combined Equity Total" total={eqTotal(eqYou)} quarters={eqNet(eqYou)} accent="#10B981" />
            </Card>
          </>
        )}

        {/* ── CRYPTO ── */}
        {(activeTab === "crypto" || isPrintMode) && (
          <>
            <PageTitle title="Crypto PnL" sub="Section 115BBH — taxed at 30% flat" />
            <Card>
              <SectionHeader title="Annual Summary" accent="#F59E0B" />
              <Table>
                <thead><tr>
                  <TH left>Category</TH>
                  <TH>Gross PnL</TH><TH>TDS Paid (1%)</TH><TH>Net PnL</TH>
                </tr></thead>
                <tbody>
                  {[
                    { name: "Spot Trading",       gKey: "spot",        tKey: "spotTds",  net: cryptoNets.spot },
                    { name: "Derivatives",         gKey: "derivatives", tKey: "derivTds", net: cryptoNets.deriv },
                    { name: "Airdrops / Staking",  gKey: "airdrops",    tKey: "airdropTds", net: cryptoNets.air },
                  ].map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? T.card : T.rowAlt }}>
                      <TD left>{row.name}</TD>
                      <TD><NumberInput value={crypto[row.gKey]} onChange={v => setCrypto(p => ({ ...p, [row.gKey]: v }))} accent /></TD>
                      <TD><NumberInput value={crypto[row.tKey]} onChange={v => setCrypto(p => ({ ...p, [row.tKey]: v }))} /></TD>
                      <TD color={pnlColor(row.net)} bold mono>{fmt(row.net)}</TD>
                    </tr>
                  ))}
                  <TotalRow cells={[
                    { value: "Total" },
                    { value: fmt(cryptoGrossTotal), color: T.textMuted, mono: true },
                    { value: fmt(cryptoTaxTotal),   color: T.textMuted, mono: true },
                    { value: fmt(cryptoNets.total), color: pnlColor(cryptoNets.total), mono: true },
                  ]} />
                </tbody>
              </Table>
              <div style={{ margin: "12px 20px 18px", padding: "10px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, fontSize: 12, color: "#92400E", lineHeight: 1.6 }}>
                <strong>§ 115BBH:</strong> Crypto gains taxed at 30% + 4% cess. No set-off against other income. 1% TDS on transactions above threshold.
              </div>
            </Card>
          </>
        )}

        {/* ── COMMODITY ── */}
        {(activeTab === "commodity" || isPrintMode) && (
          <>
            <PageTitle title="Commodity PnL" sub="MCX · NCDEX — non-speculative business income under §43(5)" />
            <Card>
              <SectionHeader
                title="Commodity Trading — by Broker"
                accent="#EF4444"
                action={!isPrintMode && <AddBtn onClick={addCommBroker} label="+ Add Broker" color="#EF4444" />}
              />
              <div style={{ padding: "4px 0" }}>
                {commBrokers.map((b, i) => (
                  <div key={b.id} style={{ borderBottom: i < commBrokers.length - 1 ? `1px solid ${T.border}` : "none" }}>
                    <BrokerTable broker={b} accent={COMMODITY_COLORS[i % COMMODITY_COLORS.length]}
                      brokerCount={commBrokers.length}
                      onUpdate={updateComm} onUpdateName={updateCommBrokerName} onRemove={removeCommBroker}
                      netFn={commNet} totalFn={commTotal}
                    />
                  </div>
                ))}
              </div>
              <TotalBar label="Combined Commodity Total" total={commCombinedTotal} quarters={commQuarterTotals} accent="#EF4444" />
              <div style={{ margin: "0 20px 18px", padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12, color: "#991B1B", lineHeight: 1.6 }}>
                <strong>§ 43(5):</strong> Commodity derivatives are non-speculative business income. STT/CTT deductible. Losses can be set off against other business income.
              </div>
            </Card>
          </>
        )}

        {/* ── BUSINESS ── */}
        {(activeTab === "business" || isPrintMode) && (
          <>
            <PageTitle title="Business / Freelance" sub="Monthly revenue and expense log" />
            <Card>
              <SectionHeader title="Monthly Log" accent="#06B6D4" />
              <Table>
                <thead><tr>
                  <TH left>Month</TH>
                  <TH left w="140px">Client / Source</TH>
                  <TH>Revenue</TH><TH>Expenses</TH><TH>Net Profit</TH>
                  <TH left w="120px">Notes</TH>
                </tr></thead>
                <tbody>
                  {MONTHS.map((m, i) => {
                    const net = biz[i].revenue - biz[i].expenses;
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? T.card : T.rowAlt }}>
                        <TD left><span style={{ color: T.textSub, fontSize: 12 }}>{m} {i < 9 ? "2025" : "2026"}</span></TD>
                        <TD left><TextInput value={biz[i].client} onChange={v => updateBiz(i, "client", v)} placeholder="Client" /></TD>
                        <TD><NumberInput value={biz[i].revenue} onChange={v => updateBiz(i, "revenue", v)} accent /></TD>
                        <TD><NumberInput value={biz[i].expenses} onChange={v => updateBiz(i, "expenses", v)} /></TD>
                        <TD color={pnlColor(net)} bold mono>{fmt(net)}</TD>
                        <TD left><TextInput value={biz[i].notes} onChange={v => updateBiz(i, "notes", v)} placeholder="Notes" /></TD>
                      </tr>
                    );
                  })}
                  <TotalRow cells={[
                    { value: "FY TOTAL" }, { value: "" },
                    { value: fmt(bizRevenueTotal), color: T.textMuted, mono: true },
                    { value: fmt(bizExpenseTotal), color: T.textMuted, mono: true },
                    { value: fmt(bizTotal), color: pnlColor(bizTotal), mono: true },
                    { value: "" },
                  ]} />
                </tbody>
              </Table>
            </Card>

            <Card>
              <SectionHeader title="Quarterly Breakdown" accent="#06B6D4" />
              <Table>
                <thead><tr>
                  <TH left>Quarter</TH><TH>Revenue</TH><TH>Expenses</TH><TH>Net Profit</TH>
                </tr></thead>
                <tbody>
                  {QUARTERS.map((q, qi) => {
                    const rev = biz.slice(qi*3, qi*3+3).reduce((a,m) => a+m.revenue, 0);
                    const exp = biz.slice(qi*3, qi*3+3).reduce((a,m) => a+m.expenses, 0);
                    return (
                      <tr key={qi} style={{ background: qi % 2 === 0 ? T.card : T.rowAlt }}>
                        <TD left><span style={{ color: T.textSub, fontSize: 12 }}>{q}</span></TD>
                        <TD mono>{fmt(rev)}</TD>
                        <TD mono>{fmt(exp)}</TD>
                        <TD color={pnlColor(bizQtrs[qi])} bold mono>{fmt(bizQtrs[qi])}</TD>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </Card>
          </>
        )}

      </main>
    </div>
  );
}
