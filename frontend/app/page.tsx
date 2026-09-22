"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";
import { createTransactionKit } from "@genlayer/transaction-kit";
import { GenLayerTransactionPanel, type SubmitInput, type TrackedStatus } from "@genlayer/transaction-kit-react";
import { ArrowDownRight, ArrowUpRight, Check, CircleHelp, Fingerprint, GitBranch, Link2, LockKeyhole, Plus, RefreshCw, Search, ShieldAlert, X } from "lucide-react";
import { validateAuthorChange } from "@/lib/address.js";

type Node = {
  id: string; kind: "SOURCE" | "INFERENCE"; status: "PINNED" | "SUPPORTED" | "BROKEN";
  statement: string; parents: string[]; depth: number; verdict?: string;
  source: null | { url: string; first_line: number; last_line: number; sha256: string; excerpt: string };
  author: string;
};
type Board = { id: string; title: string; owner: string; authors: string[]; node_ids: string[] };
type Mode = "board" | "source" | "derive" | "author" | null;

const ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const RPC = process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_GENLAYER_CHAIN_ID || "61997");
const CHAIN = { ...studioDevnet, id: CHAIN_ID, name: "GenLayer Studio Next", rpcUrls: { default: { http: [RPC] } } };
const SAMPLE_URL = "https://raw.githubusercontent.com/nearar22/intent-lock/f8cc2d08fd4a91b0450d60e065e5c507cdfd7c99/README.md";

function clean(value: unknown): any {
  if (value instanceof Map) return Object.fromEntries(Array.from(value.entries()).map(([key, item]) => [key, clean(item)]));
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clean(item)]));
  if (typeof value === "bigint") return Number(value);
  return value;
}

function short(value: string, left = 9, right = 6) {
  if (right === 0) return value.length > left + 1 ? `${value.slice(0, left)}…` : value;
  return value.length > left + right + 3 ? `${value.slice(0, left)}…${value.slice(-right)}` : value;
}

function suggestedId(prefix: string) { return `${prefix}-${Date.now().toString().slice(-7)}`; }

