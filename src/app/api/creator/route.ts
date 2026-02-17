import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openrouter } from "@/lib/ai";

type StepId =
  | "title_theme"
  | "datetime"
  | "location"
  | "description"
  | "items"
  | "invitees"
  | "assets"
  | "raffle"
  | "final";

const labels: Record<string, Record<string, string>> = {
  en: {
    title: "Title", theme: "Theme", eventAt: "Date & Time", location: "Location",
    description: "Description", items: "Things to bring", invitees: "Invitees",
    assets: "Resources", rafflePrize: "Raffle Prize"
  },
  es: {
    title: "Título", theme: "Tema", eventAt: "Fecha y Hora", location: "Ubicación",
    description: "Descripción", items: "Cosas para llevar", invitees: "Invitados",
    assets: "Recursos", rafflePrize: "Premio del sorteo"
  },
  fr: {
    title: "Titre", theme: "Thème", eventAt: "Date et Heure", location: "Lieu",
    description: "Description", items: "Choses à apporter", invitees: "Invités",
    assets: "Ressources", rafflePrize: "Prix de la tombola"
  },
  pt: {
    title: "Título", theme: "Tema", eventAt: "Data e Hora", location: "Localização",
    description: "Descrição", items: "Coisas para levar", invitees: "Convidados",
    assets: "Recursos", rafflePrize: "Prêmio do sorteio"
  }
};

function getSteps(locale: string) {
  const l = (labels as any)[locale] || labels.en;
  return [
    { id: "title_theme", input: { type: "form", fields: [{ id: "title", label: l.title }, { id: "theme", label: l.theme }] } },
    { id: "datetime", input: { type: "form", fields: [{ id: "eventAt", label: l.eventAt, kind: "datetime" }] } },
    { id: "location", input: { type: "map", field: { id: "location", label: l.location } } },
    { id: "description", input: { type: "text", field: { id: "description", label: l.description } } },
    { id: "items", input: { type: "list", field: { id: "items", label: l.items } } },
    { id: "invitees", input: { type: "invitees", field: { id: "invitees", label: l.invitees } } },
    { id: "assets", input: { type: "assets_upload", field: { id: "assets", label: l.assets } } },
    { id: "raffle", input: { type: "raffle", field: { id: "rafflePrize", label: l.rafflePrize } } },
  ];
}

const fallbackMessages: Record<string, Record<StepId, string>> = {
  en: {
    title_theme: "Let’s set the vibe. What’s the invitation title and the party theme?",
    datetime: "When does the party start? Share the date and time.",
    location: "Where are we meeting? Pick a place on the map or search.",
    description: "Describe the party. Any notes, dress code, or special message?",
    items: "What should guests bring? Add items one by one and press Done.",
    invitees: "Add invitees: name, age, optional image, and mark organizers.",
    assets: "Attach your resources: upload images or paste URLs.",
    raffle: "Will there be a raffle? Enter the prize or choose 'No raffle'.",
    final: "All set.",
  },
  es: {
    title_theme: "Vamos a crear el ambiente. ¿Cuál es el título de la invitación y el tema de la fiesta?",
    datetime: "¿Cuándo empieza la fiesta? Comparte la fecha y la hora.",
    location: "¿Dónde nos reunimos? Elige un lugar en el mapa o busca.",
    description: "Describe la fiesta. ¿Alguna nota, código de vestimenta o mensaje especial?",
    items: "¿Qué deben traer los invitados? Añade artículos uno por uno y pulsa Listo.",
    invitees: "Añade invitados: nombre, edad, imagen opcional y marca organizadores.",
    assets: "Adjunta tus recursos: sube imágenes o pega URLs.",
    raffle: "¿Habrá sorteo? Ingresa el premio o elige 'Sin sorteo'.",
    final: "Todo listo.",
  },
  fr: {
    title_theme: "Mettons l'ambiance. Quel est le titre de l'invitation et le thème de la fête ?",
    datetime: "Quand commence la fête ? Partagez la date et l'heure.",
    location: "Où nous réunissons-nous ? Choisissez un lieu sur la carte ou recherchez.",
    description: "Décrivez la fête. Des notes, un code vestimentaire ou un message spécial ?",
    items: "Que doivent apporter les invités ? Ajoutez des articles un par un et appuyez sur Terminé.",
    invitees: "Ajoutez des invités : nom, âge, image facultative et marquez les organisateurs.",
    assets: "Joignez vos ressources : téléchargez des images ou collez des URL.",
    raffle: "Y aura-t-il une tombola ? Entrez le prix ou choisissez 'Pas de tombola'.",
    final: "Tout est prêt.",
  },
  pt: {
    title_theme: "Vamos definir o clima. Qual é o título do convite e o tema da festa?",
    datetime: "Quando a festa começa? Compartilhe a data e a hora.",
    location: "Onde vamos nos encontrar? Escolha um lugar no mapa ou pesquise.",
    description: "Descreva a festa. Alguma nota, código de vestimenta ou mensagem especial?",
    items: "O que os convidados devem trazer? Adicione itens um por um e pressione Concluído.",
    invitees: "Adicione convidados: nome, idade, imagem opcional e marque organizadores.",
    assets: "Anexe seus recursos: envie imagens ou cole URLs.",
    raffle: "Haverá um sorteio? Digite o prêmio ou escolha 'Sem sorteio'.",
    final: "Tudo pronto.",
  }
};

function templateQuestion(id: StepId, locale: string) {
  const lang = (fallbackMessages as any)[locale] || fallbackMessages.en;
  return lang[id] || lang.final;
}

function templateSummary(a: any) {
  const raffleLine = a.rafflePrize ? `Sorteo: ${a.rafflePrize}` : "Sin sorteo";
  return `Title: ${a.title}\nTheme: ${a.theme}\nWhen: ${a.eventAt}\nWhere: ${a.location}\nDescription: ${a.description ?? ""}\nItems: ${(a.items ?? []).join(", ")}\n${raffleLine}\nAssets: images(${(a.assets?.images ?? []).length}), videos(${(a.assets?.videos ?? []).length}), audios(${(a.assets?.audios ?? []).length})`;
}

export async function POST(req: NextRequest) {
  const { stepId, answers } = await req.json();
  const locale = req.cookies.get("NEXT_LOCALE")?.value || "en";
  const steps = getSteps(locale);
  const idx = Math.max(0, steps.findIndex((s) => s.id === stepId) + 1);
  const step = steps[idx] ?? { id: "final", input: null };

  if (step.id === "final") {
    let summary = templateSummary(answers || {});
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const { text } = await generateText({
          model: openrouter("openrouter/auto"),
          prompt: `Summarize this birthday invitation in a friendly tone in language code "${locale}":\n${JSON.stringify(answers)}`,
        });
        summary = text;
      } catch { }
    }
    return NextResponse.json({ step: "final", message: summary, input: null, cta: { label: "Create Invitation" } });
  }

  let message = templateQuestion(step.id as StepId, locale);
  if (process.env.OPENROUTER_API_KEY) {
    try {
      const { text } = await generateText({
        model: openrouter("openrouter/auto"),
        prompt: `Write a clear friendly question for step "${step.id}" of a party invitation designer chat. it must be in language code: "${locale}". example question: ${message}
        Return just simple the question that you want to ask, whatever your output is, it is what the user is going to see
        `,
      });
      message = text;
    } catch { }
  }

  return NextResponse.json({ step: step.id, message, input: step.input });
}