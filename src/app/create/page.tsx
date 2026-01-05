"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";

type Message = { role: "assistant" | "user"; content: string };

import { useTranslations } from 'next-intl';
import { 
  useCreatorChat, useCreateInvitation, useGenerateInvitation, 
  useEnhanceText, useListify, useGenerateAssets, useUploadFile, 
  useGeoAutocomplete, useGeoReverse 
} from "@/hooks/use-birthude-api";

export default function CreateInvitationPage() {
  const t = useTranslations('create');
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMeta, setInputMeta] = useState<any>(null);
  const [stepId, setStepId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<any>({ items: [], assets: { images: [], videos: [], audios: [] } });
  
  const creatorChat = useCreatorChat();
  const createInv = useCreateInvitation();
  const genInv = useGenerateInvitation();

  useEffect(() => {
    bootstrap();
  }, []);

  async function bootstrap() {
    try {
        const data = await creatorChat.mutateAsync({ stepId: null, answers });
        setMessages([{ role: "assistant", content: data.message }]);
        setInputMeta(data.input);
        setStepId(data.step);
    } catch (e) {
        console.error(e);
    }
  }

  function pushUserMessage(text: string) {
    setMessages((m) => [...m, { role: "user", content: text }]);
  }

  async function proceed() {
    try {
        const data = await creatorChat.mutateAsync({ stepId, answers });
        setMessages((m) => [...m, { role: "assistant", content: data.message }]);
        setInputMeta(data.input);
        setStepId(data.step);
    } catch (e) {
        console.error(e);
    }
  }

  async function createInvitation() {
    const payload = {
      title: answers.title,
      theme: answers.theme,
      description: answers.description ?? "",
      eventAt: answers.eventAt,
      location: answers.location,
      lat: answers.lat,
      lng: answers.lng,
      items: answers.items ?? [],
      rafflePrize: answers.rafflePrize ?? null,
      assets: answers.assets ?? { images: [], videos: [], audios: [] },
      invitees: answers.invitees ?? [],
    };
    
    try {
        const data: any = await createInv.mutateAsync(payload);
        if (!data?.invitation?.slug) throw new Error("No slug");
        
        const slug: string = data.invitation.slug;
        await genInv.mutateAsync(slug);
        router.push(`/i/${slug}`);
    } catch (e) {
        console.error("create-invitation failed", e);
        setMessages((m) => [...m, { role: "assistant", content: "No se pudo crear la invitación. Revisa los campos obligatorios (título, fecha, ubicación)." }]);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-100 to-purple-100 dark:from-black dark:to-zinc-900 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="text-4xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t('subtitle')}</p>

        <div className="mt-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`max-w-xl rounded-2xl px-4 py-3 shadow ${m.role === "assistant" ? "bg-white/80 dark:bg-zinc-800" : "bg-pink-200 ml-auto dark:bg-pink-700"}`}>{m.content}</div>
          ))}
        </div>

        <div className="mt-6 rounded-2xl border bg-white/70 p-4 shadow dark:bg-zinc-800">
          {inputMeta?.type === "text" && (
            <TextInput fieldId={inputMeta.field?.id} label={inputMeta.field?.label} context={answers} onSubmit={async (val) => { pushUserMessage(val); setAnswers((a: any) => ({ ...a, [inputMeta.field.id]: val })); await proceed(); }} />
          )}

          {inputMeta?.type === "form" && (
            <SmallForm fields={inputMeta.fields} onSubmit={async (vals) => { pushUserMessage(Object.values(vals).join(" · ")); setAnswers((a: any) => ({ ...a, ...vals })); await proceed(); }} />
          )}

          {inputMeta?.type === "list" && (
            <ListBuilder label={inputMeta.field?.label} values={answers.items} context={answers} onAdd={(v) => setAnswers((a: any) => ({ ...a, items: [...(a.items ?? []), v] }))} onRemove={(v) => setAnswers((a: any) => ({ ...a, items: (a.items ?? []).filter((x: string) => x !== v) }))} onDone={async () => { pushUserMessage((answers.items ?? []).join(", ")); await proceed(); }} />
          )}

          {inputMeta?.type === "assets_upload" && (
            <AssetsUpload initial={answers.assets} onSubmit={async (assets) => { pushUserMessage(`Tus recursos: ${assets.images.length} imágenes`); setAnswers((a: any) => ({ ...a, assets })); await proceed(); }} />
          )}

          {inputMeta?.type === "assets_ai" && (
            <AssetsAISelect context={answers} onSubmit={async (picked) => { const merged = { ...answers.assets, images: [...(answers.assets?.images ?? []), ...picked] }; pushUserMessage(`AI seleccionadas: ${picked.length}`); setAnswers((a: any) => ({ ...a, assets: merged })); await proceed(); }} />
          )}

          {inputMeta?.type === "map" && (
            <LocationPicker onSubmit={async (loc) => { pushUserMessage(`${loc.address} (${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)})`); setAnswers((a: any) => ({ ...a, location: loc.address, lat: loc.lat, lng: loc.lng })); await proceed(); }} />
          )}

          {inputMeta?.type === "raffle" && (
            <RaffleInput onSubmit={async (prize) => { const text = prize ? `Sorteo con premio: ${prize}` : "Sin sorteo"; pushUserMessage(text); setAnswers((a: any) => ({ ...a, rafflePrize: prize ?? null })); await proceed(); }} />
          )}

          {inputMeta?.type === "invitees" && (
            <PeopleBuilder people={answers.invitees ?? []} onAdd={(p) => setAnswers((a: any) => ({ ...a, invitees: [...(a.invitees ?? []), p] }))} onRemove={(id) => setAnswers((a: any) => ({ ...a, invitees: (a.invitees ?? []).filter((x: any) => x.identifier !== id) }))} onDone={async () => { pushUserMessage(`${(answers.invitees ?? []).length} invitados`); await proceed(); }} />
          )}

          {!inputMeta && stepId === "final" && (
            <div className="flex justify-end">
              <button className="rounded-xl bg-purple-600 px-6 py-3 text-white shadow hover:bg-purple-700" onClick={createInvitation}>{t('createAction')}</button>
            </div>
          )}
        </div>

        {creatorChat.isPending && <div className="mt-3 text-sm opacity-70">{t('thinking')}</div>}
      </div>
    </div>
  );
}

