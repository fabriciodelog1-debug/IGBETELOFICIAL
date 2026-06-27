import React, { useState, useEffect, useRef } from "react";
import {
  Home,
  Calendar,
  Users,
  BookOpen,
  MoreHorizontal,
  Radio,
  Heart,
  HeartHandshake,
  PartyPopper,
  Phone,
  MapPin,
  Clock,
  Pencil,
  Plus,
  X,
  ExternalLink,
  ChevronRight,
  ChevronLeft,
  Facebook,
  Instagram,
  Youtube,
  Church,
  ArrowLeft,
  Trash2,
  Camera,
  ClipboardList,
  Music,
  Sparkles,
  Video,
  Lightbulb,
  UserPlus,
  FileText,
  Tv,
  LucideIcon,
  Share2,
  Search,
} from "lucide-react";

import {
  ENDERECO_SEDE,
  SOBRE_TEXTO,
  LIDERANCA,
  HORARIOS,
  REDES_SOCIAIS,
  LINK_BIBLIA_COMPLETA,
  VERSICULOS,
  PERSONAGENS_BIBLIA,
  EVENTOS_EXEMPLO,
  DIAS_SEMANA,
  REDES_MINISTERIOS,
  MINISTERIOS_ESCALA,
  STORAGE_KEY,
  STORAGE_KEY_VISTO_MEMBROS,
} from "./data";

// @ts-ignore
import FOTO_IGREJA_DEFAULT from "./assets/images/foto_igreja_betel_real_1782324243852.jpg";

import { doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

/* ======================================================================
   INTERFACE E CONFIGURAÇÃO DE PERSISTÊNCIA (AI Studio Storage / LocalStorage / Firestore)
   ====================================================================== */

interface StorageResult {
  value: string | null;
}

interface AIStudioStorage {
  get(key: string, shared: boolean): Promise<StorageResult | null>;
  set(key: string, value: string, shared: boolean): Promise<void>;
}

declare global {
  interface Window {
    storage: AIStudioStorage;
  }
}

// Força o uso do Firestore para dados compartilhados do aplicativo em qualquer ambiente (Editor ou Celular)
if (typeof window !== "undefined") {
  const originalStorage = window.storage;
  window.storage = {
    get: async (key: string, shared: boolean) => {
      // Se for a chave principal de dados (ou marcado como compartilhado), busca do Firestore na nuvem
      if (shared || key === STORAGE_KEY) {
        try {
          const docRef = doc(db, "dados_app", key);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            return { value: data?.value || null };
          }
        } catch (e) {
          console.error("Erro ao buscar dados do Firestore, usando fallback local:", e);
        }
        // Fallback local se estiver offline ou sem internet
        if (originalStorage) {
          try {
            const res = await originalStorage.get(key, shared);
            if (res && res.value) return res;
          } catch (e) {}
        }
        try {
          const val = localStorage.getItem(key);
          return { value: val };
        } catch (e) {
          return { value: null };
        }
      }

      // Para chaves locais (ex: betel:meu_cadastro_id), usa o storage local do aparelho
      if (originalStorage) {
        try {
          const res = await originalStorage.get(key, shared);
          if (res) return res;
        } catch (e) {}
      }
      try {
        const val = localStorage.getItem(key);
        return { value: val };
      } catch (e) {
        return { value: null };
      }
    },
    set: async (key: string, value: string, shared: boolean) => {
      // Salva em cache local do aparelho (localStorage)
      try {
        localStorage.setItem(key, value);
      } catch (e) {}

      // Se for a chave principal de dados (ou marcado como compartilhado), salva no Firestore na nuvem
      if (shared || key === STORAGE_KEY) {
        try {
          const docRef = doc(db, "dados_app", key);
          await setDoc(docRef, { value });
        } catch (e) {
          console.error("Erro ao salvar dados no Firestore:", e);
        }
        if (originalStorage) {
          await originalStorage.set(key, value, shared).catch(() => {});
        }
      } else {
        if (originalStorage) {
          await originalStorage.set(key, value, shared).catch(() => {});
        }
      }
    }
  };
}

interface Licao {
  id: number;
  titulo: string;
  semana: string;
  texto: string;
}

interface Visitante {
  id: number;
  nome: string;
  telefone: string;
  endereco: string;
  igreja: string;
}

interface Membro {
  id: number;
  nome: string;
  telefone: string;
  nascimento: string;
  dataBatismo: string;
  nomeLider: string;
  criadoEm?: number;
}

interface GrupoPastoreio {
  id: number;
  nome: string;
  lider: string;
  telefone: string;
  endereco: string;
  dia: string;
  horario: string;
  foto: string | null;
}

interface RedeSocial {
  foto: string | null;
  descricao: string;
}

interface Ministrante {
  nome: string;
  foto: string | null;
}

interface DadosApp {
  fotoIgreja: string | null;
  linksAoVivo: {
    youtube: string;
    radio: string;
    tvweb: string;
  };
  grupos: GrupoPastoreio[];
  redes: Record<string, RedeSocial>;
  escalas: Record<string, Record<string, string>>;
  visitantes: Visitante[];
  licoes: Licao[];
  ministrantes: Record<string, Ministrante>;
  membros: Membro[];
}

function dadosPadrao(): DadosApp {
  return {
    fotoIgreja: FOTO_IGREJA_DEFAULT,
    linksAoVivo: {
      youtube: REDES_SOCIAIS.youtube,
      radio: "",
      tvweb: "",
    },
    grupos: [],
    redes: {},
    escalas: { danca: {}, louvor: {}, midia: {} },
    visitantes: [],
    licoes: [],
    ministrantes: {},
    membros: [],
  };
}

function mesclarValor<T>(local: T, remoto: T, base: T): T {
  if (local === base) {
    return remoto;
  }
  return local;
}

function mesclarRecordSimples(
  local: Record<string, string>,
  remoto: Record<string, string>,
  base: Record<string, string>
): Record<string, string> {
  const chaves = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(remoto || {}),
    ...Object.keys(local || {})
  ]);
  const resultado: Record<string, string> = {};
  chaves.forEach((key) => {
    const valBase = base?.[key] || "";
    const valRemoto = remoto?.[key] || "";
    const valLocal = local?.[key] || "";
    resultado[key] = mesclarValor(valLocal, valRemoto, valBase);
  });
  return resultado;
}

function mesclarEscalas(
  local: Record<string, Record<string, string>>,
  remoto: Record<string, Record<string, string>>,
  base: Record<string, Record<string, string>>
): Record<string, Record<string, string>> {
  const ministerios = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(remoto || {}),
    ...Object.keys(local || {})
  ]);
  const resultado: Record<string, Record<string, string>> = {};
  ministerios.forEach((mId) => {
    resultado[mId] = mesclarRecordSimples(
      local?.[mId] || {},
      remoto?.[mId] || {},
      base?.[mId] || {}
    );
  });
  return resultado;
}

function mesclarRedes(
  local: Record<string, RedeSocial>,
  remoto: Record<string, RedeSocial>,
  base: Record<string, RedeSocial>
): Record<string, RedeSocial> {
  const chaves = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(remoto || {}),
    ...Object.keys(local || {})
  ]);
  const resultado: Record<string, RedeSocial> = {};
  chaves.forEach((key) => {
    const b = base?.[key] || { foto: null, descricao: "" };
    const r = remoto?.[key] || { foto: null, descricao: "" };
    const l = local?.[key] || { foto: null, descricao: "" };

    resultado[key] = {
      foto: mesclarValor(l.foto, r.foto, b.foto),
      descricao: mesclarValor(l.descricao, r.descricao, b.descricao),
    };
  });
  return resultado;
}

function mesclarMinistrantes(
  local: Record<string, Ministrante>,
  remoto: Record<string, Ministrante>,
  base: Record<string, Ministrante>
): Record<string, Ministrante> {
  const chaves = new Set([
    ...Object.keys(base || {}),
    ...Object.keys(remoto || {}),
    ...Object.keys(local || {})
  ]);
  const resultado: Record<string, Ministrante> = {};
  chaves.forEach((key) => {
    const b = base?.[key] || { nome: "", foto: null };
    const r = remoto?.[key] || { nome: "", foto: null };
    const l = local?.[key] || { nome: "", foto: null };

    resultado[key] = {
      nome: mesclarValor(l.nome, r.nome, b.nome),
      foto: mesclarValor(l.foto, r.foto, b.foto),
    };
  });
  return resultado;
}

function mesclarLista<T extends { id: number }>(
  local: T[],
  remoto: T[],
  base: T[]
): T[] {
  const lMap = new Map(local.map((item) => [item.id, item]));
  const rMap = new Map(remoto.map((item) => [item.id, item]));
  const bMap = new Map(base.map((item) => [item.id, item]));

  const todosIds = new Set([
    ...lMap.keys(),
    ...rMap.keys(),
    ...bMap.keys()
  ]);

  const resultado: T[] = [];

  todosIds.forEach((id) => {
    const emLocal = lMap.has(id);
    const emRemoto = rMap.has(id);
    const emBase = bMap.has(id);

    const itemLocal = lMap.get(id);
    const itemRemoto = rMap.get(id);
    const itemBase = bMap.get(id);

    if (emBase) {
      if (emLocal && emRemoto) {
        // Exists in all three
        const alteradoLocal = JSON.stringify(itemLocal) !== JSON.stringify(itemBase);
        const alteradoRemoto = JSON.stringify(itemRemoto) !== JSON.stringify(itemBase);

        if (alteradoLocal && !alteradoRemoto) {
          resultado.push(itemLocal!);
        } else if (alteradoRemoto && !alteradoLocal) {
          resultado.push(itemRemoto!);
        } else {
          resultado.push(itemLocal!);
        }
      } else if (!emLocal && emRemoto) {
        // Deleted locally
        const alteradoRemoto = JSON.stringify(itemRemoto) !== JSON.stringify(itemBase);
        if (alteradoRemoto) {
          resultado.push(itemRemoto!);
        }
      } else if (emLocal && !emRemoto) {
        // Deleted remotely
        const alteradoLocal = JSON.stringify(itemLocal) !== JSON.stringify(itemBase);
        if (alteradoLocal) {
          resultado.push(itemLocal!);
        }
      }
    } else {
      // Newly added
      if (emLocal && emRemoto) {
        resultado.push(itemLocal!);
      } else if (emLocal) {
        resultado.push(itemLocal!);
      } else if (emRemoto) {
        resultado.push(itemRemoto!);
      }
    }
  });

  return resultado;
}