export default function Page() {
  const [boardId, setBoardId] = useState("threadmark-demo01");
  const [boardTitle, setBoardTitle] = useState("An agent claim, traced to its source");
  const [board, setBoard] = useState<Board | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [nodeId, setNodeId] = useState(suggestedId("source"));
  const [sourceUrl, setSourceUrl] = useState(SAMPLE_URL);
  const [firstLine, setFirstLine] = useState("5");
  const [lastLine, setLastLine] = useState("5");
  const [quote, setQuote] = useState("two agents, two request IDs, and two differently worded instructions");
  const [statement, setStatement] = useState("");
  const [parents, setParents] = useState<string[]>([]);
  const [author, setAuthor] = useState("");
  const [authorForTx, setAuthorForTx] = useState("");
  const [authorAllowed, setAuthorAllowed] = useState(true);
  const [activeTx, setActiveTx] = useState<Mode>(null);

  const client = useMemo(() => createClient({ chain: CHAIN }), []);
  const kit = useMemo(() => {
    if (!wallet || typeof window === "undefined" || !(window as any).ethereum) return null;
    return createTransactionKit({ chain: CHAIN, provider: (window as any).ethereum, account: wallet as `0x${string}` });
  }, [wallet]);

  const refresh = useCallback(async () => {
    if (!ADDRESS || !boardId.trim()) return;
    setLoading(true);
    try {
      const nextBoard = clean(await client.readContract({ address: ADDRESS as `0x${string}`, functionName: "get_board", args: [boardId.trim()] })) as Board;
      const nextNodes = clean(await client.readContract({ address: ADDRESS as `0x${string}`, functionName: "list_nodes", args: [boardId.trim()] })) as Node[];
      setBoard(nextBoard);
      setNodes(nextNodes);
      setMessage("");
    } catch {
      setBoard(null);
      setNodes([]);
      setMessage("This board has not been created yet, or the network is unavailable.");
    } finally { setLoading(false); }
  }, [boardId, client]);

  useEffect(() => { void refresh(); }, [refresh]);

  const connect = async () => {
    const provider = (window as any).ethereum;
    if (!provider) { setMessage("Install MetaMask to write to Studio Next. Reading the public board does not require a wallet."); return; }
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const chainHex = `0x${CHAIN_ID.toString(16)}`;
      const current = await provider.request({ method: "eth_chainId" });
      if (Number.parseInt(current, 16) !== CHAIN_ID) {
        try { await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainHex }] }); }
        catch (error: any) {
          if (error?.code !== 4902) throw error;
          await provider.request({ method: "wallet_addEthereumChain", params: [{ chainId: chainHex, chainName: "GenLayer Studio Next", rpcUrls: [RPC], nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 } }] });
        }
      }
      setWallet(accounts[0] || null);
      setMessage("");
    } catch (error: any) { setMessage(error?.message || "Wallet connection did not complete."); }
  };

  const tx = useMemo<SubmitInput | null>(() => {
    if (!ADDRESS || !activeTx) return null;
    const base = { kind: "write" as const, address: ADDRESS as `0x${string}` };
    if (activeTx === "board") return { ...base, method: "create_board", args: [boardId.trim(), boardTitle.trim()] };
    if (activeTx === "source") return { ...base, method: "pin_source", args: [boardId.trim(), nodeId.trim(), sourceUrl.trim(), Number(firstLine), Number(lastLine), quote.trim()] };
    if (activeTx === "derive") return { ...base, method: "derive", args: [boardId.trim(), nodeId.trim(), parents, statement.trim()] };
    return { ...base, method: "set_author", args: [boardId.trim(), authorForTx, authorAllowed] };
  }, [activeTx, boardId, boardTitle, nodeId, sourceUrl, firstLine, lastLine, quote, parents, statement, authorForTx, authorAllowed]);

  const done = (status: TrackedStatus) => {
    if (status.phase === "finalized") {
      if (status.successful === true) {
        setActiveTx(null);
        setMode(null);
        setParents([]);
        setSelectedId(nodeId);
        setMessage("");
        void refresh();
      } else {
        setActiveTx(null);
        setMessage(`Transaction failed: ${status.executionResultName || status.statusName || "the contract rejected this input"}.`);
      }
    }
  };

  const open = (nextMode: Mode) => {
    setMode(nextMode);
    setNodeId(suggestedId(nextMode === "source" ? "source" : "claim"));
    setParents([]);
    setStatement("");
    if (nextMode === "author") {
      setAuthor("");
      setAuthorAllowed(true);
    }
  };
  const submit = () => {
    if (!kit) { setMessage("Connect a Studio Next wallet before writing."); return; }
    if (mode === "derive" && (parents.length < 1 || parents.length > 3)) { setMessage("Select one to three supported parent cards."); return; }
    if (mode === "author") {
      if (!board || !wallet || wallet.toLowerCase() !== board.owner.toLowerCase()) {
        setMessage("Only the connected board owner can manage authors.");
        return;
      }
      try {
        setAuthorForTx(validateAuthorChange({ value: author, owner: board.owner, authors: board.authors, allowed: authorAllowed }));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Enter a valid author wallet.");
        return;
      }
    }
    setMessage("");
    setActiveTx(mode);
  };
  const toggleParent = (id: string) => setParents(current => current.includes(id) ? current.filter(value => value !== id) : current.length < 3 ? [...current, id] : current);
  const selected = nodes.find(node => node.id === selectedId) || null;
  const sources = nodes.filter(node => node.kind === "SOURCE");
  const inferences = nodes.filter(node => node.kind === "INFERENCE");
  const usable = nodes.filter(node => node.status === "PINNED" || node.status === "SUPPORTED");
  const ancestry = selected ? traceFrom(nodes, selected) : [];

  return <main className="app-shell">
    <aside className="side-rail">
      <div className="brand"><div className="brand-mark"><GitBranch size={22}/></div><div><strong>threadmark</strong><small>PROVENANCE LAB</small></div></div>
      <div className="rail-label">CURRENT BOARD</div>
      <label className="board-picker"><Search size={16}/><input aria-label="Board ID" value={boardId} onChange={event=>setBoardId(event.target.value)} onKeyDown={event=>{if(event.key==="Enter") void refresh();}}/></label>
      <button className="rail-refresh" onClick={()=>void refresh()} disabled={loading}><RefreshCw size={15}/> {loading ? "Reading chain" : "Read this board"}</button>
      <div className="rail-divider"/>
      <div className="rail-label">BUILD A THREAD</div>
      <button className="rail-action" onClick={()=>open("board")}><Plus size={17}/> New board</button>
      <button className="rail-action" onClick={()=>open("source")}><Link2 size={17}/> Pin source</button>
      <button className="rail-action" onClick={()=>open("derive")}><GitBranch size={17}/> Test a claim</button>
      {board && wallet?.toLowerCase() === board.owner.toLowerCase() && <button className="rail-action" onClick={()=>open("author")}><LockKeyhole size={17}/> Invite author</button>}
      <div className="rail-spacer"/>
      <div className="network-pill"><span/> STUDIO NEXT · {CHAIN_ID}</div>
      <button className="wallet-button" onClick={()=>void connect()}>{wallet ? short(wallet, 7, 5) : "Connect wallet"}<ArrowUpRight size={14}/></button>
    </aside>

    <section className="workspace">
      <header className="workspace-header"><div className="breadcrumb">LAB / {boardId.toUpperCase()} <span>·</span> LIVE CONTRACT STATE</div><div className="header-right"><span className="source-count">{sources.length} SOURCES</span><span className="source-count">{inferences.length} INFERENCES</span></div></header>
      <div className="story-intro"><div className="eyebrow">EVIDENCE SHOULD LEAVE A TRAIL</div><h1>Follow the thread<span>.</span></h1><p>A claim is only as strong as the path back to its source. Pin immutable file lines, test each new inference with GenLayer validators, and see exactly where the reasoning holds or breaks.</p><div className="intro-actions"><button onClick={()=>open("source")}>Pin a source <ArrowDownRight size={17}/></button><button onClick={()=>open("derive")}>Test an inference <GitBranch size={17}/></button></div></div>
      {message && <div className="notice"><CircleHelp size={16}/>{message}</div>}
      {!ADDRESS && <div className="notice warning"><ShieldAlert size={16}/> Contract not configured. The board will show live state after deployment.</div>}
      <div className="board-heading"><div><span>THE BOARD</span><h2>{board?.title || "Start with a source"}</h2></div><div className="board-mark"><Fingerprint size={17}/> {board ? short(board.owner) : "NO OWNER YET"}</div></div>
      <div className="thread-canvas">
        <div className="canvas-column source-column"><div className="column-heading"><span className="column-index">01</span><div><b>SOURCE PINS</b><small>Immutable GitHub file snapshots</small></div></div>
          {sources.map(node=><button className={`thread-card source-card ${selectedId===node.id?"selected":""}`} key={node.id} onClick={()=>setSelectedId(node.id)}><div className="card-meta"><span>SOURCE / {node.id}</span><Check size={15}/></div><blockquote>“{node.statement}”</blockquote><div className="card-bottom"><span>{short(node.source?.url.split("/")[3] || "source", 18, 0)}</span><span>L{node.source?.first_line}-{node.source?.last_line}</span></div></button>)}
          {!sources.length && <button className="empty-pin" onClick={()=>open("source")}><Plus size={20}/><b>Nothing pinned yet</b><span>Start with a file at a full Git commit SHA.</span></button>}
        </div>
        <div className="canvas-bridge"><span>→</span><small>VALIDATOR<br/>CONSENSUS</small></div>
        <div className="canvas-column claim-column"><div className="column-heading"><span className="column-index">02</span><div><b>DERIVED CLAIMS</b><small>Each one cites its parents</small></div></div>
          {inferences.map(node=><button className={`thread-card claim-card ${node.status==="BROKEN"?"broken":""} ${selectedId===node.id?"selected":""}`} key={node.id} onClick={()=>setSelectedId(node.id)}><div className="card-meta"><span>DEPTH {node.depth} / {node.id}</span><span>{node.status}</span></div><p>{node.statement}</p><div className="parent-tags">{node.parents.map(parent=><span key={parent}>↳ {parent}</span>)}</div></button>)}
          {!inferences.length && <button className="empty-pin" onClick={()=>open("derive")}><GitBranch size={20}/><b>No claim has been tested</b><span>A source becomes useful when another statement cites it.</span></button>}
        </div>
      </div>
      <div className="protocol-note"><LockKeyhole size={18}/><div><strong>The boundary is deliberate.</strong> Threadmark proves that a statement follows from the pinned text. It does not certify that a repository author is truthful, that a source is authoritative, or that an external action happened.</div></div>
    </section>

    <aside className="inspector"><div className="inspector-head"><span>INSPECTOR</span><button onClick={()=>setSelectedId(null)} aria-label="Clear selection"><X size={17}/></button></div>{selected ? <><div className={`inspector-stamp ${selected.status.toLowerCase()}`}>{selected.status}</div><h2>{selected.statement}</h2><div className="detail-row"><span>NODE</span><strong>{selected.id}</strong></div><div className="detail-row"><span>DEPTH</span><strong>{selected.depth}</strong></div><div className="detail-row"><span>AUTHOR</span><strong>{short(selected.author)}</strong></div>{selected.verdict && <div className="detail-row"><span>CONSENSUS</span><strong>{selected.verdict}</strong></div>}{selected.source && <><div className="detail-label">PINNED RECEIPT</div><a className="source-link" href={selected.source.url} target="_blank" rel="noreferrer">Open exact source <ArrowUpRight size={14}/></a><div className="hash">SHA-256<br/>{selected.source.sha256}</div><div className="detail-row"><span>LINES</span><strong>{selected.source.first_line}–{selected.source.last_line}</strong></div></>}<div className="detail-label">PROVENANCE PATH</div><div className="trace-list">{ancestry.map((node,index)=><button key={node.id} onClick={()=>setSelectedId(node.id)}><span>{String(index+1).padStart(2,"0")}</span><b>{node.id}</b><small>{node.kind}</small></button>)}</div></> : <div className="inspector-empty"><GitBranch size={34}/><h2>Every mark has a history.</h2><p>Select any card to inspect its source receipt and trace its full ancestry.</p></div>}</aside>

    {mode && <div className="overlay" onClick={()=>setMode(null)}><section className="composer" onClick={event=>event.stopPropagation()}><div className="composer-top"><span>{mode === "board" ? "NEW CASE FILE" : mode === "source" ? "PIN A SOURCE" : mode === "derive" ? "TEST AN INFERENCE" : "MANAGE AUTHORS"}</span><button onClick={()=>setMode(null)} aria-label="Close composer"><X size={18}/></button></div><h2>{mode === "board" ? "Name the board." : mode === "source" ? "Begin at the source." : mode === "derive" ? "Does this follow?" : "Invite an author."}</h2><p className="composer-lead">{mode === "source" ? "Use a raw GitHub file URL pinned to a full 40-character commit SHA. Validators fetch it independently and bind the exact lines and digest." : mode === "derive" ? "Choose up to three verified parents. A broken claim may stay on the board, but can never support another claim." : mode === "board" ? "A board is an append-only trail owned by your connected wallet." : "Only a board owner can grant another wallet permission to add nodes."}</p>
      {mode === "board" && <><label>BOARD ID<input value={boardId} onChange={event=>setBoardId(event.target.value)}/></label><label>BOARD TITLE<input value={boardTitle} onChange={event=>setBoardTitle(event.target.value)}/></label></>}
      {mode === "source" && <><label>NODE ID<input value={nodeId} onChange={event=>setNodeId(event.target.value)}/></label><label>PINNED RAW FILE URL<input value={sourceUrl} onChange={event=>setSourceUrl(event.target.value)}/></label><div className="line-pair"><label>FIRST LINE<input type="number" min="1" value={firstLine} onChange={event=>setFirstLine(event.target.value)}/></label><label>LAST LINE<input type="number" min="1" value={lastLine} onChange={event=>setLastLine(event.target.value)}/></label></div><label>EXACT QUOTE<textarea value={quote} onChange={event=>setQuote(event.target.value)}/></label></>}
      {mode === "derive" && <><label>NODE ID<input value={nodeId} onChange={event=>setNodeId(event.target.value)}/></label><label>PROPOSED STATEMENT<textarea value={statement} onChange={event=>setStatement(event.target.value)} placeholder="Write one precise claim that should follow from the selected cards."/></label><div className="parent-picker"><span>SELECT 1–3 PARENTS</span>{usable.length ? usable.map(node=><button className={parents.includes(node.id)?"picked":""} key={node.id} onClick={()=>toggleParent(node.id)}><span>{parents.includes(node.id)?<Check size={14}/>:<Plus size={14}/>}</span><b>{node.id}</b><small>{short(node.statement, 38, 0)}</small></button>) : <p>Pin a source before testing an inference.</p>}</div></>}
      {mode === "author" && <><label>ACTION<select value={authorAllowed ? "add" : "remove"} onChange={event=>{const allowed=event.target.value==="add";setAuthorAllowed(allowed);setAuthor(allowed ? "" : (board?.authors[0] || ""));setMessage("");}}><option value="add">Add author</option><option value="remove" disabled={!board?.authors.length}>Remove author</option></select></label>{authorAllowed?<label>AUTHOR WALLET<input value={author} onChange={event=>setAuthor(event.target.value)} placeholder="0x followed by 40 hexadecimal characters" autoComplete="off"/><small>{board?.authors.length || 0} of 8 author slots used</small></label>:<label>AUTHORIZED WALLET<select value={author} onChange={event=>setAuthor(event.target.value)}><option value="">Select an author to remove</option>{board?.authors.map(value=><option value={value} key={value}>{value}</option>)}</select></label>}</>}
      {message && <div className="composer-error">{message}</div>}
      <button className="commit-button" onClick={submit} disabled={!ADDRESS || !wallet}>{mode === "board" ? "Create board" : mode === "source" ? "Pin with validators" : mode === "derive" ? "Ask validators" : authorAllowed ? "Authorize author" : "Remove author"}<ArrowUpRight size={17}/></button>
      <div className="composer-foot">A submitted or accepted transaction is not a final result. The board updates after successful FINALIZED status.</div>
    </section></div>}
    {activeTx && tx && kit && <div className="transaction-overlay"><section className="transaction-box"><div className="transaction-head"><span>GENLAYER CHECKPOINT</span><button onClick={()=>setActiveTx(null)} aria-label="Close transaction"><X size={18}/></button></div><GenLayerTransactionPanel kit={kit} tx={tx} network="GenLayer Studio Next" theme="dark" trackUntil="finalized" onDone={done}/></section></div>}
  </main>;
}

function traceFrom(nodes: Node[], selected: Node): Node[] {
  const byId = new Map(nodes.map(node=>[node.id,node]));
  const seen = new Set<string>();
  const result: Node[] = [];
  const visit = (node: Node) => { if(seen.has(node.id)) return; seen.add(node.id); result.push(node); node.parents.forEach(id=>{const parent=byId.get(id); if(parent) visit(parent);}); };
  visit(selected);
  return result;
}