function TextInput({ fieldId, label, context, onSubmit, loading }: { fieldId?: string; label?: string; context?: any; onSubmit: (val: string) => void; loading?: boolean }) {
  const t = useTranslations('create');
  const [val, setVal] = useState("");
  const enhance = useEnhanceText();

  async function handleEnhance() {
    if (!fieldId || !val.trim()) return;
    try {
        const data: any = await enhance.mutateAsync({ field: fieldId, text: val, context });
        if (data.result) setVal(data.result);
    } catch {}
  }
  return (
    <div className="flex gap-2">
      <input className="flex-1 rounded-xl border px-4 py-3" placeholder={label ?? t('typeAnswer')} value={val} onChange={(e) => setVal(e.target.value)} disabled={loading} />
      <button className="rounded-xl bg-purple-600 px-4 py-3 text-white" disabled={enhance.isPending || loading} onClick={handleEnhance}>{enhance.isPending ? t('enhancing') : t('enhance')}</button>
      <button className="rounded-xl bg-black px-5 py-3 text-white dark:bg-zinc-200 dark:text-black" disabled={loading} onClick={() => onSubmit(val)}>{loading ? t('loading') : t('send')}</button>
    </div>
  );
}

function SmallForm({ fields, onSubmit, loading }: { fields: any[]; onSubmit: (vals: Record<string, any>) => void; loading?: boolean }) {
  const t = useTranslations('create');
  const [vals, setVals] = useState<Record<string, any>>({});
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fields.map((f: any) => (
          <div key={f.id} className="flex gap-2">
            <input className="flex-1 rounded-xl border px-4 py-3" type={f.kind === "datetime" ? "datetime-local" : f.kind === "number" ? "number" : "text"} placeholder={f.label} value={vals[f.id] ?? ""} onChange={(e) => setVals((p) => ({ ...p, [f.id]: e.target.value }))} disabled={loading} />
            {(!f.kind || f.kind === "text") && (
              <EnhanceInline field={f.id} value={vals[f.id] ?? ""} context={vals} onDone={(t) => setVals((p) => ({ ...p, [f.id]: t }))} />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-end">
        <button className="rounded-xl bg-black px-5 py-3 text-white dark:bg-zinc-200 dark:text-black" disabled={loading} onClick={() => onSubmit(vals)}>{loading ? t('loading') : t('send')}</button>
      </div>
    </div>
  );
}

function ListBuilder({ label, values, context, onAdd, onRemove, onDone, loading }: { label?: string; values: string[]; context?: any; onAdd: (v: string) => void; onRemove: (v: string) => void; onDone: () => void; loading?: boolean }) {
  const t = useTranslations('create');
  const [val, setVal] = useState("");
  const listify = useListify();

  async function handleAI(seed: string) {
      if (!seed.trim()) return;
      try {
          const data: any = await listify.mutateAsync({ text: seed, context });
          if (Array.isArray(data.items)) {
              for (const it of data.items) {
                 onAdd(it);
              }
          }
      } catch {}
  }

  return (
    <div>
      <div className="flex gap-2">
        <input className="flex-1 rounded-xl border px-4 py-3" placeholder={label ?? t('addItem')} value={val} onChange={(e) => setVal(e.target.value)} disabled={loading} />
        <button className="rounded-xl bg-pink-500 px-4 py-3 text-white" disabled={loading} onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}>{t('add')}</button>
        <button className="rounded-xl bg-purple-600 px-4 py-3 text-white" disabled={listify.isPending || loading} onClick={() => { if (val.trim()) { handleAI(val.trim()); setVal(""); } }}>{listify.isPending ? "..." : t('utilAI')}</button>
        <button className="rounded-xl bg-black px-4 py-3 text-white" disabled={loading} onClick={onDone}>{loading ? t('loading') : t('done')}</button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {values?.map((it: string) => (
          <button key={it} className="rounded-full bg-pink-200 px-3 py-1 text-sm dark:bg-pink-700 hover:opacity-80" disabled={loading} onClick={() => onRemove(it)}>{it}</button>
        ))}
      </div>
    </div>
  );
}

type Res = { name: string; source: string; mimeType: string };
function AssetsUpload({ initial, onSubmit, loading }: { initial?: { images: Res[]; videos: Res[]; audios: Res[] }; onSubmit: (assets: { images: Res[]; videos: Res[]; audios: Res[] }) => void; loading?: boolean }) {
  const t = useTranslations('create');
  const [images, setImages] = useState<Res[]>(initial?.images ?? []);
  const [videos] = useState<Res[]>(initial?.videos ?? []);
  const [audios] = useState<Res[]>(initial?.audios ?? []);
  const [url, setUrl] = useState("");
  const upload = useUploadFile();

  function addUrl() { if (!url.trim()) return; setImages((p) => [...p, { name: url.trim(), source: url.trim(), mimeType: "image/*" }]); setUrl(""); }
  function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    files.forEach((f) => { if (!f.type.startsWith("image/")) return; const reader = new FileReader(); reader.onload = () => { const v = String(reader.result || ""); if (v) setImages((p) => [...p, { name: f.name || "image", source: v, mimeType: f.type }]); }; reader.readAsDataURL(f); });
    e.target.value = "";
  }
  return (
    <div className="space-y-3">
      <div className="text-sm opacity-80">{t('attachResources')}</div>
      <div className="flex items-center gap-2">
        <input type="file" accept="image/*" multiple onChange={onFiles} disabled={loading} />
        <input className="flex-1 rounded-xl border px-4 py-3" placeholder="https://image-url" value={url} onChange={(e) => setUrl(e.target.value)} disabled={loading} />
        <button className="rounded-xl bg-purple-600 px-4 py-3 text-white" disabled={loading} onClick={addUrl}>{t('upload')}</button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {images.map((u, idx) => (<img key={`${u.source}-${idx}`} src={u.source} alt="img" className="h-20 w-full rounded-lg object-cover" />))}
      </div>
      <div className="flex justify-end">
        <button className="rounded-xl bg-black px-5 py-3 text-white" disabled={upload.isPending || loading} onClick={async () => {
          const uploaded: Res[] = [];
          for (const r of images) {
            if (r.source.startsWith("data:")) {
              const mimeType = r.source.slice(5, r.source.indexOf(";"));
              try {
                  const json = await upload.mutateAsync({ data: r.source, mimeType, name: r.name || `image-${Date.now()}` });
                  if (json.fileUrl) uploaded.push({ name: r.name || "image", source: json.fileUrl, mimeType }); 
                  else uploaded.push({ name: r.name || "image", source: r.source, mimeType });
              } catch {
                  uploaded.push({ name: r.name || "image", source: r.source, mimeType });
              }
            } else {
              uploaded.push(r);
            }
          }
          onSubmit({ images: uploaded, videos, audios });
        }}>{upload.isPending || loading ? t('loading') : t('continue')}</button>
      </div>
    </div>
  );
}

function AssetsAISelect({ context, onSubmit, loading }: { context: any; onSubmit: (picked: Res[]) => void; loading?: boolean }) {
  const t = useTranslations('create');
  const [svgs, setSvgs] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [notice, setNotice] = useState<string>("");
  const gen = useGenerateAssets();
  const upload = useUploadFile();
  const [uploading, setUploading] = useState(false);
  const [loadingIndices, setLoadingIndices] = useState<number[]>([]);
  const [showPrompt, setShowPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  useEffect(() => { generate(); }, []);
  
  async function generate(overridePrompt?: string) {
    const selectedIndices = Object.entries(selected).filter(([_, v]) => v).map(([k]) => Number(k));
    const count = selectedIndices.length > 0 ? selectedIndices.length : 10;
    
    if (selectedIndices.length > 0) {
        setLoadingIndices(selectedIndices);
    } else {
        setLoadingIndices(Array.from({ length: 10 }, (_, i) => i));
    }
    
    setShowPrompt(false);

    try {
        const data: any = await gen.mutateAsync({ context, count, userPrompt: overridePrompt || customPrompt || undefined });
        const newSvgs = Array.isArray(data.svgs) ? data.svgs : [];
        
        if (selectedIndices.length > 0) {
            setSvgs(prev => {
                const next = [...prev];
                selectedIndices.forEach((idx, i) => {
                    if (newSvgs[i]) next[idx] = newSvgs[i];
                });
                return next;
            });
            setSelected({});
        } else {
            setSvgs(newSvgs);
            setSelected({});
        }
        
        setNotice(String(data.notice || ""));
    } catch {} finally {
        setLoadingIndices([]);
    }
  }
  
  function selectAll() { const next: Record<number, boolean> = {}; for (let i = 0; i < svgs.length; i++) next[i] = true; setSelected(next); }
  
  async function applySelection() {
    setUploading(true);
    const picks: Res[] = [];
    const sel = Object.entries(selected).filter(([_, v]) => v).map(([k]) => Number(k));
    for (const i of sel) {
      const svg = svgs[i];
      const base64 = btoa(unescape(encodeURIComponent(svg)));
      const dataUrl = `data:image/svg+xml;base64,${base64}`;
      let fileUrl = dataUrl;
      try {
        const json = await upload.mutateAsync({ data: dataUrl, mimeType: "image/svg+xml", name: `ai-${Date.now()}-${i}.svg` });
        if (json.fileUrl) fileUrl = json.fileUrl;
      } catch {}
      picks.push({ name: `ai-${i}.svg`, source: fileUrl, mimeType: "image/svg+xml" });
    }
    setUploading(false);
    if (!picks.length) return;
    onSubmit(picks);
  }

  function deleteSelected() {
    setSvgs(prev => prev.filter((_, i) => !selected[i]));
    setSelected({});
  }
  
  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-80">{t('selectAI')}</div>
        <div className="flex items-center gap-2">
            {selectedCount > 0 && (
                <button className="rounded-xl border px-3 py-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={deleteSelected} title={t('delete')}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                </button>
            )}
            <div className="relative flex items-center">
                <button className="rounded-l-xl border-y border-l px-4 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800" disabled={gen.isPending} onClick={() => generate()}>
                  {selectedCount > 0 ? t('regenerateCount', { count: selectedCount }) : t('regenerate')}
                </button>
                <button className="rounded-r-xl border px-2 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800" disabled={gen.isPending} onClick={() => setShowPrompt(!showPrompt)}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
                {showPrompt && (
                    <div className="absolute right-0 top-full mt-2 z-20 w-72 rounded-xl border bg-white p-3 shadow-xl dark:bg-zinc-800">
                        <textarea 
                            className="w-full rounded-lg border px-3 py-2 text-sm min-h-[80px]" 
                            placeholder={t('customPrompt')} 
                            value={customPrompt} 
                            onChange={(e) => setCustomPrompt(e.target.value)}
                        />
                        <button 
                            className="mt-2 w-full rounded-lg bg-black py-2 text-sm text-white dark:bg-zinc-200 dark:text-black"
                            onClick={() => generate()}
                        >
                            {t('generateWithPrompt')}
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>
      {notice && (
        <div className="rounded-xl border bg-yellow-100 px-3 py-2 text-sm text-yellow-900">{notice}</div>
      )}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {svgs.map((svg, i) => (
          <div key={i} className="relative group">
            <button 
                className={`w-full h-full rounded-xl border p-2 transition-all ${selected[i] ? "ring-2 ring-purple-600 bg-purple-50 dark:bg-purple-900/20" : "hover:border-purple-300"}`} 
                onClick={() => setSelected((s) => ({ ...s, [i]: !s[i] }))} 
                dangerouslySetInnerHTML={{ __html: svg }} 
            />
            {loadingIndices.includes(i) && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-black/60 rounded-xl backdrop-blur-[1px] transition-all">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                </div>
            )}
            <div className={`absolute top-2 right-2 h-4 w-4 rounded-full border border-purple-600 ${selected[i] ? "bg-purple-600" : "bg-transparent opacity-0 group-hover:opacity-50"} transition-all pointer-events-none`} />
          </div>
        ))}
        {/* Fill empty slots if generating initial batch and svgs is empty */}
        {svgs.length === 0 && loadingIndices.length > 0 && loadingIndices.map((i) => (
             <div key={i} className="aspect-square rounded-xl border bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
        ))}
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-70">{t('selected')}: {selectedCount}</div>
        <div className="flex gap-2">
          <button className="rounded-xl border px-4 py-3" onClick={selectAll}>{t('selectAll')}</button>
          <button className="rounded-xl bg-black px-5 py-3 text-white dark:bg-zinc-200 dark:text-black" disabled={!selectedCount || gen.isPending || uploading} onClick={applySelection}>{uploading ? t('loading') : t('useSelected')}</button>
        </div>
      </div>
    </div>
  );
}
const MapCanvas = dynamic(() => import("@/components/map-canvas"), { ssr: false });

function LocationPicker({ onSubmit }: { onSubmit: (loc: { address: string; lat: number; lng: number }) => void }) {
  const t = useTranslations('create');
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 1000);
    return () => clearTimeout(t);
  }, [query]);

  const { data: suggestionsData } = useGeoAutocomplete(debouncedQuery);
  const suggestions = suggestionsData?.results ?? [];

  // Reverse geocoding is triggered by map click, which we handle manually
  // But we can use the hook imperatively or just wrap fetcher.
  // Actually, let's keep it simple and just use the query hook when we have lat/lng
  // But map click is an event. We can use `useQueryClient` to fetch or just a direct fetch call?
  // The prompt said "use react query... organize code in a file... use that code".
  // `useGeoReverse` is a hook. We can't call a hook inside a callback.
  // We can render a component that fetches when props change, or use `queryClient.fetchQuery`.
  // Let's use `queryClient.fetchQuery` for the imperative map click.
  // But `useGeoReverse` hook is better for declarative.
  // Let's refactor: when map is clicked, set a temp state `clickedCoords`, which triggers the hook.
  
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lng: number } | null>(null);
  const reverse = useGeoReverse(clickedCoords?.lat ?? 0, clickedCoords?.lng ?? 0);

  useEffect(() => {
      if (clickedCoords && reverse.data) {
          const data = reverse.data;
          let address = `${clickedCoords.lat.toFixed(5)}, ${clickedCoords.lng.toFixed(5)}`;
          if (data?.results?.[0]?.formatted) {
              address = data.results[0].formatted;
          }
          setSel({ address, lat: clickedCoords.lat, lng: clickedCoords.lng });
          setClickedCoords(null); // Reset to stop fetching
      }
  }, [clickedCoords, reverse.data]);

  function handleMapClick(lat: number, lng: number) {
      setClickedCoords({ lat, lng });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input className="flex-1 rounded-xl border px-4 py-3" placeholder={t('searchAddress')} value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {!!suggestions.length && (
        <div className="rounded-xl border bg-white/80 p-2 text-sm shadow dark:bg-zinc-700">
          {suggestions.map((s: any) => (
            <button key={s.place_id} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-pink-100 dark:hover:bg-zinc-600" onClick={() => { setSel({ address: s.formatted, lat: s.lat, lng: s.lon }); setQuery(s.formatted); }}>
              {s.formatted}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-hidden rounded-2xl border">
        <MapCanvas onClick={handleMapClick} marker={sel ? { lat: sel.lat, lng: sel.lng } : undefined} />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-sm opacity-80">{sel ? sel.address : t('tapMap')}</div>
        <button className="rounded-xl bg-black px-5 py-3 text-white dark:bg-zinc-200 dark:text-black" disabled={!sel} onClick={() => sel && onSubmit(sel)}>{t('useLocation')}</button>
      </div>
    </div>
  );
}
function EnhanceInline({ field, value, context, onDone }: { field: string; value: string; context?: any; onDone: (t: string) => void }) {
  const t = useTranslations('create');
  const enhance = useEnhanceText();
  
  async function run() {
    if (!value.trim()) return;
    try {
        const data: any = await enhance.mutateAsync({ field, text: value, context });
        if (data.result) onDone(data.result);
    } catch {}
  }
  return (
    <button className="rounded-xl bg-purple-600 px-3 py-3 text-white" disabled={enhance.isPending} onClick={run}>{enhance.isPending ? "..." : t('enhance')}</button>
  );
}
function RaffleInput({ onSubmit }: { onSubmit: (prize: string | null) => void }) {
  const t = useTranslations('create');
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input className="flex-1 rounded-xl border px-4 py-3" placeholder={t('rafflePrize')} value={val} onChange={(e) => setVal(e.target.value)} />
      <button className="rounded-xl bg-purple-600 px-4 py-3 text-white" onClick={() => onSubmit(val.trim() ? val.trim() : null)}>{t('submit')}</button>
      <button className="rounded-xl border px-4 py-3" onClick={() => onSubmit(null)}>{t('noRaffle')}</button>
    </div>
  );
}
import { InviteeForm } from "@/components/invitee-form";

function PeopleBuilder({ people, onAdd, onRemove, onDone }: { people: Array<{ identifier: string; name?: string; age?: number; imageUrl?: string; isOrganizer?: boolean; context?: string }>; onAdd: (p: { identifier: string; name?: string; age?: number; imageUrl?: string; isOrganizer?: boolean; context?: string }) => void; onRemove: (identifier: string) => void; onDone: () => void }) {
  const t = useTranslations('create');
  
  return (
    <div className="space-y-3">
      <InviteeForm onAdd={onAdd} onDone={onDone} mode="builder" />
      <div className="mt-2 flex flex-wrap gap-2">
        {people?.map((p) => (
          <button key={p.identifier} className="rounded-full bg-purple-200 px-3 py-1 text-sm dark:bg-purple-700 hover:opacity-80" onClick={() => onRemove(p.identifier)}>{p.name ?? p.identifier}{p.isOrganizer ? ` • ${t('organizer')}` : ""}</button>
        ))}
      </div>
    </div>
  );
}