function normalizarNome(nome: string): string {
  if (!nome) return "";
  return nome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function normalizarTelefone(tel: string): string {
  if (!tel) return "";
  return tel.replace(/[^0-9]/g, "");
}

function deduplicarMembros(membros: Membro[], meuId: number | null): Membro[] {
  const resultado: Membro[] = [];
  
  membros.forEach((m) => {
    const nomeNorm = normalizarNome(m.nome);
    const telNorm = normalizarTelefone(m.telefone);
    
    const indexDuplicado = resultado.findIndex((r) => {
      const rNomeNorm = normalizarNome(r.nome);
      const rTelNorm = normalizarTelefone(r.telefone);
      
      const mesmoNome = nomeNorm && rNomeNorm && nomeNorm === rNomeNorm;
      const mesmoTel = telNorm && telNorm.length >= 8 && rTelNorm && rTelNorm.length >= 8 && telNorm === rTelNorm;
      
      return mesmoNome || mesmoTel;
    });
    
    if (indexDuplicado !== -1) {
      const existente = resultado[indexDuplicado];
      let idParaManter = existente.id;
      if (meuId !== null) {
        if (m.id === meuId) {
          idParaManter = m.id;
        } else if (existente.id === meuId) {
          idParaManter = existente.id;
        } else {
          idParaManter = Math.min(existente.id, m.id);
        }
      } else {
        idParaManter = Math.min(existente.id, m.id);
      }
      
      resultado[indexDuplicado] = {
        id: idParaManter,
        nome: m.nome.trim().length > existente.nome.trim().length ? m.nome : existente.nome,
        telefone: telNorm.length > normalizarTelefone(existente.telefone).length ? m.telefone : existente.telefone,
        nascimento: m.nascimento || existente.nascimento,
        dataBatismo: m.dataBatismo || existente.dataBatismo,
        nomeLider: m.nomeLider || existente.nomeLider,
        criadoEm: Math.min(m.criadoEm || m.id, existente.criadoEm || existente.id),
      };
    } else {
      resultado.push({ ...m });
    }
  });
  
  return resultado;
}

function mesclarTresCaminhos(
  local: DadosApp,
  remoto: DadosApp,
  base: DadosApp,
  meuId: number | null = null
): DadosApp {
  const fotoIgreja = mesclarValor(local.fotoIgreja, remoto.fotoIgreja, base.fotoIgreja);
  
  const linksAoVivo = {
    youtube: mesclarValor(local.linksAoVivo?.youtube || "", remoto.linksAoVivo?.youtube || "", base.linksAoVivo?.youtube || ""),
    radio: mesclarValor(local.linksAoVivo?.radio || "", remoto.linksAoVivo?.radio || "", base.linksAoVivo?.radio || ""),
    tvweb: mesclarValor(local.linksAoVivo?.tvweb || "", remoto.linksAoVivo?.tvweb || "", base.linksAoVivo?.tvweb || ""),
  };

  const grupos = mesclarLista(local.grupos || [], remoto.grupos || [], base.grupos || []).sort(
    (a, b) => b.id - a.id
  );

  const redes = mesclarRedes(local.redes || {}, remoto.redes || {}, base.redes || {});

  const escalas = mesclarEscalas(local.escalas || {}, remoto.escalas || {}, base.escalas || {});

  const visitantes = mesclarLista(local.visitantes || [], remoto.visitantes || [], base.visitantes || []).sort(
    (a, b) => b.id - a.id
  );

  const licoes = mesclarLista(local.licoes || [], remoto.licoes || [], base.licoes || []).sort(
    (a, b) => b.id - a.id
  );

  const ministrantes = mesclarMinistrantes(local.ministrantes || {}, remoto.ministrantes || {}, base.ministrantes || {});

  let membrosMesclados = mesclarLista(local.membros || [], remoto.membros || [], base.membros || []);
  membrosMesclados = deduplicarMembros(membrosMesclados, meuId);
  const membros = membrosMesclados.sort(
    (a, b) => b.id - a.id
  );

  return {
    fotoIgreja,
    linksAoVivo,
    grupos,
    redes,
    escalas,
    visitantes,
    licoes,
    ministrantes,
    membros,
  };
}

const ABAS = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "cultos", label: "Cultos", icon: Calendar },
  { id: "grupos", label: "Grupos", icon: Users },
  { id: "biblia", label: "Bíblia", icon: BookOpen },
  { id: "mais", label: "Mais", icon: MoreHorizontal },
];

const SUB_DE_MAIS = [
  "aovivo",
  "escala",
  "ministerios",
  "devocional",
  "eventos",
  "redes",
  "curiosidades",
  "membros",
  "sobre",
];

const SUB_DE_GRUPOS = ["visitantes", "licoes"];

function telaPai(tela: string): string | null {
  if (SUB_DE_MAIS.includes(tela)) return "mais";
  if (SUB_DE_GRUPOS.includes(tela)) return "grupos";
  return null;
}

// Compactador e redimensionador de fotos em client-side
function lerArquivoComoBase64(arquivo: File, larguraMax = 900, qualidade = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => {
      const imagem = new Image();
      imagem.onload = () => {
        let { width, height } = imagem;
        if (width > larguraMax) {
          height = Math.round((height * larguraMax) / width);
          width = larguraMax;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(imagem, 0, 0, width, height);
          try {
            resolve(canvas.toDataURL("image/jpeg", qualidade));
          } catch (err) {
            reject(err);
          }
        } else {
          reject(new Error("Erro ao carregar contexto 2D"));
        }
      };
      imagem.onerror = reject;
      imagem.src = leitor.result as string;
    };
    leitor.onerror = reject;
    leitor.readAsDataURL(arquivo);
  });
}

/* ======================================================================
   SUB-COMPONENTES AUXILIARES
   ====================================================================== */

function Logo({ className }: { className?: string }) {
  return (
    <div className={`rounded-full bg-red-700 flex items-center justify-center text-white shrink-0 ${className || "w-9 h-9"}`}>
      <Church size={20} />
    </div>
  );
}

interface FotoUploadProps {
  foto: string | null;
  onTrocar: (foto: string) => void;
  alto?: boolean;
  pequeno?: boolean;
  rotulo?: string;
}

function FotoUpload({ foto, onTrocar, alto = false, pequeno = false, rotulo = "Adicionar foto" }: FotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const aoEscolher = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    try {
      const base64 = await lerArquivoComoBase64(arquivo);
      onTrocar(base64);
    } catch (err) {
      console.error("Não foi possível carregar a imagem", err);
    }
    e.target.value = "";
  };

  if (pequeno) {
    return (
      <div className="relative w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
        {foto ? (
          <img src={foto} alt={rotulo} className="w-full h-full object-cover" />
        ) : (
          <Camera size={16} className="text-gray-400" />
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Adicionar ou trocar foto"
          className="absolute inset-0 bg-black/0 active:bg-black/20"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={aoEscolher}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center ${
        alto ? "h-44" : "h-28"
      }`}
    >
      {foto ? (
        <img src={foto} alt={rotulo} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-400 text-xs flex flex-col items-center gap-1 px-4 text-center font-sans font-medium">
          <Camera size={22} />
          {rotulo}
        </span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Adicionar ou trocar foto"
        className="absolute bottom-2 right-2 bg-red-700 text-white p-2 rounded-full shadow"
      >
        <Camera size={16} />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={aoEscolher}
        className="hidden"
      />
    </div>
  );
}

interface CabecalhoAppProps {
  titulo: string;
  voltarPara: string | null;
  onVoltar: () => void;
}

function CabecalhoApp({ titulo, voltarPara, onVoltar }: CabecalhoAppProps) {
  return (
    <div className="flex items-center gap-3 px-4 py-4 bg-black text-white shrink-0">
      {voltarPara ? (
        <button
          onClick={onVoltar}
          aria-label="Voltar"
          className="p-1 -ml-1 rounded-full hover:bg-white/10 active:bg-white/20"
        >
          <ArrowLeft size={22} />
        </button>
      ) : (
        <Logo className="w-9 h-9 border border-white/20 bg-black" />
      )}
      <h1 className="text-lg font-extrabold tracking-tight font-sans">{titulo}</h1>
    </div>
  );
}

function Selo({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-1.5 h-5 bg-red-700 rounded-sm" />
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-gray-900 font-sans">
        {children}
      </h2>
    </div>
  );
}

interface BotaoRapidoProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

function BotaoRapido({ icon: Icon, label, onClick }: BotaoRapidoProps) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-4 shadow-sm active:scale-95 transition-transform"
    >
      <span className="w-11 h-11 rounded-full bg-red-700 flex items-center justify-center text-white">
        <Icon size={20} />
      </span>
      <span className="text-xs font-bold text-gray-800 font-sans">{label}</span>
    </button>
  );
}

/* ======================================================================
   TELA INÍCIO
   ====================================================================== */

interface TelaInicioProps {
  ir: (tela: string) => void;
  fotoIgreja: string | null;
  onTrocarFotoIgreja: (foto: string) => void;
  onAbrirCadastroMembro: () => void;
  meuMembro: Membro | null;
  onEditarMeuCadastro: (m: Membro) => void;
  onExcluirMeuCadastro: () => void;
  totalMembros: number;
  linksAoVivo?: Record<string, string>;
}

function TelaInicio({
  ir,
  fotoIgreja,
  onTrocarFotoIgreja,
  onAbrirCadastroMembro,
  meuMembro,
  onEditarMeuCadastro,
  onExcluirMeuCadastro,
  totalMembros,
  linksAoVivo,
}: TelaInicioProps) {
  const inputIgrejaRef = useRef<HTMLInputElement>(null);

  return (
    <div className="px-4 py-5 space-y-6">
      <div className="bg-black rounded-2xl p-5 text-white relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-28 h-28 bg-red-700 rounded-full opacity-30" />
        <Logo className="w-16 h-16 border-2 border-white/20 mb-3 relative z-10" />
        <p className="text-sm text-gray-300 relative z-10 font-sans">Seja bem-vindo(a) à</p>
        <p className="text-2xl font-extrabold relative z-10 font-sans">Igreja Betel</p>
        <p className="text-xs text-gray-400 mt-1 relative z-10 font-mono">Eunápolis - BA</p>
      </div>

      {linksAoVivo?.youtube ? (
        <a
          href={linksAoVivo.youtube.startsWith("http") ? linksAoVivo.youtube : `https://${linksAoVivo.youtube}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white rounded-2xl p-4 shadow-md animate-pulse active:scale-98 transition-transform border border-red-500"
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-100">Transmissão Ativa</p>
              <h4 className="font-extrabold text-sm font-sans">Culto Ao Vivo no YouTube</h4>
              <p className="text-[10px] text-red-100/95 font-sans mt-0.5 font-semibold">Live domingo todo domingo às 18h30</p>
            </div>
          </div>
          <span className="bg-white/20 text-white font-extrabold text-xs px-3 py-1.5 rounded-xl border border-white/20 flex items-center gap-1 shrink-0 font-sans">
            <Youtube size={14} /> Assistir Agora
          </span>
        </a>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-full bg-red-50 text-red-700 flex items-center justify-center shrink-0">
              <Youtube size={20} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-red-700">Culto no YouTube</p>
              <h4 className="font-extrabold text-sm text-gray-900 font-sans">Canal Oficial</h4>
              <p className="text-[10px] text-gray-500 font-sans mt-0.5">Live domingo todo domingo às 18h30</p>
            </div>
          </div>
          <button
            onClick={() => ir("aovivo")}
            className="text-red-700 font-extrabold text-xs px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 flex items-center gap-1 shrink-0 font-sans transition-colors"
          >
            Ativar Culto ao Vivo
          </button>
        </div>
      )}

      {/* BANNER DE AUTOCADASTRO OU EXIBIÇÃO DA FICHA DE MEMBRO */}
      {meuMembro ? (
        <div className="bg-white border-2 border-red-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden animate-fadeIn">
          <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-red-50 rounded-full" />
          <div className="relative z-10 flex items-center justify-between border-b border-gray-100 pb-3">
            <div>
              <span className="bg-red-700 text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans inline-block mb-1">
                Ficha de Membro Oficial
              </span>
              {totalMembros > 0 && (
                <span className="bg-red-50 text-red-700 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans inline-flex items-center gap-1 ml-1.5 align-middle mb-1">
                  {totalMembros} {totalMembros === 1 ? "Membro" : "Membros"}
                </span>
              )}
              <h3 className="font-extrabold text-gray-900 text-base font-sans">Igreja Betel</h3>
            </div>
            <Logo className="w-10 h-10 border border-red-100 bg-red-50 text-red-700" />
          </div>

          <div className="relative z-10 space-y-2 text-xs text-gray-700 font-sans">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nome Completo</p>
              <p className="font-extrabold text-gray-900 text-sm">{meuMembro.nome}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {meuMembro.telefone && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Contato</p>
                  <p className="font-bold text-gray-800">{meuMembro.telefone}</p>
                </div>
              )}
              {meuMembro.nascimento && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Nascimento</p>
                  <p className="font-bold text-gray-800">{meuMembro.nascimento.split("-").reverse().join("/")}</p>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {meuMembro.dataBatismo && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Batismo</p>
                  <p className="font-bold text-gray-800">{meuMembro.dataBatismo.split("-").reverse().join("/")}</p>
                </div>
              )}
              {meuMembro.nomeLider && (
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Líder Pastoreio</p>
                  <p className="font-bold text-gray-800">{meuMembro.nomeLider}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 relative z-10 pt-1">
            <button
              onClick={() => onEditarMeuCadastro(meuMembro)}
              className="flex-1 bg-gray-100 text-gray-700 font-extrabold text-xs py-2.5 rounded-xl active:scale-95 transition-all flex items-center justify-center gap-1.5 border border-gray-200"
            >
              <Pencil size={14} /> Editar Ficha
            </button>
            <button
              onClick={onExcluirMeuCadastro}
              className="px-3 bg-red-50 text-red-700 hover:bg-red-100 rounded-xl active:scale-95 transition-all border border-red-100 flex items-center justify-center"
              aria-label="Excluir meu cadastro local"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-red-100 rounded-2xl p-5 shadow-sm space-y-3 relative overflow-hidden">
          <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-red-50 rounded-full" />
          <div className="relative z-10 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-red-100 text-red-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans inline-block mb-1">
                Membro Betel
              </span>
              {totalMembros > 0 && (
                <span className="bg-green-50 text-green-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider font-sans inline-flex items-center gap-1 mb-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {totalMembros} {totalMembros === 1 ? "Cadastrado" : "Cadastrados"}
                </span>
              )}
            </div>
            <h3 className="font-extrabold text-gray-900 text-base font-sans">Quer fazer parte da nossa família?</h3>
            <p className="text-xs text-gray-600 leading-relaxed font-sans">
              Seja membro oficial da Igreja Betel! Faça seu cadastro de forma simples para receber novidades e ter acompanhamento pastoral.
            </p>
          </div>
          <button
            onClick={onAbrirCadastroMembro}
            className="w-full bg-red-700 text-white font-extrabold text-xs py-3 rounded-xl hover:bg-red-800 active:scale-95 transition-all shadow-sm relative z-10 flex items-center justify-center gap-2"
          >
            <UserPlus size={16} />
            Quero me Cadastrar
          </button>
        </div>
      )}

      <div>
        <Selo>Foto da igreja</Selo>
        <div 
          onClick={() => inputIgrejaRef.current?.click()}
          className="relative w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200 h-48 shadow-sm cursor-pointer group"
          title="Clique para trocar a foto da igreja"
        >
          {fotoIgreja && fotoIgreja !== "sem_foto" ? (
            <>
              <img 
                src={fotoIgreja} 
                alt="Igreja Betel" 
                className="w-full h-full object-cover group-hover:brightness-90 transition-all" 
                referrerPolicy="no-referrer"
              />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrocarFotoIgreja("sem_foto");
                }}
                className="absolute top-3 right-3 bg-red-700 hover:bg-red-800 text-white p-2.5 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all z-25 flex items-center justify-center border border-red-600/30"
                title="Remover foto"
              >
                <Trash2 size={16} />
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 font-sans text-xs">
              <Camera size={24} className="mb-1 text-gray-400" />
              <span>Clique para carregar a foto da igreja</span>
            </div>
          )}
          {/* Legenda sutil ao passar o mouse para facilitar a edição */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-xs font-sans gap-1 font-semibold pointer-events-none">
            <Camera size={20} />
            <span>Trocar foto da igreja</span>
          </div>
          <input
            ref={inputIgrejaRef}
            type="file"
            accept="image/*"
            onChange={async (e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) {
                try {
                  const base64 = await lerArquivoComoBase64(arquivo);
                  onTrocarFotoIgreja(base64);
                } catch (err) {
                  console.error("Erro ao ler foto da igreja:", err);
                }
              }
            }}
            className="hidden"
          />
        </div>
      </div>

      <div>
        <Selo>Acesso rápido</Selo>
        <div className="grid grid-cols-4 gap-3">
          <BotaoRapido icon={Radio} label="Ao Vivo" onClick={() => ir("aovivo")} />
          <BotaoRapido icon={Users} label="Grupos" onClick={() => ir("grupos")} />
          <BotaoRapido icon={BookOpen} label="Bíblia" onClick={() => ir("biblia")} />
          <BotaoRapido icon={Instagram} label="Social" onClick={() => ir("redes")} />
        </div>
      </div>

      <div>
        <Selo>Próximo culto</Selo>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex items-center gap-3">
          <span className="w-11 h-11 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
            <Clock size={20} />
          </span>
          <div>
            <p className="font-extrabold text-gray-900 font-sans">{HORARIOS[0].titulo}</p>
            <p className="text-sm text-gray-600 font-sans">
              {HORARIOS[0].dia} • {HORARIOS[0].horario}
            </p>
          </div>
          <button
            onClick={() => ir("cultos")}
            className="ml-auto text-red-700"
            aria-label="Ver todos os cultos"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div>
        <Selo>Sobre a igreja</Selo>
        <p className="text-sm text-gray-700 leading-relaxed font-sans">{SOBRE_TEXTO}</p>
      </div>
    </div>
  );
}

