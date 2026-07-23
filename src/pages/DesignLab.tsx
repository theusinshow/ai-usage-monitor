import { useMemo, useState } from "react";
import * as Progress from "@radix-ui/react-progress";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Gauge,
  MousePointerClick,
  Pause,
  Play,
  Sparkles,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type LabTab = "bars" | "charts" | "motion";
type LabTheme = "mineral" | "ember" | "violet";

const history = [
  { day: "Seg", codex: 34, claude: 22, openai: 14, deepseek: 8 },
  { day: "Ter", codex: 48, claude: 30, openai: 18, deepseek: 12 },
  { day: "Qua", codex: 44, claude: 52, openai: 23, deepseek: 16 },
  { day: "Qui", codex: 63, claude: 42, openai: 31, deepseek: 18 },
  { day: "Sex", codex: 78, claude: 58, openai: 29, deepseek: 24 },
  { day: "Sáb", codex: 56, claude: 38, openai: 19, deepseek: 15 },
  { day: "Dom", codex: 72, claude: 47, openai: 26, deepseek: 20 },
];

const ranking = [
  { name: "Codex", value: 72, color: "var(--provider-codex)" },
  { name: "Claude", value: 47, color: "var(--provider-claude)" },
  { name: "OpenAI", value: 26, color: "var(--provider-openai)" },
  { name: "DeepSeek", value: 20, color: "var(--provider-deepseek)" },
];

const tooltipStyle = {
  background: "#17191d",
  border: "1px solid #343840",
  borderRadius: "7px",
  color: "#f4f5f7",
  fontSize: "10px",
};

function PrecisionRail({ value, enabled, reduced }: { value: number; enabled: boolean; reduced: boolean }) {
  return <Progress.Root className="lab-progress" value={value} aria-label="Uso da janela semanal">
    <Progress.Indicator asChild>
      <motion.div
        className="lab-progress__fill"
        initial={false}
        animate={{ scaleX: value / 100 }}
        transition={{ duration: enabled && !reduced ? 0.65 : 0, ease: [0.22, 1, 0.36, 1] }}
      />
    </Progress.Indicator>
  </Progress.Root>;
}

function SegmentedRail({ value, enabled, reduced }: { value: number; enabled: boolean; reduced: boolean }) {
  const filled = Math.round(value / 10);
  return <Progress.Root className="lab-segments" value={value} aria-label="Uso segmentado">
    {Array.from({ length: 10 }, (_, index) => <motion.i
      key={index}
      className={index < filled ? "is-filled" : ""}
      initial={false}
      animate={{ opacity: index < filled ? 1 : 0.26, scaleY: index < filled ? 1 : 0.65 }}
      transition={{ delay: enabled && !reduced ? index * 0.025 : 0, duration: enabled && !reduced ? 0.28 : 0 }}
    />)}
  </Progress.Root>;
}

function SignalRail({ value, enabled, reduced }: { value: number; enabled: boolean; reduced: boolean }) {
  const bars = 14;
  const filled = Math.round((value / 100) * bars);
  return <Progress.Root className="lab-signal" value={value} aria-label="Sinal de consumo">
    {Array.from({ length: bars }, (_, index) => <motion.i
      key={index}
      className={index < filled ? "is-filled" : ""}
      initial={false}
      animate={{ height: `${32 + ((index * 17) % 62)}%`, opacity: index < filled ? 1 : 0.18 }}
      transition={{ duration: enabled && !reduced ? 0.38 : 0, delay: enabled && !reduced ? index * 0.018 : 0 }}
    />)}
  </Progress.Root>;
}

