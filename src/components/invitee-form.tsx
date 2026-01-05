"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useUploadFile } from "@/hooks/use-birthude-api";

type Props = {
  onAdd: (p: { identifier: string; name?: string; age?: number; imageUrl?: string; isOrganizer?: boolean; context?: string }) => void;
  onDone?: () => void;
  loading?: boolean;
  mode: "builder" | "tool"; // "builder" for create flow, "tool" for organizer view
};

export function InviteeForm({ onAdd, onDone, loading, mode }: Props) {
  const t = useTranslations('create');
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [age, setAge] = useState<number | "">("");
  const [imageUrl, setImageUrl] = useState("");
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [context, setContext] = useState("");
  
  const upload = useUploadFile();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
        const dataUrl = String(reader.result || "");
        const mimeType = file.type;
        try {
            const json = await upload.mutateAsync({ 
                data: dataUrl, 
                mimeType, 
                name: file.name || `invitee-${Date.now()}` 
            });
            if (json.fileUrl) {
                setImageUrl(json.fileUrl);
            }
        } catch (err) {
            console.error("Upload failed", err);
        } finally {
            setUploading(false);
        }
    };
    reader.readAsDataURL(file);
  }

  function add() {
    const payload = { 
        identifier: identifier.trim() || name.trim(), 
        name: name.trim() || undefined, 
        age: typeof age === "number" ? age : undefined, 
        imageUrl: imageUrl.trim() || undefined, 
        isOrganizer,
        context: context.trim() || undefined
    };
    if (!payload.identifier) return;
    onAdd(payload);
    
    // Reset form
    setName(""); 
    setIdentifier(""); 
    setAge(""); 
    setImageUrl(""); 
    setIsOrganizer(false);
    setContext("");
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input 
            className="rounded-xl border px-4 py-3" 
            placeholder={t('name')} 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            disabled={loading || uploading}
        />
        <input 
            className="rounded-xl border px-4 py-3" 
            placeholder={t('identifier')} 
            value={identifier} 
            onChange={(e) => setIdentifier(e.target.value)} 
            disabled={loading || uploading}
        />
        <input 
            className="rounded-xl border px-4 py-3" 
            type="number" 
            placeholder={t('age')} 
            value={age as any} 
            onChange={(e) => setAge(e.target.value ? Number(e.target.value) : "")} 
            disabled={loading || uploading}
        />
        
        <div className="flex gap-2 items-center">
             <div className="relative flex-1">
                 <input 
                    className="w-full rounded-xl border px-4 py-3 pr-10" 
                    placeholder={t('imageUrl')} 
                    value={imageUrl} 
                    onChange={(e) => setImageUrl(e.target.value)} 
                    disabled={loading || uploading}
                />
                {uploading && (
                    <div className="absolute right-3 top-3 h-5 w-5 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
                )}
             </div>
             <label className="cursor-pointer rounded-xl bg-gray-200 px-3 py-3 hover:bg-gray-300 dark:bg-zinc-700 dark:hover:bg-zinc-600">
                 <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={loading || uploading} />
                 📷
             </label>
        </div>
      </div>
      
      <textarea
        className="w-full rounded-xl border px-4 py-3"
        placeholder={t('inviteeContext') || "Context (e.g. loves jazz, hates spiders)"}
        value={context}
        onChange={(e) => setContext(e.target.value)}
        disabled={loading || uploading}
        rows={2}
      />

      <div className="flex items-center gap-2">
        <label className="text-sm select-none cursor-pointer flex items-center">
            <input type="checkbox" className="mr-2" checked={isOrganizer} onChange={(e) => setIsOrganizer(e.target.checked)} disabled={loading || uploading} />
            {t('organizer')}
        </label>
        
        <button className="ml-auto rounded-xl bg-purple-600 px-4 py-3 text-white disabled:opacity-50" onClick={add} disabled={loading || uploading || (!identifier && !name)}>
            {mode === "builder" ? t('add') : t('invite')}
        </button>
        
        {mode === "builder" && onDone && (
            <button className="rounded-xl bg-black px-4 py-3 text-white dark:bg-zinc-200 dark:text-black disabled:opacity-50" onClick={onDone} disabled={loading || uploading}>
                {t('ready')}
            </button>
        )}
      </div>
    </div>
  );
}