/* ======================================================================
   TELA CULTOS
   ====================================================================== */

interface TelaCultosProps {
  ministrantes: Record<string, Ministrante>;
  atualizarMinistrante: (dia: string, dados: Ministrante) => void;
}

function TelaCultos({ ministrantes, atualizarMinistrante }: TelaCultosProps) {
  return (
    <div className="px-4 py-5 space-y-5">
      <Selo>Horários de culto</Selo>
      <div className="space-y-3">
        {HORARIOS.map((h, i) => {
          const ministrante = ministrantes[h.dia] || { nome: "", foto: null };
          return (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-black text-white flex flex-col items-center justify-center shrink-0">
                  <span className="text-xs leading-none font-mono">{h.dia.slice(0, 3)}</span>
                  <span className="text-sm font-extrabold leading-none mt-1 font-mono">
                    {h.horario}
                  </span>
                </div>
                <div>
                  <p className="font-extrabold text-gray-900 font-sans">{h.titulo}</p>
                  <p className="text-sm text-gray-600 font-sans">
                    {h.dia} às {h.horario}
                  </p>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                <FotoUpload
                  foto={ministrante.foto}
                  onTrocar={(b64) =>
                    atualizarMinistrante(h.dia, { ...ministrante, foto: b64 })
                  }
                  pequeno
                  rotulo="Foto"
                />
                <div className="flex-1">
                  <p className="text-xs font-bold text-gray-500 mb-1 font-sans">
                    Quem vai ministrar
                  </p>
                  <input
                    value={ministrante.nome}
                    onChange={(e) =>
                      atualizarMinistrante(h.dia, {
                        ...ministrante,
                        nome: e.target.value,
                      })
                    }
                    placeholder="Nome de quem vai ministrar"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Selo>Local</Selo>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          ENDERECO_SEDE
        )}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
      >
        <span className="w-11 h-11 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
          <MapPin size={20} />
        </span>
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-sm font-sans">{ENDERECO_SEDE}</p>
          <p className="text-xs text-gray-500 font-sans">Toque para abrir no mapa</p>
        </div>
        <ExternalLink size={16} className="text-gray-400" />
      </a>
    </div>
  );
}

/* ======================================================================
   TELA GRUPOS PASTOREIO
   ====================================================================== */

interface FormularioGrupoProps {
  inicial: GrupoPastoreio | null;
  onSalvar: (form: Omit<GrupoPastoreio, "id"> & { id?: number }) => void;
  onCancelar: () => void;
}

function FormularioGrupo({ inicial, onSalvar, onCancelar }: FormularioGrupoProps) {
  const [form, setForm] = useState(
    inicial || {
      nome: "",
      lider: "",
      telefone: "",
      endereco: "",
      dia: DIAS_SEMANA[3],
      horario: "",
      foto: null as string | null,
    }
  );

  const campo = (chave: string, valor: string | null) => setForm((f) => ({ ...f, [chave]: valor }));
  const podeSalvar = form.nome.trim() && form.lider.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg text-gray-900 font-sans">
            {inicial ? "Editar grupo" : "Novo grupo pastoreio"}
          </h3>
          <button onClick={onCancelar} aria-label="Fechar">
            <X size={22} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Foto do grupo</label>
            <div className="mt-1">
              <FotoUpload
                foto={form.foto}
                onTrocar={(b64) => campo("foto", b64)}
                rotulo="Adicionar foto do grupo"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Nome do grupo</label>
            <input
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              placeholder="Ex: Célula Pequi"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Líder responsável</label>
            <input
              value={form.lider}
              onChange={(e) => campo("lider", e.target.value)}
              placeholder="Nome do líder"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => campo("telefone", e.target.value)}
              placeholder="(73) 9 9999-9999"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">
              Endereço da reunião
            </label>
            <input
              value={form.endereco}
              onChange={(e) => campo("endereco", e.target.value)}
              placeholder="Rua, número, bairro"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 font-sans">Dia</label>
              <select
                value={form.dia}
                onChange={(e) => campo("dia", e.target.value)}
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans bg-white"
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 font-sans">Horário</label>
              <input
                value={form.horario}
                onChange={(e) => campo("horario", e.target.value)}
                placeholder="19h30"
                className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
              />
            </div>
          </div>
        </div>

        <button
          disabled={!podeSalvar}
          onClick={() => onSalvar(form)}
          className="w-full mt-5 bg-red-700 disabled:bg-gray-300 text-white font-extrabold py-3 rounded-xl font-sans"
        >
          Salvar grupo
        </button>
      </div>
    </div>
  );
}

interface TelaGruposProps {
  grupos: GrupoPastoreio[];
  setGrupos: React.Dispatch<React.SetStateAction<GrupoPastoreio[]>>;
  ir: (tela: string) => void;
}