function OrbitProgress({ value, enabled, reduced }: { value: number; enabled: boolean; reduced: boolean }) {
  const circumference = 2 * Math.PI * 42;
  return <Progress.Root className="lab-orbit" value={value} aria-label="Uso radial">
    <svg viewBox="0 0 100 100" aria-hidden="true">
      <circle className="lab-orbit__track" cx="50" cy="50" r="42" />
      <motion.circle
        className="lab-orbit__value"
        cx="50"
        cy="50"
        r="42"
        strokeDasharray={circumference}
        initial={false}
        animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
        transition={{ duration: enabled && !reduced ? 0.75 : 0, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
    <motion.strong key={value} initial={enabled && !reduced ? { opacity: 0, y: 5 } : false} animate={{ opacity: 1, y: 0 }}>{value}%</motion.strong>
    <span>janela</span>
  </Progress.Root>;
}

function BarsPanel({ value, enabled, reduced }: { value: number; enabled: boolean; reduced: boolean }) {
  return <div className="lab-panel-stack">
    <section className="lab-specimen">
      <div className="lab-specimen__head"><div><span>01 · Precisão</span><h2>Rail contínuo</h2></div><strong>{value}%</strong></div>
      <PrecisionRail value={value} enabled={enabled} reduced={reduced} />
      <p>Ideal para limite exato, com leitura rápida e pouca interferência visual.</p>
    </section>
    <section className="lab-specimen">
      <div className="lab-specimen__head"><div><span>02 · Ritmo</span><h2>Blocos segmentados</h2></div><strong>{Math.round(value / 10)}/10</strong></div>
      <SegmentedRail value={value} enabled={enabled} reduced={reduced} />
      <p>Transforma porcentagem em etapas e deixa a aproximação do limite mais tátil.</p>
    </section>
    <section className="lab-specimen lab-specimen--split">
      <div><span className="lab-kicker">03 · Pulso</span><h2>Sinal de atividade</h2><SignalRail value={value} enabled={enabled} reduced={reduced} /></div>
      <OrbitProgress value={value} enabled={enabled} reduced={reduced} />
    </section>
  </div>;
}

function ChartsPanel({ enabled, reduced }: { enabled: boolean; reduced: boolean }) {
  const animate = enabled && !reduced;
  return <div className="lab-panel-stack">
    <section className="lab-chart-section">
      <div className="lab-section-title"><div><span>7 dias</span><h2>Ritmo por provedor</h2></div><Activity size={17} /></div>
      <div className="lab-chart lab-chart--area">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 8, right: 2, left: -28, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,.06)" />
            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "#777d87", fontSize: 9 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "#777d87", fontSize: 9 }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: "rgba(255,255,255,.12)" }} />
            <Area type="monotone" dataKey="codex" stroke="var(--provider-codex)" fill="var(--provider-codex-soft)" strokeWidth={2} isAnimationActive={animate} animationDuration={750} />
            <Area type="monotone" dataKey="claude" stroke="var(--provider-claude)" fill="transparent" strokeWidth={1.5} isAnimationActive={animate} animationDuration={850} />
            <Area type="monotone" dataKey="openai" stroke="var(--provider-openai)" fill="transparent" strokeWidth={1.3} isAnimationActive={animate} animationDuration={950} />
            <Area type="monotone" dataKey="deepseek" stroke="var(--provider-deepseek)" fill="transparent" strokeWidth={1.3} isAnimationActive={animate} animationDuration={1050} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="lab-chart-section">
      <div className="lab-section-title"><div><span>Ranking</span><h2>Mais utilizados</h2></div><BarChart3 size={17} /></div>
      <div className="lab-chart lab-chart--rank">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={ranking} layout="vertical" margin={{ top: 0, right: 8, left: -12, bottom: 0 }}>
            <XAxis type="number" hide domain={[0, 100]} />
            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={60} tick={{ fill: "#aeb3bc", fontSize: 9 }} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(255,255,255,.035)" }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} isAnimationActive={animate} animationDuration={700}>
              {ranking.map((item) => <Cell key={item.name} fill={item.color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
    <section className="lab-chart-section lab-chart-section--distribution">
      <div className="lab-section-title"><div><span>Distribuição</span><h2>Participação semanal</h2></div><Gauge size={17} /></div>
      <div className="lab-distribution">
        <div className="lab-chart lab-chart--pie">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={ranking} dataKey="value" nameKey="name" innerRadius={35} outerRadius={53} paddingAngle={3} stroke="none" isAnimationActive={animate} animationDuration={850}>
                {ranking.map((item) => <Cell key={item.name} fill={item.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul>{ranking.map((item) => <li key={item.name}><i style={{ background: item.color }} /><span>{item.name}</span><strong>{item.value}</strong></li>)}</ul>
      </div>
    </section>
  </div>;
}

function MotionPanel({ value, enabled, reduced, onShuffle }: { value: number; enabled: boolean; reduced: boolean; onShuffle: () => void }) {
  const animate = enabled && !reduced;
  return <div className="lab-panel-stack">
    <section className="lab-motion-stage">
      <div className="lab-motion-orbit" aria-hidden="true">
        {[0, 1, 2].map((item) => <motion.i key={item} animate={animate ? { scale: [0.7, 1.15], opacity: [0.5, 0] } : { scale: 0.8, opacity: 0.15 }} transition={{ repeat: Infinity, duration: 2.2, delay: item * 0.55, ease: "easeOut" }} />)}
        <motion.div animate={animate ? { rotate: 360 } : { rotate: 0 }} transition={{ repeat: Infinity, duration: 8, ease: "linear" }}><Sparkles size={22} /></motion.div>
      </div>
      <span>Atualização inteligente</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.strong key={value} initial={animate ? { opacity: 0, y: 12, filter: "blur(5px)" } : false} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={animate ? { opacity: 0, y: -10 } : undefined} transition={{ duration: 0.36 }}>{value}%</motion.strong>
      </AnimatePresence>
      <p>Motion comunica mudança; o número continua sendo a informação principal.</p>
      <motion.button className="lab-action" type="button" onClick={onShuffle} whileTap={animate ? { scale: 0.96 } : undefined} whileHover={animate ? { y: -1 } : undefined}><MousePointerClick size={15} /> Simular atualização</motion.button>
    </section>
    <section className="lab-motion-feed">
      <div className="lab-section-title"><div><span>Microinterações</span><h2>Feedback em camadas</h2></div></div>
      {["Dados recebidos", "Limites recalculados", "Gráficos sincronizados"].map((label, index) => <motion.div key={`${label}-${value}`} initial={animate ? { opacity: 0, x: -8 } : false} animate={{ opacity: 1, x: 0 }} transition={{ delay: animate ? index * 0.12 : 0 }}><i>{index + 1}</i><span>{label}</span><strong>ok</strong></motion.div>)}
    </section>
  </div>;
}

export default function DesignLab({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<LabTab>("bars");
  const [theme, setTheme] = useState<LabTheme>("mineral");
  const [value, setValue] = useState(72);
  const [motionEnabled, setMotionEnabled] = useState(true);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const values = useMemo(() => [42, 57, 68, 79, 91], []);

  function shuffleValue() {
    const current = values.indexOf(value);
    setValue(values[(current + 1) % values.length]);
  }

  return <main className="app-shell design-lab" data-lab-theme={theme}>
    <header className="lab-topbar">
      <button className="icon-button" type="button" onClick={onBack} aria-label="Voltar ao monitor"><ArrowLeft size={16} /></button>
      <div><span>Área experimental</span><h1>Design Lab</h1></div>
      <button className={`lab-motion-toggle ${motionEnabled ? "is-on" : ""}`} type="button" onClick={() => setMotionEnabled((current) => !current)} aria-pressed={motionEnabled} title={motionEnabled ? "Desativar motion" : "Ativar motion"}>{motionEnabled ? <Pause size={13} /> : <Play size={13} />}<span>Motion</span></button>
    </header>

    <div className="lab-meta"><span><i /> Dados sintéticos</span><strong>{prefersReducedMotion ? "Movimento reduzido pelo sistema" : "Sandbox visual"}</strong></div>

    <div className="lab-controls">
      <div className="lab-theme-picker" aria-label="Tema do laboratório">
        {(["mineral", "ember", "violet"] as LabTheme[]).map((item) => <button key={item} type="button" onClick={() => setTheme(item)} className={theme === item ? "is-active" : ""} aria-pressed={theme === item}><i />{item === "mineral" ? "Mineral" : item === "ember" ? "Ember" : "Violet"}</button>)}
      </div>
      <label className="lab-range"><span>Intensidade</span><input type="range" min="5" max="100" value={value} onChange={(event) => setValue(Number(event.target.value))} /><strong>{value}%</strong></label>
    </div>

    <nav className="lab-tabs" aria-label="Experimentos de design">
      {([ ["bars", "Barras"], ["charts", "Gráficos"], ["motion", "Motion"] ] as Array<[LabTab, string]>).map(([id, label]) => <button key={id} type="button" onClick={() => setTab(id)} className={tab === id ? "is-active" : ""} aria-current={tab === id ? "page" : undefined}>{label}{tab === id && <motion.i layoutId="lab-tab" transition={{ duration: motionEnabled && !prefersReducedMotion ? 0.32 : 0, ease: [0.22, 1, 0.36, 1] }} />}</button>)}
    </nav>

    <div className="lab-scroll">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={tab} initial={motionEnabled && !prefersReducedMotion ? { opacity: 0, y: 8 } : false} animate={{ opacity: 1, y: 0 }} exit={motionEnabled && !prefersReducedMotion ? { opacity: 0, y: -5 } : undefined} transition={{ duration: 0.24 }}>
          {tab === "bars" && <BarsPanel value={value} enabled={motionEnabled} reduced={prefersReducedMotion} />}
          {tab === "charts" && <ChartsPanel enabled={motionEnabled} reduced={prefersReducedMotion} />}
          {tab === "motion" && <MotionPanel value={value} enabled={motionEnabled} reduced={prefersReducedMotion} onShuffle={shuffleValue} />}
        </motion.div>
      </AnimatePresence>
    </div>
  </main>;
}
