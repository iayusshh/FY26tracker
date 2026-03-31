import { useState, useCallback, useMemo, useEffect, useRef } from "react";

const QUARTERS = ["Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"];
const MONTHS = ["Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec","Jan","Feb","Mar"];
const BROKER_COLORS = ["#4E8EF7", "#06B6D4", "#A855F7", "#14B8A6", "#F59E0B"];
const STORAGE_KEY = "fy26-financial-tracker:v1";

const fmt = (n) => {
  if (n === 0 || n === undefined || n === null || isNaN(n)) return "-";
  const abs = Math.abs(n);
  const s = abs >= 10000000 ? `${(abs/10000000).toFixed(2)} Cr` : abs >= 100000 ? `${(abs/100000).toFixed(2)} L` : abs.toLocaleString("en-IN");
  return n < 0 ? `(${s})` : s;
};

const pct = (n) => {
  if (!n || isNaN(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
};

const pnlColor = (n) => n > 0 ? "#00D26A" : n < 0 ? "#FF4D4D" : "#64748B";

const initQuarterlyFnO = () => QUARTERS.map(() => ({ gross: 0, charges: 0, other: 0, remarks: "" }));
const initQuarterlyEquity = () => QUARTERS.map(() => ({ gross: 0, charges: 0, other: 0, remarks: "" }));
const initCrypto = () => ({ spot: 0, derivatives: 0, airdrops: 0, spotTds: 0, derivTds: 0, airdropTds: 0 });
const initMonthBiz = () => MONTHS.map(() => ({ client: "", revenue: 0, expenses: 0, notes: "" }));
const createBroker = (id, name = `Broker ${id}`) => ({ id, name, quarters: initQuarterlyFnO() });
const fnoNet = (data) => data.map(q => q.gross - q.charges - q.other);
const fnoTotal = (data) => fnoNet(data).reduce((a, b) => a + b, 0);
const eqNet = (data) => data.map(q => q.gross - q.charges - q.other);
const eqTotal = (data) => eqNet(data).reduce((a, b) => a + b, 0);

const NumberInput = ({ value, onChange, accent = false, w = "100%" }) => {
  const [draft, setDraft] = useState(value === 0 ? "" : String(value));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraft(value === 0 ? "" : String(value));
  }, [value, isFocused]);

  const commit = (next) => {
    if (next === "" || next === "-" || next === "." || next === "-.") {
      onChange(0);
      return;
    }
    const parsed = Number(next);
    onChange(Number.isFinite(parsed) ? parsed : 0);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      value={draft}
      onChange={e => {
        const next = e.target.value.replace(/,/g, "");
        if (/^-?\d*\.?\d*$/.test(next)) {
          setDraft(next);
          if (next !== "" && next !== "-" && next !== "." && next !== "-.") commit(next);
        }
      }}
      placeholder="0"
      style={{
        background: "#F8FAFC",
        border: "1px solid #D7DFEA",
        borderRadius: 10,
        color: accent ? "#2563EB" : "#0F172A",
        padding: "10px 12px",
        width: w,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 13,
        outline: "none",
        textAlign: "right",
        transition: "border-color 0.2s, box-shadow 0.2s",
        appearance: "textfield",
        MozAppearance: "textfield",
        WebkitAppearance: "none",
      }}
      onFocus={e => {
        setIsFocused(true);
        e.target.style.borderColor = "#60A5FA";
        e.target.style.boxShadow = "0 0 0 3px rgba(96,165,250,0.18)";
      }}
      onBlur={e => {
        setIsFocused(false);
        e.target.style.borderColor = "#D7DFEA";
        e.target.style.boxShadow = "none";
        commit(draft);
        setDraft(draft === "" || draft === "-" || draft === "." || draft === "-." ? "" : draft);
      }}
      onWheel={e => e.currentTarget.blur()}
      onKeyDown={e => e.stopPropagation()}
    />
  );
};