function TelaGrupos({ grupos, setGrupos, ir }: TelaGruposProps) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<GrupoPastoreio | null>(null);

  const salvar = (form: Omit<GrupoPastoreio, "id">) => {
    if (editando) {
      setGrupos((g) =>
        g.map((item) => (item.id === editando.id ? { ...form, id: item.id } : item))
      );
    } else {
      setGrupos((g) => [...g, { ...form, id: Date.now() }]);
    }
    setMostrarForm(false);
    setEditando(null);
  };

  const remover = (id: number) => setGrupos((g) => g.filter((item) => item.id !== id));

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => ir("visitantes")}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm"
        >
          <span className="w-10 h-10 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
            <UserPlus size={18} />
          </span>
          <span className="text-sm font-bold text-gray-900 text-left font-sans">Visitantes</span>
        </button>
        <button
          onClick={() => ir("licoes")}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-3 shadow-sm"
        >
          <span className="w-10 h-10 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
            <FileText size={18} />
          </span>
          <span className="text-sm font-bold text-gray-900 text-left font-sans">Lições</span>
        </button>
      </div>

      <div className="flex items-center justify-between">
        <Selo>Grupos pastoreio</Selo>
        <button
          onClick={() => {
            setEditando(null);
            setMostrarForm(true);
          }}
          className="flex items-center gap-1 bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-full -mt-3 font-sans"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {grupos.length === 0 ? (
        <div className="text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl py-10 px-4">
          <Users size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 font-sans">
            Nenhum grupo cadastrado ainda. Toque em "Adicionar" para incluir o
            líder, telefone, endereço e dia da reunião.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((g) => (
            <div
              key={g.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
            >
              {g.foto && (
                <img
                  src={g.foto}
                  alt={g.nome}
                  className="w-full h-28 object-cover rounded-xl mb-3"
                />
              )}
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-extrabold text-gray-900 font-sans">{g.nome}</p>
                  <p className="text-sm text-gray-600 font-sans">Líder: {g.lider}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditando(g);
                      setMostrarForm(true);
                    }}
                    aria-label="Editar grupo"
                    className="text-gray-400"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remover(g.id)}
                    aria-label="Remover grupo"
                    className="text-gray-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-3 space-y-1.5 text-sm text-gray-700 font-sans">
                {g.dia && (
                  <p className="flex items-center gap-2">
                    <Clock size={14} className="text-red-700" />
                    {g.dia} {g.horario && `às ${g.horario}`}
                  </p>
                )}
                {g.endereco && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-red-700" /> {g.endereco}
                  </p>
                )}
                {g.telefone && (
                  <a
                    href={`tel:${g.telefone.replace(/\D/g, "")}`}
                    className="flex items-center gap-2 text-red-700 font-bold"
                  >
                    <Phone size={14} /> {g.telefone}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <FormularioGrupo
          inicial={editando}
          onSalvar={salvar}
          onCancelar={() => {
            setMostrarForm(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================================================================
   TELA VISITANTES
   ====================================================================== */

interface FormularioVisitanteProps {
  inicial: Visitante | null;
  onSalvar: (form: Omit<Visitante, "id"> & { id?: number }) => void;
  onCancelar: () => void;
}

function FormularioVisitante({ inicial, onSalvar, onCancelar }: FormularioVisitanteProps) {
  const [form, setForm] = useState(
    inicial || { nome: "", telefone: "", endereco: "", igreja: "" }
  );
  const campo = (chave: string, valor: string) => setForm((f) => ({ ...f, [chave]: valor }));
  const podeSalvar = form.nome.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg text-gray-900 font-sans">
            {inicial ? "Editar visitante" : "Novo visitante"}
          </h3>
          <button onClick={onCancelar} aria-label="Fechar">
            <X size={22} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Nome</label>
            <input
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              placeholder="Nome do visitante"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => campo("telefone", e.target.value)}
              placeholder="(73) 9 9999-9999"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Endereço</label>
            <input
              value={form.endereco}
              onChange={(e) => campo("endereco", e.target.value)}
              placeholder="Rua, número, bairro"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">
              Já participa de alguma igreja?
            </label>
            <input
              value={form.igreja}
              onChange={(e) => campo("igreja", e.target.value)}
              placeholder="Ex: Não / Sim, igreja X"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
        </div>

        <button
          disabled={!podeSalvar}
          onClick={() => onSalvar(form)}
          className="w-full mt-5 bg-red-700 disabled:bg-gray-300 text-white font-extrabold py-3 rounded-xl font-sans"
        >
          Salvar visitante
        </button>
      </div>
    </div>
  );
}

interface TelaVisitantesProps {
  visitantes: Visitante[];
  setVisitantes: React.Dispatch<React.SetStateAction<Visitante[]>>;
}

function TelaVisitantes({ visitantes, setVisitantes }: TelaVisitantesProps) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Visitante | null>(null);

  const salvar = (form: Omit<Visitante, "id">) => {
    if (editando) {
      setVisitantes((v) =>
        v.map((item) => (item.id === editando.id ? { ...form, id: item.id } : item))
      );
    } else {
      setVisitantes((v) => [...v, { ...form, id: Date.now() }]);
    }
    setMostrarForm(false);
    setEditando(null);
  };

  const remover = (id: number) =>
    setVisitantes((v) => v.filter((item) => item.id !== id));

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <Selo>Cadastro de visitantes</Selo>
        <button
          onClick={() => {
            setEditando(null);
            setMostrarForm(true);
          }}
          className="flex items-center gap-1 bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-full -mt-3 font-sans"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {visitantes.length === 0 ? (
        <div className="text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl py-10 px-4">
          <UserPlus size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 font-sans">
            Nenhum visitante cadastrado ainda. Toque em "Adicionar" pra
            registrar nome, telefone e endereço de quem visitar a igreja.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visitantes.map((v) => (
            <div
              key={v.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="font-extrabold text-gray-900 font-sans">{v.nome}</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditando(v);
                      setMostrarForm(true);
                    }}
                    aria-label="Editar visitante"
                    className="text-gray-400"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remover(v.id)}
                    aria-label="Remover visitante"
                    className="text-gray-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1.5 text-sm text-gray-700 font-sans">
                {v.telefone && (
                  <a
                    href={`tel:${v.telefone.replace(/\D/g, "")}`}
                    className="flex items-center gap-2 text-red-700 font-bold"
                  >
                    <Phone size={14} /> {v.telefone}
                  </a>
                )}
                {v.endereco && (
                  <p className="flex items-center gap-2">
                    <MapPin size={14} className="text-red-700" /> {v.endereco}
                  </p>
                )}
                {v.igreja && (
                  <p className="text-xs text-gray-500">
                    Já participa de igreja: {v.igreja}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <FormularioVisitante
          inicial={editando}
          onSalvar={salvar}
          onCancelar={() => {
            setMostrarForm(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================================================================
   TELA LIÇÕES
   ====================================================================== */

interface FormularioLicaoProps {
  inicial: Licao | null;
  onSalvar: (form: Omit<Licao, "id"> & { id?: number }) => void;
  onCancelar: () => void;
}

function FormularioLicao({ inicial, onSalvar, onCancelar }: FormularioLicaoProps) {
  const [form, setForm] = useState(inicial || { titulo: "", semana: "", texto: "" });
  const campo = (chave: string, valor: string) => setForm((f) => ({ ...f, [chave]: valor }));
  const podeSalvar = form.titulo.trim() && form.texto.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg text-gray-900 font-sans">
            {inicial ? "Editar lição" : "Nova lição"}
          </h3>
          <button onClick={onCancelar} aria-label="Fechar">
            <X size={22} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Título da lição</label>
            <input
              value={form.titulo}
              onChange={(e) => campo("titulo", e.target.value)}
              placeholder="Ex: A fé que move montanhas"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Semana</label>
            <input
              value={form.semana}
              onChange={(e) => campo("semana", e.target.value)}
              placeholder="Ex: Semana de 23 a 29 de junho"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Texto da lição</label>
            <textarea
              value={form.texto}
              onChange={(e) => campo("texto", e.target.value)}
              placeholder="Escreva aqui o conteúdo da lição..."
              rows={6}
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 resize-none font-sans"
            />
          </div>
        </div>

        <button
          disabled={!podeSalvar}
          onClick={() => onSalvar(form)}
          className="w-full mt-5 bg-red-700 disabled:bg-gray-300 text-white font-extrabold py-3 rounded-xl font-sans"
        >
          Salvar lição
        </button>
      </div>
    </div>
  );
}

interface TelaLicoesProps {
  licoes: Licao[];
  setLicoes: React.Dispatch<React.SetStateAction<Licao[]>>;
}

function TelaLicoes({ licoes, setLicoes }: TelaLicoesProps) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Licao | null>(null);
  const [aberta, setAberta] = useState<number | null>(null);

  const salvar = (form: Omit<Licao, "id">) => {
    if (editando) {
      setLicoes((l) =>
        l.map((item) => (item.id === editando.id ? { ...form, id: item.id } : item))
      );
    } else {
      setLicoes((l) => [{ ...form, id: Date.now() }, ...l]);
    }
    setMostrarForm(false);
    setEditando(null);
  };

  const remover = (id: number) => setLicoes((l) => l.filter((item) => item.id !== id));

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <Selo>Lições do grupo pastoreio</Selo>
        <button
          onClick={() => {
            setEditando(null);
            setMostrarForm(true);
          }}
          className="flex items-center gap-1 bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-full -mt-3 font-sans"
        >
          <Plus size={14} /> Nova
        </button>
      </div>

      {licoes.length === 0 ? (
        <div className="text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl py-10 px-4">
          <FileText size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 font-sans">
            Nenhuma lição publicada ainda. Toque em "Nova" para postar a
            lição da semana pro grupo acompanhar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {licoes.map((l) => {
            const expandida = aberta === l.id;
            return (
              <div
                key={l.id}
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <button
                  onClick={() => setAberta(expandida ? null : l.id)}
                  className="w-full flex items-start gap-3 p-4 text-left"
                >
                  <span className="w-10 h-10 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
                    <FileText size={18} />
                  </span>
                  <div className="flex-1">
                    <p className="font-extrabold text-gray-900 text-sm font-sans">{l.titulo}</p>
                    {l.semana && (
                      <p className="text-xs text-gray-500 font-sans">{l.semana}</p>
                    )}
                  </div>
                  <ChevronRight
                    size={18}
                    className={`text-gray-400 transition-transform mt-2 ${
                      expandida ? "rotate-90" : ""
                    }`}
                  />
                </button>
                {expandida && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap font-sans">
                      {l.texto}
                    </p>
                    <div className="flex gap-3 mt-3">
                      <button
                        onClick={() => {
                          setEditando(l);
                          setMostrarForm(true);
                        }}
                        className="text-xs font-bold text-gray-500 flex items-center gap-1 font-sans"
                      >
                        <Pencil size={14} /> Editar
                      </button>
                      <button
                        onClick={() => remover(l.id)}
                        className="text-xs font-bold text-gray-500 flex items-center gap-1 font-sans"
                      >
                        <Trash2 size={14} /> Remover
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {mostrarForm && (
        <FormularioLicao
          inicial={editando}
          onSalvar={salvar}
          onCancelar={() => {
            setMostrarForm(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================================================================
   TELA BÍBLIA
   ====================================================================== */

interface TelaBibliaProps {
  ir: (tela: string) => void;
}

function TelaBiblia({ ir }: TelaBibliaProps) {
  const [indice, setIndice] = useState(0);
  const [copiado, setCopiado] = useState(false);
  const [busca, setBusca] = useState("");
  const [copiadoIdx, setCopiadoIdx] = useState<number | null>(null);
  const v = VERSICULOS[indice];

  const proximo = () => setIndice((i) => (i + 1) % VERSICULOS.length);
  const anterior = () =>
    setIndice((i) => (i - 1 + VERSICULOS.length) % VERSICULOS.length);

  const copiarParaClipboard = (texto: string) => {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    }).catch((err) => {
      console.error("Falha ao copiar texto: ", err);
    });
  };

  const compartilhar = async () => {
    const textoCompartilhar = `"${v.texto}" - ${v.ref}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Versículo do Dia",
          text: textoCompartilhar,
        });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          copiarParaClipboard(textoCompartilhar);
        }
      }
    } else {
      copiarParaClipboard(textoCompartilhar);
    }
  };

  // Normalizar strings para comparação (tirando acentos e deixando minúsculo)
  const normalizar = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const resultados = busca.trim() === ""
    ? []
    : VERSICULOS.map((item, originalIndex) => ({ ...item, originalIndex }))
        .filter(
          (item) =>
            normalizar(item.texto).includes(normalizar(busca)) ||
            normalizar(item.ref).includes(normalizar(busca))
        );

  return (
    <div className="px-4 py-5 space-y-5">
      <Selo>Versículo do dia</Selo>
      <div className="bg-black text-white rounded-2xl p-5 relative overflow-hidden">
        <div className="absolute -left-4 -bottom-6 w-24 h-24 bg-red-700 rounded-full opacity-30" />
        <p className="text-lg font-bold leading-relaxed relative z-10 font-sans">
          "{v.texto}"
        </p>
        <p className="text-sm text-gray-300 mt-3 relative z-10 font-sans">{v.ref}</p>
        <div className="flex justify-between items-center mt-4 relative z-10">
          <button onClick={anterior} aria-label="Anterior" className="p-2 rounded-full bg-white/10 active:scale-95 transition-transform hover:bg-white/20">
            <ChevronLeft size={18} />
          </button>
          
          <button
            onClick={compartilhar}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-700 text-white font-extrabold text-xs active:scale-95 transition-all hover:bg-red-800 shadow-md font-sans"
          >
            <Share2 size={13} />
            {copiado ? "Copiado!" : "Compartilhar"}
          </button>

          <button onClick={proximo} aria-label="Próximo" className="p-2 rounded-full bg-white/10 active:scale-95 transition-transform hover:bg-white/20">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* CAMPO DE PESQUISA */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
        <h4 className="font-extrabold text-gray-900 text-sm font-sans flex items-center gap-2">
          <Search size={16} className="text-red-700" />
          <span>Pesquisar Versículos</span>
        </h4>
        <p className="text-xs text-gray-500 font-sans">
          Busque por palavras-chave (ex: "fortalece", "Deus", "pastor") ou referências (ex: "Salmos", "Filipenses").
        </p>
        <div className="relative">
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Digite palavras ou livro..."
            className="w-full border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
          />
          <Search size={16} className="absolute left-3.5 top-3.5 text-gray-400" />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-3 p-0.5 hover:bg-gray-100 rounded-full text-gray-400 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* RESULTADOS DA BUSCA */}
        {busca.trim() !== "" && (
          <div className="space-y-2 mt-3 pt-3 border-t border-gray-100 max-h-64 overflow-y-auto">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider font-sans">
              Resultados ({resultados.length})
            </p>
            {resultados.length > 0 ? (
              resultados.map((res) => {
                const isCopiadoRes = copiadoIdx === res.originalIndex;
                
                const compartilharRes = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const textoCompartilhar = `"${res.texto}" - ${res.ref}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({
                        title: "Versículo Compartilhado",
                        text: textoCompartilhar,
                      });
                    } catch (err) {
                      if (err instanceof Error && err.name !== "AbortError") {
                        copiarParaClipboardRes(textoCompartilhar, res.originalIndex);
                      }
                    }
                  } else {
                    copiarParaClipboardRes(textoCompartilhar, res.originalIndex);
                  }
                };

                const copiarParaClipboardRes = (texto: string, idx: number) => {
                  navigator.clipboard.writeText(texto).then(() => {
                    setCopiadoIdx(idx);
                    setTimeout(() => setCopiadoIdx(null), 2000);
                  }).catch((err) => {
                    console.error("Falha ao copiar texto: ", err);
                  });
                };

                return (
                  <div
                    key={res.originalIndex}
                    onClick={() => setIndice(res.originalIndex)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      indice === res.originalIndex
                        ? "bg-red-50/50 border-red-200 ring-1 ring-red-200"
                        : "bg-gray-50 border-gray-100 hover:bg-gray-100/70"
                    }`}
                  >
                    <p className="text-xs font-semibold text-gray-800 leading-relaxed font-sans">
                      "{res.texto}"
                    </p>
                    <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-gray-200/50">
                      <span className="text-[10px] font-bold text-gray-400 font-mono">
                        {res.ref}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={compartilharRes}
                          className="flex items-center gap-1 bg-white hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold text-[10px] px-2 py-1 rounded-lg transition-all"
                        >
                          <Share2 size={10} className="text-gray-500" />
                          <span>{isCopiadoRes ? "Copiado!" : "Compartilhar"}</span>
                        </button>
                        <span className="text-[9px] text-red-600 font-bold uppercase font-sans tracking-wide">
                          {indice === res.originalIndex ? "Ativo" : "Ver"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-gray-400 italic font-sans text-center py-4">
                Nenhum versículo encontrado para "{busca}".
              </p>
            )}
          </div>
        )}
      </div>

      <a
        href={LINK_BIBLIA_COMPLETA}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
      >
        <span className="w-11 h-11 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
          <BookOpen size={20} />
        </span>
        <div className="flex-1">
          <p className="font-bold text-gray-900 text-sm font-sans">Abrir Bíblia completa</p>
          <p className="text-xs text-gray-500 font-sans">Leitura online</p>
        </div>
        <ExternalLink size={16} className="text-gray-400" />
      </a>

      <button
        onClick={() => ir("curiosidades")}
        className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
      >
        <span className="w-11 h-11 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
          <Lightbulb size={20} />
        </span>
        <div className="flex-1 text-left">
          <p className="font-bold text-gray-900 text-sm font-sans">Curiosidades bíblicas</p>
          <p className="text-xs text-gray-500 font-sans">Personagens, objetos e símbolos</p>
        </div>
        <ChevronRight size={16} className="text-gray-400" />
      </button>
    </div>
  );
}

/* ======================================================================
   TELA CURIOSIDADES BÍBLICAS
   ====================================================================== */

function TelaCuriosidades() {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<number | null>(null);

  // Normalizar strings para comparação (tirando acentos e deixando minúsculo)
  const normalizar = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

  const resultados = PERSONAGENS_BIBLIA.filter((p) =>
    normalizar(p.nome).includes(normalizar(busca))
  );

  const sugestoesRapidas = ["Moisés", "Davi", "Arca da Aliança", "Menorá", "Estrela de Belém"];

  return (
    <div className="px-4 py-5 space-y-4">
      <Selo>Curiosidades Bíblicas</Selo>
      <p className="text-sm text-gray-600 font-sans leading-relaxed">
        Digite o nome de um personagem, objeto sagrado ou elemento bíblico para ver fatos e descobertas históricas, arqueológicas ou teológicas.
      </p>

      {/* CAMPO DE BUSCA */}
      <div className="relative">
        <input
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setAberto(null); // fecha sanfonas quando digita nova busca
          }}
          placeholder="Busque por Moisés, Arca da Aliança, Menorá, Véu..."
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans pr-10 shadow-sm bg-white text-gray-800"
        />
        {busca ? (
          <button
            onClick={() => {
              setBusca("");
              setAberto(null);
            }}
            className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
            aria-label="Limpar busca"
          >
            <X size={18} />
          </button>
        ) : (
          <span className="absolute right-3 top-3.5 text-gray-400">
            <Lightbulb size={18} />
          </span>
        )}
      </div>

      {/* SUGESTÕES RÁPIDAS */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        <span className="text-xs font-bold text-gray-400 self-center mr-1">Sugestões:</span>
        {sugestoesRapidas.map((sug) => (
          <button
            key={sug}
            onClick={() => {
              setBusca(sug);
              setAberto(null);
            }}
            className={`text-xs px-2.5 py-1 rounded-full font-sans border font-medium transition-all ${
              normalizar(busca) === normalizar(sug)
                ? "bg-red-700 text-white border-red-700"
                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:scale-102"
            }`}
          >
            {sug}
          </button>
        ))}
      </div>

      {/* LISTAGEM DOS PERSONAGENS ENCONTRADOS */}
      <div className="space-y-3 pt-2">
        {resultados.length === 0 ? (
          <div className="text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl py-10 px-4">
            <Lightbulb size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="text-sm text-gray-500 font-sans">
              Nenhum item ou personagem com esse nome foi encontrado. Tente buscar por outro termo ou limpe o campo.
            </p>
          </div>
        ) : (
          resultados.map((p, idx) => {
            // Se houver apenas 1 resultado na busca ou busca for igual ao nome exato, abre automaticamente!
            const expandido = resultados.length === 1 || normalizar(busca) === normalizar(p.nome) || aberto === idx;
            return (
              <div
                key={p.nome}
                className={`bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-200 ${
                  resultados.length === 1 || normalizar(busca) === normalizar(p.nome)
                    ? "border-red-200 ring-2 ring-red-50"
                    : "border-gray-200"
                }`}
              >
                <button
                  onClick={() => {
                    if (resultados.length !== 1 && normalizar(busca) !== normalizar(p.nome)) {
                      setAberto(expandido ? null : idx);
                    }
                  }}
                  className="w-full flex items-center gap-3 p-4 text-left"
                >
                  <span className="w-10 h-10 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0 font-extrabold text-sm font-sans">
                    {p.nome[0]}
                  </span>
                  <div className="flex-1">
                    <p className="font-extrabold text-gray-900 text-sm font-sans">{p.nome}</p>
                    <p className="text-xs text-gray-500 font-sans">{p.epoca}</p>
                  </div>
                  {resultados.length !== 1 && normalizar(busca) !== normalizar(p.nome) && (
                    <ChevronRight
                      size={18}
                      className={`text-gray-400 transition-transform ${
                        expandido ? "rotate-90" : ""
                      }`}
                    />
                  )}
                </button>

                {expandido && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                    <p className="text-sm text-gray-700 font-sans leading-relaxed">{p.resumo}</p>
                    {p.curiosidades.map((c, j) => (
                      <div
                        key={j}
                        className="bg-red-50 border border-red-100 rounded-xl p-3 flex gap-2.5 shadow-sm"
                      >
                        <Lightbulb size={18} className="text-red-700 shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-gray-800 font-sans leading-relaxed">{c.texto}</p>
                          <p className="text-[10px] text-gray-500 mt-1.5 uppercase font-mono tracking-wider">
                            Fonte: {c.fonte}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ======================================================================
   TELA CADASTRO DE MEMBROS
   ====================================================================== */

interface FormularioMembroProps {
  inicial: Membro | null;
  onSalvar: (form: Omit<Membro, "id"> & { id?: number }) => void;
  onCancelar: () => void;
}

function FormularioMembro({ inicial, onSalvar, onCancelar }: FormularioMembroProps) {
  const [form, setForm] = useState(
    inicial || {
      nome: "",
      telefone: "",
      nascimento: "",
      dataBatismo: "",
      nomeLider: "",
    }
  );
  const campo = (chave: string, valor: string) => setForm((f) => ({ ...f, [chave]: valor }));
  const podeSalvar = form.nome.trim();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end justify-center z-50">
      <div className="bg-white w-full max-w-sm rounded-t-3xl p-5 max-h-screen overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-extrabold text-lg text-gray-900 font-sans">
            {inicial ? "Editar cadastro" : "Novo cadastro"}
          </h3>
          <button onClick={onCancelar} aria-label="Fechar">
            <X size={22} className="text-gray-500" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Nome</label>
            <input
              value={form.nome}
              onChange={(e) => campo("nome", e.target.value)}
              placeholder="Nome completo"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Telefone</label>
            <input
              value={form.telefone}
              onChange={(e) => campo("telefone", e.target.value)}
              placeholder="(73) 9 9999-9999"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Data de nascimento</label>
            <input
              type="date"
              value={form.nascimento}
              onChange={(e) => campo("nascimento", e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Data de batismo</label>
            <input
              type="date"
              value={form.dataBatismo}
              onChange={(e) => campo("dataBatismo", e.target.value)}
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans bg-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 font-sans">Nome do líder</label>
            <input
              value={form.nomeLider}
              onChange={(e) => campo("nomeLider", e.target.value)}
              placeholder="Líder do grupo pastoreio"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
        </div>

        <button
          disabled={!podeSalvar}
          onClick={() => onSalvar(form)}
          className="w-full mt-5 bg-red-700 disabled:bg-gray-300 text-white font-extrabold py-3 rounded-xl font-sans"
        >
          Salvar cadastro
        </button>
      </div>
    </div>
  );
}

interface TelaCadastrosMembrosProps {
  membros: Membro[];
  setMembros: React.Dispatch<React.SetStateAction<Membro[]>>;
}

function TelaCadastrosMembros({ membros, setMembros }: TelaCadastrosMembrosProps) {
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState<Membro | null>(null);

  const salvar = (form: Omit<Membro, "id">) => {
    if (editando) {
      setMembros((m) =>
        m.map((item) => (item.id === editando.id ? { ...item, ...form } : item))
      );
    } else {
      setMembros((m) => [{ ...form, id: Date.now(), criadoEm: Date.now() }, ...m]);
    }
    setMostrarForm(false);
    setEditando(null);
  };

  const remover = (id: number) => setMembros((m) => m.filter((item) => item.id !== id));

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <Selo>Cadastros de membros</Selo>
        <button
          onClick={() => {
            setEditando(null);
            setMostrarForm(true);
          }}
          className="flex items-center gap-1 bg-red-700 text-white text-xs font-bold px-3 py-2 rounded-full -mt-3 font-sans"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>
      <p className="text-sm text-gray-600 -mt-2 font-sans">
        Esses cadastros normalmente chegam pelas próprias pessoas, na versão
        de visualização do app. Aqui você só acompanha e pode corrigir algo
        se precisar.
      </p>

      {membros.length === 0 ? (
        <div className="text-center bg-gray-50 border border-dashed border-gray-300 rounded-2xl py-10 px-4">
          <UserPlus size={28} className="mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500 font-sans">Nenhum cadastro recebido ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {membros.map((m) => (
            <div
              key={m.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <p className="font-extrabold text-gray-900 font-sans">{m.nome}</p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setEditando(m);
                      setMostrarForm(true);
                    }}
                    aria-label="Editar cadastro"
                    className="text-gray-400"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => remover(m.id)}
                    aria-label="Remover cadastro"
                    className="text-gray-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1 text-sm text-gray-700 font-sans">
                {m.telefone && (
                  <a
                    href={`tel:${m.telefone.replace(/\D/g, "")}`}
                    className="flex items-center gap-2 text-red-700 font-bold"
                  >
                    <Phone size={14} /> {m.telefone}
                  </a>
                )}
                {m.nascimento && <p>Nascimento: {m.nascimento}</p>}
                {m.dataBatismo && <p>Batismo: {m.dataBatismo}</p>}
                {m.nomeLider && <p>Líder: {m.nomeLider}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <FormularioMembro
          inicial={editando}
          onSalvar={salvar}
          onCancelar={() => {
            setMostrarForm(false);
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

/* ======================================================================
   TELA MAIS / MENU PRINCIPAL
   ====================================================================== */

interface TelaMaisProps {
  ir: (tela: string) => void;
  novosMembros?: number;
}

function TelaMais({ ir, novosMembros = 0 }: TelaMaisProps) {
  const itens = [
    { id: "aovivo", label: "Ao Vivo", icon: Radio },
    { id: "escala", label: "Escala Ministerial", icon: ClipboardList },
    { id: "ministerios", label: "Redes da Igreja", icon: HeartHandshake },
    { id: "membros", label: "Cadastros de Membros", icon: UserPlus, badge: novosMembros },
    { id: "devocional", label: "Devocional", icon: Heart },
    { id: "eventos", label: "Eventos", icon: PartyPopper },
    { id: "redes", label: "Redes sociais", icon: Instagram },
    { id: "curiosidades", label: "Curiosidades Bíblicas", icon: Lightbulb },
    { id: "sobre", label: "Sobre a igreja", icon: Church },
  ];
  return (
    <div className="px-4 py-5 space-y-3">
      {itens.map((item) => (
        <button
          key={item.id}
          onClick={() => ir(item.id)}
          className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm active:scale-98 transition-transform"
        >
          <span className="w-11 h-11 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
            <item.icon size={20} />
          </span>
          <span className="font-bold text-gray-900 text-sm font-sans">{item.label}</span>
          {!!item.badge && (
            <span className="bg-red-700 text-white text-xs font-extrabold rounded-full w-6 h-6 flex items-center justify-center ml-auto mr-1 font-sans">
              {item.badge}
            </span>
          )}
          <ChevronRight size={18} className={item.badge ? "text-gray-400" : "text-gray-400 ml-auto"} />
        </button>
      ))}
    </div>
  );
}

/* ======================================================================
   AO VIVO
   ====================================================================== */

interface CanalAoVivoProps {
  chave: string;
  titulo: string;
  icon: LucideIcon;
  links: Record<string, string>;
  atualizarLink: (chave: string, link: string) => void;
}

function CanalAoVivo({ chave, titulo, icon: Icon, links, atualizarLink }: CanalAoVivoProps) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const link = links[chave] || "";

  useEffect(() => {
    setRascunho(link);
  }, [link]);

  const salvarLink = () => {
    atualizarLink(chave, rascunho.trim());
    setEditando(false);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={18} className="text-red-700" />
          <p className="font-extrabold text-gray-900 text-sm font-sans">{titulo}</p>
        </div>
        <button
          onClick={() => setEditando(!editando)}
          className="flex items-center gap-1 text-xs font-bold text-gray-500 hover:text-red-700 font-sans transition-colors"
        >
          <Pencil size={14} />
          {editando ? "Cancelar" : "Editar Link"}
        </button>
      </div>

      {editando ? (
        <div className="space-y-2 pt-1">
          <input
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder={`Cole aqui o link de ${titulo} (ex: https://youtube.com/...)`}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
          />
          <button
            onClick={salvarLink}
            className="w-full bg-red-700 hover:bg-red-800 text-white font-extrabold py-2.5 rounded-xl text-xs font-sans transition-colors"
          >
            Salvar Link
          </button>
        </div>
      ) : link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-red-700 hover:bg-red-800 text-white rounded-xl py-2.5 text-center font-extrabold text-sm font-sans transition-colors"
        >
          Assistir/ouvir {titulo} agora
        </a>
      ) : (
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-dashed border-gray-200">
          <p className="text-xs text-gray-500 font-sans">
            Nenhum link cadastrado para {titulo} ainda.
          </p>
          <button
            onClick={() => setEditando(true)}
            className="mt-1.5 text-xs font-extrabold text-red-700 hover:underline font-sans"
          >
            Adicionar link
          </button>
        </div>
      )}
    </div>
  );
}

interface TelaAoVivoProps {
  linksAoVivo: Record<string, string>;
  atualizarLinkAoVivo: (chave: string, link: string) => void;
}

function TelaAoVivo({ linksAoVivo, atualizarLinkAoVivo }: TelaAoVivoProps) {
  return (
    <div className="px-4 py-5 space-y-4">
      <Selo>Transmissão ao vivo</Selo>
      <p className="text-sm text-gray-600 -mt-2 font-sans">
        Três jeitos de acompanhar — cada um com seu próprio link.
      </p>

      <CanalAoVivo
        chave="youtube"
        titulo="YouTube"
        icon={Youtube}
        links={linksAoVivo}
        atualizarLink={atualizarLinkAoVivo}
      />
      <CanalAoVivo
        chave="radio"
        titulo="Rádio Web"
        icon={Radio}
        links={linksAoVivo}
        atualizarLink={atualizarLinkAoVivo}
      />
      <CanalAoVivo
        chave="tvweb"
        titulo="TV Web"
        icon={Tv}
        links={linksAoVivo}
        atualizarLink={atualizarLinkAoVivo}
      />

      <div className="grid grid-cols-2 gap-3">
        <a
          href={REDES_SOCIAIS.youtube}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-3 font-bold text-sm text-gray-800 font-sans shadow-sm"
        >
          <Youtube size={18} className="text-red-700" /> Canal YouTube
        </a>
        <a
          href={REDES_SOCIAIS.instagram}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-2xl py-3 font-bold text-sm text-gray-800 font-sans shadow-sm"
        >
          <Instagram size={18} className="text-red-700" /> Instagram
        </a>
      </div>
    </div>
  );
}

/* ======================================================================
   TELA DEVOCIONAL
   ====================================================================== */

function TelaDevocional() {
  return (
    <div className="px-4 py-5 space-y-4">
      <Selo>Devocional de hoje</Selo>
      <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
        <p className="text-sm text-gray-700 leading-relaxed font-sans">
          Reserve um momento agora para agradecer a Deus por mais um dia.
          Leia o versículo do dia na aba Bíblia e ore pedindo direção para
          as decisões de hoje.
        </p>
        <p className="text-xs text-gray-400 mt-4 font-sans">
          Espaço reservado para o devocional diário — atualize este texto
          com a reflexão de cada dia.
        </p>
      </div>
    </div>
  );
}

/* ======================================================================
   TELA EVENTOS
   ====================================================================== */

function TelaEventos() {
  return (
    <div className="px-4 py-5 space-y-3">
      <Selo>Próximos eventos</Selo>
      {EVENTOS_EXEMPLO.map((ev, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
          <p className="font-extrabold text-gray-900 font-sans">{ev.titulo}</p>
          <p className="text-xs text-red-700 font-bold mt-0.5 font-sans">{ev.data}</p>
          <p className="text-sm text-gray-600 mt-1 font-sans">{ev.descricao}</p>
        </div>
      ))}
      <p className="text-xs text-gray-400 text-center pt-2 font-sans">
        Exemplos — substitua pelos próximos eventos reais da igreja.
      </p>
    </div>
  );
}

/* ======================================================================
   TELA REDES DOS MINISTÉRIOS
   ====================================================================== */

interface TelaRedesMinisteriosProps {
  redes: Record<string, RedeSocial>;
  atualizarRede: (id: string, dados: Partial<RedeSocial>) => void;
}

function TelaRedesMinisterios({ redes, atualizarRede }: TelaRedesMinisteriosProps) {
  return (
    <div className="px-4 py-5 space-y-5">
      <Selo>Redes da igreja</Selo>
      <p className="text-sm text-gray-600 -mt-2 font-sans">
        Adicione uma foto e uma breve descrição de cada rede.
      </p>
      <div className="space-y-5">
        {REDES_MINISTERIOS.map((rede) => {
          const dados = redes[rede.id] || { foto: null, descricao: "" };
          return (
            <div
              key={rede.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm space-y-3"
            >
              <p className="font-extrabold text-gray-900 font-sans">{rede.nome}</p>
              <FotoUpload
                foto={dados.foto}
                onTrocar={(b64) => atualizarRede(rede.id, { foto: b64 })}
                rotulo={`Foto da ${rede.nome}`}
              />
              <textarea
                value={dados.descricao}
                onChange={(e) =>
                  atualizarRede(rede.id, { descricao: e.target.value })
                }
                placeholder={`Conte sobre a ${rede.nome}: líder, dia, local...`}
                rows={3}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 resize-none font-sans"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ======================================================================
   TELA ESCALAS
   ====================================================================== */

interface TelaEscalaProps {
  escalas: Record<string, Record<string, string>>;
  atualizarEscala: (ministerioId: string, novaLista: Record<string, string>) => void;
}

function TelaEscala({ escalas, atualizarEscala }: TelaEscalaProps) {
  const [selecionado, setSelecionado] = useState(MINISTERIOS_ESCALA[0].id);
  const ministerio = MINISTERIOS_ESCALA.find((m) => m.id === selecionado)!;
  const valoresSalvos = escalas[selecionado] || {};
  const [valores, setValores] = useState<Record<string, string>>(valoresSalvos);

  useEffect(() => {
    setValores(escalas[selecionado] || {});
  }, [selecionado, escalas]);

  const mudarCampo = (funcao: string, nome: string) =>
    setValores((v) => ({ ...v, [funcao]: nome }));

  const salvarCampo = () => {
    atualizarEscala(selecionado, { ...valores });
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <Selo>Escala ministerial</Selo>

      <div className="grid grid-cols-3 gap-2">
        {MINISTERIOS_ESCALA.map((m) => {
          const ativo = m.id === selecionado;
          return (
            <button
              key={m.id}
              onClick={() => setSelecionado(m.id)}
              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border text-xs font-bold font-sans ${
                ativo
                  ? "bg-red-700 text-white border-red-700"
                  : "bg-white text-gray-600 border-gray-200"
              }`}
            >
              <m.icon size={18} />
              {m.nome.replace("Ministério de ", "")}
            </button>
          );
        })}
      </div>

      <p className="text-sm font-extrabold text-gray-900 font-sans">{ministerio.nome}</p>
      <p className="text-xs text-gray-500 -mt-2 font-sans">
        Escreva o nome de quem vai servir em cada função esta semana. Salva
        sozinho quando você sai do campo.
      </p>

      {(selecionado === "louvor" || selecionado === "danca") && (
        <div className="bg-gradient-to-br from-red-50 to-white border border-red-200 rounded-2xl p-4 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
              {selecionado === "louvor" ? <Music size={16} /> : <Sparkles size={16} />}
            </span>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide font-sans">
                {selecionado === "louvor" ? "Repertório Musical" : "Ensaios & Coreografias"}
              </p>
              <h4 className="font-extrabold text-gray-900 text-sm font-sans">
                {selecionado === "louvor" ? "Links das Músicas / Cifras (6 Espaços)" : "Links dos Vídeos / Coreografias (6 Espaços)"}
              </h4>
            </div>
          </div>

          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((num) => {
              const chaveLink = `link_repertorio_${num}`;
              const linkAtual = valores[chaveLink] || "";
              const ehYoutube = linkAtual.toLowerCase().includes("youtube.com") || linkAtual.toLowerCase().includes("youtu.be");

              return (
                <div key={num} className="bg-white border border-gray-200 rounded-xl p-3 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full font-sans uppercase">
                      {selecionado === "louvor" ? `Música ${num}` : `Coreografia ${num}`}
                    </span>
                    {linkAtual ? (
                      <a
                        href={linkAtual.startsWith("http") ? linkAtual : `https://${linkAtual}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-bold text-red-700 hover:text-red-800 transition-colors bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded-lg"
                      >
                        {ehYoutube ? <Youtube size={12} className="text-red-600" /> : <ExternalLink size={12} />}
                        <span>Assistir / Ouvir</span>
                      </a>
                    ) : (
                      <span className="text-[10px] text-gray-400 italic font-sans">Sem link</span>
                    )}
                  </div>
                  <input
                    value={linkAtual}
                    onChange={(e) => mudarCampo(chaveLink, e.target.value)}
                    onBlur={salvarCampo}
                    placeholder={
                      selecionado === "louvor"
                        ? `Cole o link da Música ${num} (YouTube, Spotify, Cifra)`
                        : `Cole o link da Coreografia ${num} (YouTube, Drive, etc)`
                    }
                    className="w-full border border-gray-200 rounded-lg px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
        {ministerio.funcoes.map((funcao) => (
          <div key={funcao} className="p-3">
            <label className="text-xs font-bold text-gray-500 font-sans">{funcao}</label>
            <input
              value={valores[funcao] || ""}
              onChange={(e) => mudarCampo(funcao, e.target.value)}
              onBlur={salvarCampo}
              placeholder="Nome da pessoa"
              className="w-full mt-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-700 font-sans"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ======================================================================
   TELA REDES SOCIAIS / GERAL
   ====================================================================== */

function TelaRedes() {
  const itens = [
    { nome: "Facebook", icon: Facebook, link: REDES_SOCIAIS.facebook },
    { nome: "Instagram", icon: Instagram, link: REDES_SOCIAIS.instagram },
    { nome: "YouTube", icon: Youtube, link: REDES_SOCIAIS.youtube },
  ];
  return (
    <div className="px-4 py-5 space-y-3">
      <Selo>Redes sociais</Selo>
      {itens.map((item) => (
        <a
          key={item.nome}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm"
        >
          <span className="w-11 h-11 rounded-full bg-red-700 text-white flex items-center justify-center shrink-0">
            <item.icon size={20} />
          </span>
          <span className="font-bold text-gray-900 text-sm flex-1 font-sans">{item.nome}</span>
          <ExternalLink size={16} className="text-gray-400" />
        </a>
      ))}
    </div>
  );
}

/* ======================================================================
   TELA SOBRE A IGREJA
   ====================================================================== */

function TelaSobre() {
  return (
    <div className="px-4 py-5 space-y-5">
      <Selo>Sobre a Igreja Betel</Selo>
      <p className="text-sm text-gray-700 leading-relaxed font-sans">{SOBRE_TEXTO}</p>
      <div>
        <Selo>Liderança</Selo>
        <div className="space-y-2">
          {LIDERANCA.map((l, i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3">
              <span className="w-9 h-9 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold font-sans">
                {l.nome.split(" ").map((n) => n[0]).join("").slice(0, 2)}
              </span>
              <div>
                <p className="text-sm font-bold text-gray-900 font-sans">{l.nome}</p>
                <p className="text-xs text-gray-500 font-sans">{l.papel}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   COMPONENTE PRINCIPAL (CONTAINER)
   ====================================================================== */

export default function App() {
  const [tela, setTela] = useState("inicio");
  const [dados, setDados] = useState<DadosApp>(dadosPadrao());
  const dadosRef = useRef<DadosApp>(dadosPadrao());
  const ultimoEstadoSincronizadoRef = useRef<DadosApp>(dadosPadrao());
  const [carregado, setCarregado] = useState(false);
  const [statusSalvar, setStatusSalvar] = useState<string | null>(null);
  const [ultimaVisualizacaoMembros, setUltimaVisualizacaoMembros] = useState(0);
  const [mostrarFormAutocadastro, setMostrarFormAutocadastro] = useState(false);
  const [sucessoCadastro, setSucessoCadastro] = useState(false);

  // Ficha de membro local
  const [meuCadastroId, setMeuCadastroId] = useState<number | null>(null);
  const [editandoMeuCadastro, setEditandoMeuCadastro] = useState<Membro | null>(null);
  const [confirmarRemoverLocal, setConfirmarRemoverLocal] = useState(false);

  // Carrega os dados salvos e sincroniza em tempo real
  useEffect(() => {
    const sanitizarFoto = (foto: string | null) => {
      if (!foto) return FOTO_IGREJA_DEFAULT;
      if (foto === "sem_foto") return "sem_foto";
      if (!foto.startsWith("data:")) {
        return FOTO_IGREJA_DEFAULT;
      }
      return foto;
    };

    let desinscrever: (() => void) | null = null;

    (async () => {
      let carregadoMeuId: number | null = null;
      try {
        const meuId = await window.storage.get("betel:meu_cadastro_id", false);
        if (meuId && meuId.value) {
          carregadoMeuId = Number(meuId.value);
          setMeuCadastroId(carregadoMeuId);
        }
      } catch (err) {}

      try {
        const visto = await window.storage.get(STORAGE_KEY_VISTO_MEMBROS, false);
        if (visto && visto.value) setUltimaVisualizacaoMembros(Number(visto.value) || 0);
      } catch (err) {}

      // 1. Primeiro, carrega os dados locais do backup/cache local com segurança
      try {
        const resultado = await window.storage.get(STORAGE_KEY, true);
        if (resultado && resultado.value) {
          const parsed = JSON.parse(resultado.value);
          const carregados: DadosApp = {
            ...dadosPadrao(),
            ...parsed,
            fotoIgreja: sanitizarFoto(parsed.fotoIgreja),
            grupos: Array.isArray(parsed.grupos) ? parsed.grupos : [],
            visitantes: Array.isArray(parsed.visitantes) ? parsed.visitantes : [],
            licoes: Array.isArray(parsed.licoes) ? parsed.licoes : [],
            membros: Array.isArray(parsed.membros) ? parsed.membros : [],
          };
          dadosRef.current = carregados;
          setDados(carregados);
        }
      } catch (err) {
        console.error("Erro ao carregar dados locais iniciais:", err);
      }

      // 2. Só depois de carregar o local, inicia o listener em tempo real para sincronização com Firestore
      desinscrever = onSnapshot(
        doc(db, "dados_app", STORAGE_KEY),
        async (docSnap) => {
          try {
            if (docSnap.exists()) {
              const data = docSnap.data();
              if (data && data.value) {
                const parsed = JSON.parse(data.value);
                const remoto: DadosApp = {
                  ...dadosPadrao(),
                  ...parsed,
                  fotoIgreja: sanitizarFoto(parsed.fotoIgreja),
                  grupos: Array.isArray(parsed.grupos) ? parsed.grupos : [],
                  visitantes: Array.isArray(parsed.visitantes) ? parsed.visitantes : [],
                  licoes: Array.isArray(parsed.licoes) ? parsed.licoes : [],
                  membros: Array.isArray(parsed.membros) ? parsed.membros : [],
                };

                const dadosAtuais = dadosRef.current;
                const novosMesclados = mesclarTresCaminhos(dadosAtuais, remoto, ultimoEstadoSincronizadoRef.current, carregadoMeuId);
                
                const houveMudancaLocalMesclada = JSON.stringify(remoto) !== JSON.stringify(novosMesclados);
                
                dadosRef.current = novosMesclados;
                ultimoEstadoSincronizadoRef.current = remoto;
                setDados(novosMesclados);

                if (houveMudancaLocalMesclada) {
                  try {
                    await window.storage.set(STORAGE_KEY, JSON.stringify(novosMesclados), true);
                    ultimoEstadoSincronizadoRef.current = novosMesclados;
                  } catch (e) {
                    console.error("Erro ao subir mesclagem inicial para o Firestore:", e);
                  }
                }
              }
            } else {
              // Se o documento no Firestore não existir, envia o estado local atual para inicializar a nuvem
              const dadosAtuais = dadosRef.current;
              if (dadosAtuais.membros.length > 0 || dadosAtuais.grupos.length > 0 || dadosAtuais.licoes.length > 0) {
                try {
                  await window.storage.set(STORAGE_KEY, JSON.stringify(dadosAtuais), true);
                  ultimoEstadoSincronizadoRef.current = dadosAtuais;
                } catch (e) {
                  console.error("Erro ao inicializar documento vazio no Firestore:", e);
                }
              }
            }
          } catch (e) {
            console.error("Erro ao sincronizar dados em tempo real:", e);
          } finally {
            setCarregado(true);
          }
        },
        (error) => {
          console.error("Erro na conexão em tempo real com Firestore:", error);
          setCarregado(true);
        }
      );
    })();

    return () => {
      if (desinscrever) desinscrever();
    };
  }, []);

  const persistir = async (novosDados: DadosApp) => {
    setStatusSalvar("salvando");
    try {
      // 1. Busca os dados remotos mais recentes para fazer um merge e evitar sobrescrever cadastros de terceiros
      let dadosFinais = novosDados;
      const resultado = await window.storage.get(STORAGE_KEY, true);
      let remoto: DadosApp | null = null;
      if (resultado && resultado.value) {
        const parsed = JSON.parse(resultado.value);
        remoto = {
          ...dadosPadrao(),
          ...parsed,
          grupos: Array.isArray(parsed.grupos) ? parsed.grupos : [],
          visitantes: Array.isArray(parsed.visitantes) ? parsed.visitantes : [],
          licoes: Array.isArray(parsed.licoes) ? parsed.licoes : [],
          membros: Array.isArray(parsed.membros) ? parsed.membros : [],
        };
        dadosFinais = mesclarTresCaminhos(novosDados, remoto, ultimoEstadoSincronizadoRef.current, meuCadastroId);
      }

      // 2. Atualiza o estado local e de referência
      dadosRef.current = dadosFinais;
      setDados(dadosFinais);
      if (remoto) {
        ultimoEstadoSincronizadoRef.current = remoto;
      } else {
        ultimoEstadoSincronizadoRef.current = dadosFinais;
      }

      // 3. Grava de forma segura na nuvem compartilhada
      await window.storage.set(STORAGE_KEY, JSON.stringify(dadosFinais), true);
      
      // Atualiza a base para o estado final gravado com sucesso
      ultimoEstadoSincronizadoRef.current = dadosFinais;
      setStatusSalvar("ok");
    } catch (err) {
      console.error("Não foi possível salvar os dados do app", err);
      const mensagem = String(err && (err as Error).message ? (err as Error).message : err).toLowerCase();
      const pareceTamanho =
        mensagem.includes("size") ||
        mensagem.includes("large") ||
        mensagem.includes("limit") ||
        mensagem.includes("5mb") ||
        mensagem.includes("quota");
      setStatusSalvar(pareceTamanho ? "erro_tamanho" : "erro");

      // Em caso de falha, garante que o usuário ainda veja o estado local sem interrupções
      dadosRef.current = novosDados;
      setDados(novosDados);
    }
  };

  const setFotoIgreja = (foto: string) => persistir({ ...dadosRef.current, fotoIgreja: foto });
  
  const atualizarLinkAoVivo = (chave: string, link: string) =>
    persistir({
      ...dadosRef.current,
      linksAoVivo: { ...dadosRef.current.linksAoVivo, [chave]: link },
    });

  const setGrupos: React.Dispatch<React.SetStateAction<GrupoPastoreio[]>> = (atualizar) => {
    const novosGrupos = typeof atualizar === "function" ? atualizar(dadosRef.current.grupos || []) : atualizar;
    persistir({ ...dadosRef.current, grupos: novosGrupos });
  };

  const atualizarRede = (id: string, novosDados: Partial<RedeSocial>) =>
    persistir({
      ...dadosRef.current,
      redes: {
        ...dadosRef.current.redes,
        [id]: {
          ...(dadosRef.current.redes[id] || { foto: null, descricao: "" }),
          ...novosDados,
        },
      },
    });

  const atualizarEscala = (ministerioId: string, novaLista: Record<string, string>) =>
    persistir({
      ...dadosRef.current,
      escalas: { ...dadosRef.current.escalas, [ministerioId]: novaLista },
    });

  const setVisitantes: React.Dispatch<React.SetStateAction<Visitante[]>> = (atualizar) => {
    const novosVisitantes = typeof atualizar === "function" ? atualizar(dadosRef.current.visitantes || []) : atualizar;
    persistir({ ...dadosRef.current, visitantes: novosVisitantes });
  };

  const setLicoes: React.Dispatch<React.SetStateAction<Licao[]>> = (atualizar) => {
    const novasLicoes = typeof atualizar === "function" ? atualizar(dadosRef.current.licoes || []) : atualizar;
    persistir({ ...dadosRef.current, licoes: novasLicoes });
  };

  const atualizarMinistrante = (dia: string, novosDados: Ministrante) =>
    persistir({
      ...dadosRef.current,
      ministrantes: { ...dadosRef.current.ministrantes, [dia]: novosDados },
    });

  const setMembros: React.Dispatch<React.SetStateAction<Membro[]>> = (atualizar) => {
    const novosMembros = typeof atualizar === "function" ? atualizar(dadosRef.current.membros || []) : atualizar;
    persistir({ ...dadosRef.current, membros: novosMembros });
  };

  const novosMembros = (dados.membros || []).filter(
    (m) => (m.criadoEm || 0) > ultimaVisualizacaoMembros
  ).length;

  const marcarMembrosComoVistos = () => {
    const agora = Date.now();
    setUltimaVisualizacaoMembros(agora);
    window.storage.set(STORAGE_KEY_VISTO_MEMBROS, String(agora), false).catch(() => {});
  };

  useEffect(() => {
    if (tela === "membros") marcarMembrosComoVistos();
  }, [tela]);

  const pai = telaPai(tela);
  const abaAtiva = pai || tela;

  const titulos: Record<string, string> = {
    inicio: "Igreja Betel",
    cultos: "Cultos",
    grupos: "Grupos Pastoreio",
    biblia: "Bíblia",
    mais: "Mais",
    aovivo: "Ao Vivo",
    escala: "Escala Ministerial",
    ministerios: "Redes da Igreja",
    devocional: "Devocional",
    eventos: "Eventos",
    redes: "Redes Sociais",
    curiosidades: "Curiosidades Bíblicas",
    sobre: "Sobre a Igreja",
    visitantes: "Cadastro de Visitantes",
    licoes: "Lições",
    membros: "Cadastros de Membros",
  };

  // Encontrar se já existe ficha de membro registrada localmente
  const meuMembro = (dados.membros || []).find((m) => m.id === meuCadastroId) || null;

  const handleEditarMeuCadastro = (membro: Membro) => {
    setEditandoMeuCadastro(membro);
    setMostrarFormAutocadastro(true);
  };

  const renderTela = () => {
    switch (tela) {
      case "inicio":
        return (
          <TelaInicio
            ir={setTela}
            fotoIgreja={dados.fotoIgreja}
            onTrocarFotoIgreja={setFotoIgreja}
            onAbrirCadastroMembro={() => {
              setEditandoMeuCadastro(null);
              setMostrarFormAutocadastro(true);
            }}
            meuMembro={meuMembro}
            onEditarMeuCadastro={handleEditarMeuCadastro}
            onExcluirMeuCadastro={() => setConfirmarRemoverLocal(true)}
            totalMembros={dados.membros?.length || 0}
            linksAoVivo={dados.linksAoVivo}
          />
        );
      case "cultos":
        return (
          <TelaCultos
            ministrantes={dados.ministrantes}
            atualizarMinistrante={atualizarMinistrante}
          />
        );
      case "grupos":
        return (
          <TelaGrupos grupos={dados.grupos} setGrupos={setGrupos} ir={setTela} />
        );
      case "biblia":
        return <TelaBiblia ir={setTela} />;
      case "mais":
        return <TelaMais ir={setTela} novosMembros={novosMembros} />;
      case "aovivo":
        return <TelaAoVivo linksAoVivo={dados.linksAoVivo} atualizarLinkAoVivo={atualizarLinkAoVivo} />;
      case "escala":
        return <TelaEscala escalas={dados.escalas} atualizarEscala={atualizarEscala} />;
      case "ministerios":
        return (
          <TelaRedesMinisterios redes={dados.redes} atualizarRede={atualizarRede} />
        );
      case "devocional":
        return <TelaDevocional />;
      case "eventos":
        return <TelaEventos />;
      case "redes":
        return <TelaRedes />;
      case "curiosidades":
        return <TelaCuriosidades />;
      case "sobre":
        return <TelaSobre />;
      case "visitantes":
        return (
          <TelaVisitantes visitantes={dados.visitantes} setVisitantes={setVisitantes} />
        );
      case "licoes":
        return <TelaLicoes licoes={dados.licoes} setLicoes={setLicoes} />;
      case "membros":
        return <TelaCadastrosMembros membros={dados.membros} setMembros={setMembros} />;
      default:
        return (
          <TelaInicio
            ir={setTela}
            fotoIgreja={dados.fotoIgreja}
            onTrocarFotoIgreja={setFotoIgreja}
            onAbrirCadastroMembro={() => {
              setEditandoMeuCadastro(null);
              setMostrarFormAutocadastro(true);
            }}
            meuMembro={meuMembro}
            onEditarMeuCadastro={handleEditarMeuCadastro}
            onExcluirMeuCadastro={() => setConfirmarRemoverLocal(true)}
            totalMembros={dados.membros?.length || 0}
            linksAoVivo={dados.linksAoVivo}
          />
        );
    }
  };

  if (!carregado) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center p-3 font-sans">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl flex items-center justify-center h-[90vh]">
          <p className="text-sm text-gray-400 font-mono">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-3 font-sans">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[92vh]">
        <CabecalhoApp
          titulo={titulos[tela]}
          voltarPara={pai}
          onVoltar={() => setTela(pai!)}
        />

        {statusSalvar === "salvando" && (
          <div className="bg-yellow-50 text-yellow-800 text-[10px] uppercase tracking-wider font-extrabold text-center py-1 shrink-0 font-sans">
            Salvando alterações...
          </div>
        )}
        {statusSalvar === "ok" && (
          <div className="bg-green-50 text-green-700 text-[10px] uppercase tracking-wider font-extrabold text-center py-1 shrink-0 font-sans">
            Alterações salvas ✓
          </div>
        )}
        {statusSalvar === "erro" && (
          <div className="bg-red-50 text-red-700 text-[10px] uppercase tracking-wider font-extrabold text-center py-1 shrink-0 font-sans">
            Erro de rede ao salvar.
          </div>
        )}
        {statusSalvar === "erro_tamanho" && (
          <div className="bg-red-50 text-red-700 text-[10px] uppercase tracking-wider font-extrabold text-center py-1 px-3 shrink-0 font-sans">
            Erro: fotos muito grandes.
          </div>
        )}

        <div className="flex-1 overflow-y-auto bg-gray-50">{renderTela()}</div>

        {/* MODAL DE AUTOCADASTRO DE MEMBRO */}
        {mostrarFormAutocadastro && (
          <FormularioMembro
            inicial={editandoMeuCadastro}
            onSalvar={(form) => {
              if (editandoMeuCadastro) {
                setMembros((m) =>
                  m.map((item) => (item.id === editandoMeuCadastro.id ? { ...item, ...form } : item))
                );
                setEditandoMeuCadastro(null);
              } else {
                const novoId = Date.now();
                setMembros((m) => [{ ...form, id: novoId, criadoEm: novoId }, ...m]);
                setMeuCadastroId(novoId);
                window.storage.set("betel:meu_cadastro_id", String(novoId), false).catch(() => {});
                setSucessoCadastro(true);
              }
              setMostrarFormAutocadastro(false);
            }}
            onCancelar={() => {
              setMostrarFormAutocadastro(false);
              setEditandoMeuCadastro(null);
            }}
          />
        )}

        {/* FEEDBACK DE SUCESSO DO AUTOCADASTRO */}
        {sucessoCadastro && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-xl font-sans">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-gray-900 text-base font-sans">Cadastro Concluído!</h4>
                <p className="text-xs text-gray-600 font-sans leading-relaxed">
                  Seja muito bem-vindo(a) à família da Igreja Betel! Seu cadastro de membro foi enviado com sucesso.
                </p>
              </div>
              <button
                onClick={() => setSucessoCadastro(false)}
                className="w-full bg-red-700 text-white font-extrabold text-xs py-3 rounded-xl hover:bg-red-800 active:scale-95 transition-all font-sans"
              >
                Amém, Obrigado!
              </button>
            </div>
          </div>
        )}

        {/* CONFIRMAÇÃO DE REMOVER CADASTRO LOCAL */}
        {confirmarRemoverLocal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center space-y-4 shadow-xl">
              <div className="w-12 h-12 bg-red-100 text-red-700 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="font-extrabold text-gray-900 text-base font-sans">Remover Ficha?</h4>
                <p className="text-xs text-gray-600 font-sans leading-relaxed">
                  Isso apenas ocultará a ficha deste aparelho. Seus dados continuam salvos de forma segura com os administradores da Igreja Betel.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmarRemoverLocal(false)}
                  className="flex-1 bg-gray-100 text-gray-700 font-bold text-xs py-3 rounded-xl border border-gray-200"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setMeuCadastroId(null);
                    window.storage.set("betel:meu_cadastro_id", "", false).catch(() => {});
                    setConfirmarRemoverLocal(false);
                  }}
                  className="flex-1 bg-red-700 text-white font-bold text-xs py-3 rounded-xl hover:bg-red-800"
                >
                  Sim, Remover
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-5 bg-white border-t border-gray-200 shrink-0">
          {ABAS.map((aba) => {
            const ativa = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                onClick={() => setTela(aba.id)}
                className={`flex flex-col items-center gap-1 py-2.5 active:scale-95 transition-transform ${
                  ativa ? "text-red-700" : "text-gray-400"
                }`}
              >
                <aba.icon size={20} />
                <span className="text-[10px] font-bold font-sans">{aba.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