const TextInput = ({ value, onChange, placeholder = "", w = "100%" }) => {
  const [draft, setDraft] = useState(value || "");
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) setDraft(value || "");
  }, [value, isFocused]);

  return (
    <input
      type="text"
      value={draft}
      onChange={e => {
        const next = e.target.value;
        setDraft(next);
        onChange(next);
      }}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      style={{
        background: "#F8FAFC", border: "1px solid #D7DFEA", borderRadius: 10,
        color: "#0F172A", padding: "10px 12px", width: w,
        fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
      onFocus={e => {
        setIsFocused(true);
        e.target.style.borderColor = "#60A5FA";
        e.target.style.boxShadow = "0 0 0 3px rgba(96,165,250,0.18)";
      }}
      onBlur={e => {
        setIsFocused(false);
        e.target.style.borderColor = "#D7DFEA";
        e.target.style.boxShadow = "none";
        onChange(draft);
      }}
      onKeyDown={e => e.stopPropagation()}
    />
  );
};

const SectionHeader = ({ title, accent = "#4E8EF7", icon }) => (
  <div style={{
    background: `linear-gradient(135deg, ${accent}18, #ffffff 120%)`,
    border: `1px solid ${accent}22`, padding: "16px 20px",
    marginBottom: 16, borderRadius: 16,
    display: "flex", alignItems: "center", gap: 12,
  }}>
    {icon && <span style={{ fontSize: 18, opacity: 0.9 }}>{icon}</span>}
    <h2 style={{
      margin: 0, fontSize: 15, fontWeight: 700, color: accent,
      fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.5px",
      textTransform: "uppercase",
    }}>{title}</h2>
  </div>
);

const SubHeader = ({ title, accent = "#A855F7" }) => (
  <div style={{ padding: "8px 16px", marginBottom: 10, marginTop: 6, borderBottom: `1px solid ${accent}30` }}>
    <span style={{ fontSize: 13, fontWeight: 600, color: accent, fontFamily: "'DM Sans', sans-serif" }}>{title}</span>
  </div>
);

const TH = ({ children, w }) => (
  <th style={{
    padding: "10px 12px", fontSize: 11, fontWeight: 700, color: "#64748B",
    textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "right",
    fontFamily: "'DM Sans', sans-serif", width: w, whiteSpace: "nowrap",
    borderBottom: "1px solid #E2E8F0", background: "#F8FAFC",
  }}>{children}</th>
);

const THL = ({ children, w }) => <TH w={w}><div style={{ textAlign: "left" }}>{children}</div></TH>;

const TD = ({ children, color, bold, mono }) => (
  <td style={{
    padding: "10px 12px", fontSize: 13, color: color || "#0F172A",
    fontWeight: bold ? 700 : 400, textAlign: "right",
    fontFamily: mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
    borderBottom: "1px solid #EEF2F7",
  }}>{children}</td>
);

const TDL = ({ children }) => (
  <td style={{
    padding: "10px 12px", fontSize: 13, color: "#0F172A", textAlign: "left",
    fontFamily: "'DM Sans', sans-serif", borderBottom: "1px solid #EEF2F7",
  }}>{children}</td>
);

const TotalRow = ({ cells }) => (
  <tr style={{ background: "#F8FAFC" }}>
    {cells.map((c, i) => (
      <td key={i} style={{
        padding: "12px", fontSize: 13, fontWeight: 700,
        color: c.color || "#0F172A", textAlign: i === 0 ? "left" : "right",
        fontFamily: c.mono ? "'JetBrains Mono', monospace" : "'DM Sans', sans-serif",
        borderTop: "1px solid #D7DFEA",
      }}>{c.value}</td>
    ))}
  </tr>
);

const Table = ({ children }) => (
  <div style={{ overflowX: "auto", marginBottom: 12 }}>
    <table style={{ width: "100%", borderCollapse: "collapse" }}>{children}</table>
  </div>
);

const Card = ({ children, style: s, className = "" }) => (
  <div style={{
    background: "rgba(255,255,255,0.92)", borderRadius: 24, padding: 0,
    border: "1px solid rgba(255,255,255,0.65)", overflow: "hidden", marginBottom: 24,
    boxShadow: "0 24px 60px rgba(15,23,42,0.10)", backdropFilter: "blur(14px)", ...s,
  }} className={`card-no-break ${className}`.trim()}>{children}</div>
);

const StatBox = ({ label, value, color, sub }) => (
  <div style={{
    background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)", borderRadius: 18, padding: "18px 20px",
    border: "1px solid #E2E8F0", flex: "1 1 180px", minWidth: 160,
    boxShadow: "0 12px 26px rgba(15,23,42,0.06)",
  }}>
    <div style={{ fontSize: 11, color: "#64748B", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 8, fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
    <div style={{ fontSize: 24, fontWeight: 800, color: color || "#0F172A", fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: "#64748B", marginTop: 6, fontFamily: "'DM Sans', sans-serif" }}>{sub}</div>}
  </div>
);

const SummaryStrip = ({ items }) => (
  <Card style={{ padding: 18, background: "linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)" }}>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 0 }}>
      {items.map((item, index) => (
        <div key={item.label} style={{
          padding: "14px 18px",
          borderRight: index < items.length - 1 ? "1px solid #E5E7EB" : "none",
        }}>
          <div style={{ fontSize: 12, color: "#6B7280", fontWeight: 600, marginBottom: 10 }}>{item.label}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: item.color || "#111827", fontFamily: "'DM Sans', sans-serif" }}>{item.value}</div>
        </div>
      ))}
    </div>
  </Card>
);

const FnOTable = ({ broker, accent, brokerCount, onUpdateFnO, onUpdateBrokerName, onRemoveBroker }) => {
  const nets = fnoNet(broker.quarters);
  const totGross = broker.quarters.reduce((a, q) => a + q.gross, 0);
  const totCharges = broker.quarters.reduce((a, q) => a + q.charges, 0);
  const totOther = broker.quarters.reduce((a, q) => a + q.other, 0);
  const totNet = fnoTotal(broker.quarters);
  return (
    <Card style={{ marginBottom: 18, border: `1px solid ${accent}24` }}>
      <div style={{ padding: "16px 18px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <div style={{ width: 11, height: 44, borderRadius: 999, background: accent }} />
          <div style={{ minWidth: 220, flex: 1 }}>
            <TextInput value={broker.name} onChange={v => onUpdateBrokerName(broker.id, v)} placeholder="Broker name" />
          </div>
        </div>
        {brokerCount > 1 && (
          <button
            onClick={() => onRemoveBroker(broker.id)}
            style={{
              border: "1px solid #E2E8F0", background: "#FFFFFF", color: "#DC2626", borderRadius: 999,
              padding: "8px 12px", fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
            }}
          >
            Remove
          </button>
        )}
      </div>
      <Table>
        <thead><tr><THL w="160px">Quarter</THL><TH>Gross PnL</TH><TH>Charges</TH><TH>Other Costs</TH><TH>Net PnL</TH><TH w="140px">Remarks</TH></tr></thead>
        <tbody>
          {QUARTERS.map((q, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
              <TDL>{q}</TDL>
              <TD><NumberInput value={broker.quarters[i].gross} onChange={v => onUpdateFnO(broker.id, i, "gross", v)} accent /></TD>
              <TD><NumberInput value={broker.quarters[i].charges} onChange={v => onUpdateFnO(broker.id, i, "charges", v)} accent /></TD>
              <TD><NumberInput value={broker.quarters[i].other} onChange={v => onUpdateFnO(broker.id, i, "other", v)} accent /></TD>
              <TD color={pnlColor(nets[i])} bold mono>{fmt(nets[i])}</TD>
              <TD><TextInput value={broker.quarters[i].remarks} onChange={v => onUpdateFnO(broker.id, i, "remarks", v)} placeholder="Notes" /></TD>
            </tr>
          ))}
          <TotalRow cells={[
            { value: `${broker.name} Total`, color: "#0F172A" },
            { value: fmt(totGross), color: "#94A3B8", mono: true },
            { value: fmt(totCharges), color: "#94A3B8", mono: true },
            { value: fmt(totOther), color: "#94A3B8", mono: true },
            { value: fmt(totNet), color: pnlColor(totNet), mono: true },
            { value: "" },
          ]} />
        </tbody>
      </Table>
    </Card>
  );
};

const EquityTable = ({ data, setter, label, accent, onUpdateEq }) => {
  const nets = eqNet(data);
  const tot = eqTotal(data);
  const totGross = data.reduce((a, q) => a + q.gross, 0);
  const totChrg = data.reduce((a, q) => a + q.charges, 0);
  const totOther = data.reduce((a, q) => a + q.other, 0);
  return (
    <Card style={{ marginBottom: 18, border: `1px solid ${accent}24` }}>
      <div style={{ padding: "16px 18px 0", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 11, height: 44, borderRadius: 999, background: accent }} />
        <div style={{
          minWidth: 220,
          flex: 1,
          background: "#F8FAFC",
          border: "1px solid #D7DFEA",
          borderRadius: 10,
          padding: "10px 12px",
          color: "#0F172A",
          fontSize: 13,
          fontWeight: 700,
          fontFamily: "'DM Sans', sans-serif",
        }}>
          {label}
        </div>
      </div>
      <Table>
        <thead><tr><THL>Quarter</THL><TH>Gross PnL</TH><TH>Charges</TH><TH>Other Costs</TH><TH>Net PnL</TH><TH w="120px">Remarks</TH></tr></thead>
        <tbody>
          {QUARTERS.map((q, i) => (
            <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
              <TDL>{q}</TDL>
              <TD><NumberInput value={data[i].gross} onChange={v => onUpdateEq(setter, i, "gross", v)} accent /></TD>
              <TD><NumberInput value={data[i].charges} onChange={v => onUpdateEq(setter, i, "charges", v)} accent /></TD>
              <TD><NumberInput value={data[i].other} onChange={v => onUpdateEq(setter, i, "other", v)} accent /></TD>
              <TD color={pnlColor(nets[i])} bold mono>{fmt(nets[i])}</TD>
              <TD><TextInput value={data[i].remarks} onChange={v => onUpdateEq(setter, i, "remarks", v)} placeholder="Notes" /></TD>
            </tr>
          ))}
          <TotalRow cells={[
            { value: "Total", color: "#0F172A" },
            { value: fmt(totGross), color: "#94A3B8", mono: true },
            { value: fmt(totChrg), color: "#94A3B8", mono: true },
            { value: fmt(totOther), color: "#94A3B8", mono: true },
            { value: fmt(tot), color: pnlColor(tot), mono: true },
            { value: "" },
          ]} />
        </tbody>
      </Table>
    </Card>
  );
};

const NAV_ITEMS = [
  { id: "dashboard", label: "Dashboard", accent: "#00D26A" },
  { id: "fno", label: "F&O PnL", accent: "#4E8EF7" },
  { id: "equity", label: "Equity", accent: "#00D26A" },
  { id: "crypto", label: "Crypto", accent: "#F59E0B" },
  { id: "business", label: "Business", accent: "#06B6D4" },
];

// ── PDF Print Styles injected once ──
const PRINT_STYLES = `
  .print-only { display: none !important; }
@media print {
  body { background: #0F172A !important; color: #F1F5F9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  nav { display: none !important; }
  #pdf-toolbar { display: none !important; }
  .screen-only { display: none !important; }
  .print-only { display: block !important; }
  main { padding: 12px 20px !important; overflow: visible !important; height: auto !important; }
  .card-no-break { page-break-inside: avoid; }
  @page { margin: 10mm; size: A4 landscape; }
}
`;

export default function App() {
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [userName, setUserName] = useState("User");
  const [editingName, setEditingName] = useState(false);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const brokerIdRef = useRef(2);

  const [fnoBrokers, setFnoBrokers] = useState([createBroker(1, "Primary Broker")]);

  const [eqYou, setEqYou] = useState(initQuarterlyEquity());

  const [crypto, setCrypto] = useState(initCrypto());

  const [biz, setBiz] = useState(initMonthBiz());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed.userName === "string") setUserName(parsed.userName);
      if (Array.isArray(parsed.fnoBrokers) && parsed.fnoBrokers.length) {
        setFnoBrokers(parsed.fnoBrokers);
        brokerIdRef.current = Math.max(...parsed.fnoBrokers.map(b => b.id || 0), 1) + 1;
      }
      if (Array.isArray(parsed.eqYou) && parsed.eqYou.length === QUARTERS.length) setEqYou(parsed.eqYou);
      if (parsed.crypto && typeof parsed.crypto === "object") setCrypto(parsed.crypto);
      if (Array.isArray(parsed.biz) && parsed.biz.length === MONTHS.length) setBiz(parsed.biz);
    } catch (error) {
      console.error("Failed to restore tracker data:", error);
    }
  }, []);

  // Inject print CSS once
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = PRINT_STYLES;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    const enablePrintMode = () => setIsPrintMode(true);
    const disablePrintMode = () => setIsPrintMode(false);
    window.addEventListener("beforeprint", enablePrintMode);
    window.addEventListener("afterprint", disablePrintMode);
    return () => {
      window.removeEventListener("beforeprint", enablePrintMode);
      window.removeEventListener("afterprint", disablePrintMode);
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        userName,
        fnoBrokers,
        eqYou,
        crypto,
        biz,
      }));
    } catch (error) {
      console.error("Failed to persist tracker data:", error);
    }
  }, [userName, fnoBrokers, eqYou, crypto, biz]);

  // Computed values
  const brokerQuarterNet = (broker) => fnoNet(broker.quarters);
  const brokerTotal = (broker) => fnoTotal(broker.quarters);
  const fnoGrossTotal = fnoBrokers.reduce((sum, broker) => sum + broker.quarters.reduce((acc, q) => acc + q.gross, 0), 0);
  const fnoChargesTotal = fnoBrokers.reduce((sum, broker) => sum + broker.quarters.reduce((acc, q) => acc + q.charges, 0), 0);
  const fnoOtherTotal = fnoBrokers.reduce((sum, broker) => sum + broker.quarters.reduce((acc, q) => acc + q.other, 0), 0);
  const fnoQuarterTotals = QUARTERS.map((_, qi) => fnoBrokers.reduce((sum, broker) => sum + brokerQuarterNet(broker)[qi], 0));
  const fnoCombinedTotal = fnoBrokers.reduce((sum, broker) => sum + brokerTotal(broker), 0);

  const eqNet = (data) => data.map(q => q.stcg + q.ltcg - q.charges + q.dividends);
  const eqTotal = (data) => eqNet(data).reduce((a, b) => a + b, 0);
  const eqChargesTotal = eqYou.reduce((sum, q) => sum + q.charges, 0);
  const eqGrossRealised = eqYou.reduce((sum, q) => sum + q.stcg + q.ltcg + q.dividends, 0);

  const cryptoNets = useMemo(() => ({
    spot: crypto.spot - crypto.spotTds,
    deriv: crypto.derivatives - crypto.derivTds,
    air: crypto.airdrops - crypto.airdropTds,
    total: (crypto.spot - crypto.spotTds) + (crypto.derivatives - crypto.derivTds) + (crypto.airdrops - crypto.airdropTds),
  }), [crypto]);

  const bizMonthNet = biz.map(m => m.revenue - m.expenses);
  const bizQtrs = [0,1,2,3].map(q => bizMonthNet.slice(q*3, q*3+3).reduce((a,b) => a+b, 0));
  const bizTotal = bizMonthNet.reduce((a, b) => a + b, 0);
  const bizRevenueTotal = biz.reduce((sum, m) => sum + m.revenue, 0);
  const bizExpenseTotal = biz.reduce((sum, m) => sum + m.expenses, 0);
  const cryptoGrossTotal = crypto.spot + crypto.derivatives + crypto.airdrops;
  const cryptoTaxTotal = crypto.spotTds + crypto.derivTds + crypto.airdropTds;
  const totalChargesAndTaxes = fnoChargesTotal + eqChargesTotal + cryptoTaxTotal;
  const totalOtherDebits = fnoOtherTotal + bizExpenseTotal;
  const grossRealised = fnoGrossTotal + eqGrossRealised + cryptoGrossTotal + bizRevenueTotal;

  const totalIncome = useMemo(() => {
    return fnoCombinedTotal + eqTotal(eqYou) + cryptoNets.total + bizTotal;
  }, [fnoCombinedTotal, eqYou, cryptoNets, bizTotal]);

  const updateFnO = (brokerId, qi, field, val) => {
    setFnoBrokers(prev => prev.map(broker => {
      if (broker.id !== brokerId) return broker;
      const nextQuarters = [...broker.quarters];
      nextQuarters[qi] = { ...broker.quarters[qi], [field]: val };
      return { ...broker, quarters: nextQuarters };
    }));
  };

  const updateBrokerName = (brokerId, name) => {
    setFnoBrokers(prev => prev.map(broker => broker.id === brokerId ? { ...broker, name } : broker));
  };

  const addBroker = () => {
    const nextId = brokerIdRef.current++;
    setFnoBrokers(prev => [...prev, createBroker(nextId)]);
  };

  const removeBroker = (brokerId) => {
    setFnoBrokers(prev => {
      if (prev.length === 1) return prev;
      return prev.filter(broker => broker.id !== brokerId);
    });
  };

  const updateEq = (setter, qi, field, val) => {
    setter(prev => { const next = [...prev]; next[qi] = { ...prev[qi], [field]: val }; return next; });
  };

  const updateBiz = (mi, field, val) => {
    setBiz(prev => { const next = [...prev]; next[mi] = { ...prev[mi], [field]: val }; return next; });
  };

  const resetAllData = useCallback(() => {
    setUserName("User");
    setEditingName(false);
    setFnoBrokers([createBroker(1, "Primary Broker")]);
    setEqYou(initQuarterlyEquity());
    setCrypto(initCrypto());
    setBiz(initMonthBiz());
    brokerIdRef.current = 2;
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const exportData = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {
        userName,
        fnoBrokers,
        eqYou,
        crypto,
        biz,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fy26-financial-tracker-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [userName, fnoBrokers, eqYou, crypto, biz]);

  const importData = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        const data = parsed?.data ?? parsed;
        if (typeof data.userName === "string") setUserName(data.userName);
        if (Array.isArray(data.fnoBrokers) && data.fnoBrokers.length) {
          setFnoBrokers(data.fnoBrokers);
          brokerIdRef.current = Math.max(...data.fnoBrokers.map(b => b.id || 0), 1) + 1;
        }
        if (Array.isArray(data.eqYou) && data.eqYou.length === QUARTERS.length) setEqYou(data.eqYou);
        if (data.crypto && typeof data.crypto === "object") setCrypto(data.crypto);
        if (Array.isArray(data.biz) && data.biz.length === MONTHS.length) setBiz(data.biz);
      } catch (error) {
        console.error("Failed to import tracker data:", error);
        window.alert("That file could not be imported. Please choose a valid tracker JSON export.");
      } finally {
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  }, []);

  const reportDate = useMemo(() => new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }), []);

  // PDF Download: render the complete tracker, then let the browser save as PDF.
  const handleDownloadPDF = () => {
    setIsPrintMode(true);
    setActiveTab("dashboard");
    window.setTimeout(() => window.print(), 80);
  };

  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab]);

  // ── Render ──
  return (
    <div style={{
      display: "flex",
      minHeight: "100vh",
      background: "radial-gradient(circle at top left, #DBEAFE 0%, #EFF6FF 30%, #F8FAFC 60%, #E2E8F0 100%)",
      fontFamily: "'DM Sans', sans-serif",
      color: "#0F172A",
      overflow: "hidden",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <nav style={{
        width: 240, minWidth: 240, background: "rgba(15,23,42,0.94)", borderRight: "1px solid rgba(255,255,255,0.08)",
        display: "flex", flexDirection: "column", padding: "24px 0",
        boxShadow: "18px 0 48px rgba(15,23,42,0.18)",
      }}>
        {/* Brand + User Name */}
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #2D3348", marginBottom: 12 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF", letterSpacing: "-0.5px" }}>FY 2025-26</div>
          <div style={{ fontSize: 11, color: "#93C5FD", marginTop: 4, fontWeight: 600, marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.7px" }}>Personal Finance Tracker</div>

          {/* Inline editable user name */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {editingName ? (
              <input
                autoFocus
                value={userName}
                onChange={e => setUserName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                style={{
                  background: "#0F172A", border: "1px solid #4E8EF7", borderRadius: 5,
                  color: "#F1F5F9", padding: "4px 8px", fontSize: 13, fontWeight: 600,
                  fontFamily: "'DM Sans', sans-serif", outline: "none", width: "100%",
                }}
              />
            ) : (
              <>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9" }}>👤 {userName}</span>
                <button
                  onClick={() => setEditingName(true)}
                  title="Edit name"
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    color: "#64748B", fontSize: 11, padding: "2px 4px", lineHeight: 1,
                  }}
                >✏️</button>
              </>
            )}
          </div>
        </div>

        {/* Nav */}
        {NAV_ITEMS.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)} style={{
            background: activeTab === item.id ? "rgba(255,255,255,0.12)" : "transparent",
            border: "none", borderLeft: activeTab === item.id ? `3px solid ${item.accent}` : "3px solid transparent",
            padding: "10px 20px", textAlign: "left", cursor: "pointer",
            color: activeTab === item.id ? "#FFFFFF" : "#CBD5E1",
            fontSize: 13, fontWeight: activeTab === item.id ? 700 : 500,
            fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s",
          }}>{item.label}</button>
        ))}

        <div style={{ flex: 1 }} />

        {/* PDF Download Button */}
        <div id="pdf-toolbar" style={{ padding: "12px 16px", borderTop: "1px solid #2D3348" }}>
          <button
            onClick={handleDownloadPDF}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 8, border: "none",
              background: "linear-gradient(135deg, #4E8EF7, #7C3AED)",
              color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
              fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.3px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              transition: "opacity 0.2s", boxShadow: "0 4px 14px #4E8EF730",
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            📄 Download Full Report
          </button>
          <div style={{ fontSize: 10, color: "#475569", marginTop: 6, textAlign: "center" }}>
            Opens a print-ready full tracker for Save as PDF
          </div>

          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button
              onClick={exportData}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "#E2E8F0", fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Export JSON
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)", color: "#E2E8F0", fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Import JSON
            </button>
            <button
              onClick={resetAllData}
              style={{
                width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(248,113,113,0.28)",
                background: "rgba(127,29,29,0.22)", color: "#FECACA", fontSize: 12, fontWeight: 700, cursor: "pointer",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Reset Data
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              onChange={importData}
              style={{ display: "none" }}
            />
          </div>
        </div>

        <div style={{ padding: "8px 20px", fontSize: 10, color: "#64748B" }}>
          All data in-memory only.<br />Refresh = reset.
        </div>
      </nav>

      {/* Main Content */}
      <main ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "32px 36px" }}>

        {/* ── DASHBOARD ── */}
        {isPrintMode && (
          <div className="print-only" style={{
            marginBottom: 24,
            padding: "20px 24px",
            borderRadius: 14,
            background: "linear-gradient(135deg, #111827 0%, #1B1F2A 60%, #232838 100%)",
            border: "1px solid #2D3348",
            boxShadow: "0 20px 50px rgba(0,0,0,0.25)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 20 }}>
              <div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#F1F5F9", letterSpacing: "-0.8px" }}>
                  FY 2025-26 Financial Tracker
                </div>
                <div style={{ marginTop: 8, fontSize: 14, color: "#94A3B8", lineHeight: 1.6 }}>
                  Consolidated export report for {userName}<br />
                  Designed for download and print-ready review
                </div>
              </div>
              <div style={{
                minWidth: 220, padding: "14px 16px", borderRadius: 12, background: "#0F172A",
                border: "1px solid #334155",
              }}>
                <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.8px" }}>Exported On</div>
                <div style={{ marginTop: 6, fontSize: 16, fontWeight: 700, color: "#F1F5F9" }}>{reportDate}</div>
                <div style={{ marginTop: 12, fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.8px" }}>Net Realised P&L</div>
                <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800, color: pnlColor(totalIncome) }}>{fmt(totalIncome)}</div>
              </div>
            </div>
          </div>
        )}

        {(activeTab === "dashboard" || isPrintMode) && (
          <>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: "#0F172A", letterSpacing: "-0.7px" }}>
                {userName}'s Dashboard
              </h1>
              <p style={{ fontSize: 14, color: "#64748B", margin: "6px 0 0" }}>FY 2025-26 | Consolidated Financial Overview</p>
            </div>

            <SummaryStrip items={[
              { label: "Realised P&L", value: fmt(grossRealised), color: pnlColor(grossRealised) },
              { label: "Charges & taxes", value: fmt(totalChargesAndTaxes), color: "#334155" },
              { label: "Other credits & debits", value: fmt(-totalOtherDebits), color: pnlColor(-totalOtherDebits) },
              { label: "Net realised P&L", value: fmt(totalIncome), color: pnlColor(totalIncome) },
              { label: "Unrealised P&L", value: "0", color: "#334155" },
            ]} />

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24, marginTop: 24 }}>
              <StatBox label="Total Income" value={fmt(totalIncome)} color={pnlColor(totalIncome)} />
              <StatBox label="F&O Total" value={fmt(fnoCombinedTotal)} color="#4E8EF7" />
              <StatBox label="Equity Total" value={fmt(eqTotal(eqYou))} color="#00D26A" />
              <StatBox label="Crypto Total" value={fmt(cryptoNets.total)} color="#F59E0B" />
              <StatBox label="Business Total" value={fmt(bizTotal)} color="#06B6D4" />
            </div>

            <Card>
              <SectionHeader title="Income Streams" accent="#00D26A" />
              <div style={{ padding: "0 4px 12px" }}>
                <Table>
                  <thead><tr><THL>Stream</THL><TH>Q1</TH><TH>Q2</TH><TH>Q3</TH><TH>Q4</TH><TH>FY Total</TH><TH>%</TH></tr></thead>
                  <tbody>
                    {[
                      { name: `F&O (${userName})`, qtrs: fnoQuarterTotals },
                      { name: `Equity (${userName})`, qtrs: eqNet(eqYou) },
                      { name: "Crypto", qtrs: [cryptoNets.total, 0, 0, 0] },
                      { name: "Business", qtrs: bizQtrs },
                    ].map((stream, i) => {
                      const total = stream.qtrs.reduce((a, b) => a + b, 0);
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                          <TDL>{stream.name}</TDL>
                          {stream.qtrs.map((v, qi) => <TD key={qi} color={pnlColor(v)} mono>{fmt(v)}</TD>)}
                          <TD color={pnlColor(total)} bold mono>{fmt(total)}</TD>
                          <TD mono>{totalIncome ? pct(total / totalIncome) : "-"}</TD>
                        </tr>
                      );
                    })}
                    <TotalRow cells={[
                      { value: "TOTAL" },
                      ...QUARTERS.map((_, qi) => {
                        const v = fnoQuarterTotals[qi] + eqNet(eqYou)[qi] + (qi === 0 ? cryptoNets.total : 0) + bizQtrs[qi];
                        return { value: fmt(v), color: pnlColor(v), mono: true };
                      }),
                      { value: fmt(totalIncome), color: pnlColor(totalIncome), mono: true },
                      { value: "100%", color: "#94A3B8" },
                    ]} />
                  </tbody>
                </Table>
              </div>
            </Card>

          </>
        )}

        {/* ── F&O PnL ── */}
        {(activeTab === "fno" || isPrintMode) && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>F&O PnL</h1>
            <Card style={{ padding: 22 }}>
              <SectionHeader title={`${userName} — F&O by Broker`} accent="#4E8EF7" />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
                <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6 }}>
                  Add one broker block for each account and the dashboard will consolidate them automatically.
                </div>
                {!isPrintMode && (
                  <button
                    onClick={addBroker}
                    style={{
                      border: "none",
                      background: "linear-gradient(135deg, #2563EB, #7C3AED)",
                      color: "#FFFFFF",
                      borderRadius: 999,
                      padding: "11px 16px",
                      fontWeight: 700,
                      cursor: "pointer",
                      fontFamily: "'DM Sans', sans-serif",
                      boxShadow: "0 14px 30px rgba(37,99,235,0.24)",
                    }}
                  >
                    + Add Broker
                  </button>
                )}
              </div>

              {fnoBrokers.map((broker, index) => (
                <FnOTable
                  key={broker.id}
                  broker={broker}
                  accent={BROKER_COLORS[index % BROKER_COLORS.length]}
                  brokerCount={fnoBrokers.length}
                  onUpdateFnO={updateFnO}
                  onUpdateBrokerName={updateBrokerName}
                  onRemoveBroker={removeBroker}
                />
              ))}

              <div style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg, #EFF6FF, #F8FAFC)",
                borderRadius: 18,
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #DBEAFE",
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.7px" }}>Combined F&O Total</div>
                  <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: pnlColor(fnoCombinedTotal), fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmt(fnoCombinedTotal)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {QUARTERS.map((quarter, qi) => (
                    <div key={quarter} style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{quarter}</div>
                      <div style={{ marginTop: 4, fontWeight: 700, color: pnlColor(fnoQuarterTotals[qi]), fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt(fnoQuarterTotals[qi])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── EQUITY ── */}
        {(activeTab === "equity" || isPrintMode) && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>Equity PnL</h1>
            <Card style={{ padding: 22 }}>
              <SectionHeader title={`${userName} — Equity PnL`} accent="#00D26A" />
              <div style={{ color: "#64748B", fontSize: 14, lineHeight: 1.6, marginBottom: 18 }}>
                Track quarterly realized equity performance with the same consolidated layout used in F&O.
              </div>

              <EquityTable data={eqYou} setter={setEqYou} label={userName} accent="#00D26A" onUpdateEq={updateEq} />

              <div style={{
                padding: "16px 18px",
                background: "linear-gradient(135deg, #ECFDF5, #F8FAFC)",
                borderRadius: 18,
                marginTop: 8,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                border: "1px solid #BBF7D0",
              }}>
                <div>
                  <div style={{ fontSize: 11, color: "#64748B", textTransform: "uppercase", letterSpacing: "0.7px" }}>Combined Equity Total</div>
                  <div style={{ marginTop: 4, fontSize: 24, fontWeight: 800, color: pnlColor(eqTotal(eqYou)), fontFamily: "'JetBrains Mono', monospace" }}>
                    {fmt(eqTotal(eqYou))}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                  {QUARTERS.map((quarter, qi) => (
                    <div key={quarter} style={{ minWidth: 110 }}>
                      <div style={{ fontSize: 11, color: "#64748B" }}>{quarter}</div>
                      <div style={{ marginTop: 4, fontWeight: 700, color: pnlColor(eqNet(eqYou)[qi]), fontFamily: "'JetBrains Mono', monospace" }}>
                        {fmt(eqNet(eqYou)[qi])}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── CRYPTO ── */}
        {(activeTab === "crypto" || isPrintMode) && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>Crypto PnL</h1>
            <Card>
              <SectionHeader title="Annual Summary" accent="#F59E0B" />
              <div style={{ padding: "0 4px 12px" }}>
                <Table>
                  <thead><tr><THL>Category</THL><TH>Gross PnL</TH><TH>TDS Paid (1%)</TH><TH>Net PnL</TH></tr></thead>
                  <tbody>
                    {[
                      { name: "Spot Trading", gKey: "spot", tKey: "spotTds", net: cryptoNets.spot },
                      { name: "Derivatives", gKey: "derivatives", tKey: "derivTds", net: cryptoNets.deriv },
                      { name: "Airdrops / Staking", gKey: "airdrops", tKey: "airdropTds", net: cryptoNets.air },
                    ].map((row, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                        <TDL>{row.name}</TDL>
                        <TD><NumberInput value={crypto[row.gKey]} onChange={v => setCrypto(p => ({ ...p, [row.gKey]: v }))} accent /></TD>
                        <TD><NumberInput value={crypto[row.tKey]} onChange={v => setCrypto(p => ({ ...p, [row.tKey]: v }))} accent /></TD>
                        <TD color={pnlColor(row.net)} bold mono>{fmt(row.net)}</TD>
                      </tr>
                    ))}
                    <TotalRow cells={[
                      { value: "Total" },
                      { value: fmt(crypto.spot + crypto.derivatives + crypto.airdrops), color: "#94A3B8", mono: true },
                      { value: fmt(crypto.spotTds + crypto.derivTds + crypto.airdropTds), color: "#94A3B8", mono: true },
                      { value: fmt(cryptoNets.total), color: pnlColor(cryptoNets.total), mono: true },
                    ]} />
                  </tbody>
                </Table>
                <div style={{ margin: "12px 16px", padding: "10px 14px", background: "#F59E0B10", borderLeft: "3px solid #F59E0B", borderRadius: "0 6px 6px 0", fontSize: 12, color: "#F59E0B", lineHeight: 1.6 }}>
                  <strong>Section 115BBH:</strong> Crypto gains taxed at 30% flat + 4% cess. No set-off of losses against other crypto or any other income. 1% TDS on transactions above threshold.
                </div>
              </div>
            </Card>
          </>
        )}

        {/* ── BUSINESS ── */}
        {(activeTab === "business" || isPrintMode) && (
          <>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 24px" }}>Business / Freelance</h1>
            <Card>
              <SectionHeader title="Monthly Log" accent="#06B6D4" />
              <div style={{ padding: "0 4px 12px" }}>
                <Table>
                  <thead><tr><THL>Month</THL><TH w="140px">Client / Source</TH><TH>Revenue</TH><TH>Expenses</TH><TH>Net Profit</TH><TH w="120px">Notes</TH></tr></thead>
                  <tbody>
                    {MONTHS.map((m, i) => {
                      const net = biz[i].revenue - biz[i].expenses;
                      return (
                        <tr key={i} style={{ background: i % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                          <TDL>{m} {i < 9 ? "2025" : "2026"}</TDL>
                          <TD><TextInput value={biz[i].client} onChange={v => updateBiz(i, "client", v)} placeholder="Client" /></TD>
                          <TD><NumberInput value={biz[i].revenue} onChange={v => updateBiz(i, "revenue", v)} accent /></TD>
                          <TD><NumberInput value={biz[i].expenses} onChange={v => updateBiz(i, "expenses", v)} accent /></TD>
                          <TD color={pnlColor(net)} bold mono>{fmt(net)}</TD>
                          <TD><TextInput value={biz[i].notes} onChange={v => updateBiz(i, "notes", v)} placeholder="..." /></TD>
                        </tr>
                      );
                    })}
                    <TotalRow cells={[
                      { value: "FY TOTAL" }, { value: "" },
                      { value: fmt(biz.reduce((a,m) => a+m.revenue,0)), color: "#94A3B8", mono: true },
                      { value: fmt(biz.reduce((a,m) => a+m.expenses,0)), color: "#94A3B8", mono: true },
                      { value: fmt(bizTotal), color: pnlColor(bizTotal), mono: true },
                      { value: "" },
                    ]} />
                  </tbody>
                </Table>
              </div>
            </Card>
            <Card>
              <SectionHeader title="Quarterly Breakdown" accent="#06B6D4" />
              <div style={{ padding: "0 4px 12px" }}>
                <Table>
                  <thead><tr><THL>Quarter</THL><TH>Revenue</TH><TH>Expenses</TH><TH>Net Profit</TH></tr></thead>
                  <tbody>
                    {QUARTERS.map((q, qi) => {
                      const rev = biz.slice(qi*3, qi*3+3).reduce((a,m) => a+m.revenue, 0);
                      const exp = biz.slice(qi*3, qi*3+3).reduce((a,m) => a+m.expenses, 0);
                      return (
                        <tr key={qi} style={{ background: qi % 2 === 0 ? "#FFFFFF" : "#F8FAFC" }}>
                          <TDL>{q}</TDL>
                          <TD mono>{fmt(rev)}</TD>
                          <TD mono>{fmt(exp)}</TD>
                          <TD color={pnlColor(bizQtrs[qi])} bold mono>{fmt(bizQtrs[qi])}</TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card>
          </>
        )}

      </main>
    </div>
  );
}
