import type { MindLink, MindNode, MindNodeKind, Mastery } from "@/types";

export type StudyPackNode = {
  tempId: string;
  title: string;
  kind: MindNodeKind;
  summary: string;
  keywords: string[];
  parentTempId: string | null;
};

export type StudyPackLink = {
  sourceTempId: string;
  targetTempId: string;
  label?: string;
};

function uid(prefix = "n"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

const KIND_STEP: Record<MindNodeKind, number> = {
  hub: 0,
  topico: 280,
  conceito: 250,
  artigo: 230,
  explicacao: 210,
};

/**
 * Monta nós/links no estilo caderno.
 * Ramos ao redor do hub (360°) — usa cima e baixo. Muitos artigos → grade radial.
 */
export function layoutStudyPack(input: {
  centralTitle: string;
  nodes: StudyPackNode[];
  links: StudyPackLink[];
}): { nodes: MindNode[]; links: MindLink[]; idMap: Record<string, string> } {
  const idMap: Record<string, string> = {};
  const rootId = uid("hub");
  idMap["__root__"] = rootId;

  for (const n of input.nodes) {
    idMap[n.tempId] = uid(n.kind === "artigo" ? "art" : "n");
  }

  const childrenOf = new Map<string | null, StudyPackNode[]>();
  for (const n of input.nodes) {
    const p = n.parentTempId;
    const list = childrenOf.get(p) ?? [];
    list.push(n);
    childrenOf.set(p, list);
  }

  const roots = childrenOf.get(null) ?? input.nodes.filter((n) => !n.parentTempId);
  const positions = new Map<string, { x: number; y: number }>();
  positions.set(rootId, { x: 0, y: 0 });

  const placeKids = (
    items: StudyPackNode[],
    parentId: string,
    outwardAngle: number,
  ) => {
    const parentPos = positions.get(parentId) ?? { x: 0, y: 0 };
    const n = items.length;
    if (!n) return;

    const mostlyArticles =
      n >= 5 && items.filter((i) => i.kind === "artigo").length >= Math.ceil(n * 0.6);

    if (mostlyArticles) {
      // Grade perpendicular ao eixo radial (cresce para fora do hub).
      const rowH = 150;
      const cos = Math.cos(outwardAngle);
      const sin = Math.sin(outwardAngle);
      // Vetor perpendicular (sentido horário)
      const px = -sin;
      const py = cos;
      const mid = (n - 1) / 2;

      items.forEach((item, i) => {
        const id = idMap[item.tempId]!;
        const along = 300;
        const across = (i - mid) * rowH;
        const x = parentPos.x + cos * along + px * across;
        const y = parentPos.y + sin * along + py * across;
        positions.set(id, { x, y });

        const kids = childrenOf.get(item.tempId) ?? [];
        kids.forEach((kid, ki) => {
          const kidId = idMap[kid.tempId]!;
          positions.set(kidId, {
            x: x + cos * (280 + ki * 40),
            y: y + sin * (280 + ki * 40) + ki * 20,
          });
          const grand = childrenOf.get(kid.tempId) ?? [];
          if (grand.length) placeKids(grand, kid.tempId, outwardAngle);
        });
      });
      return;
    }

    // Leque centrado no ângulo de saída (filhos do hub usam 360°).
    const isHub = parentId === rootId;
    items.forEach((item, i) => {
      let ang: number;
      if (isHub && n >= 2) {
        // Distribuição uniforme em círculo completo (começa em cima, segue horário).
        ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      } else if (n === 1) {
        ang = outwardAngle;
      } else {
        const sweep = Math.min(1.6, 0.45 + n * 0.22);
        ang = outwardAngle + (i - (n - 1) / 2) * (sweep / Math.max(n - 1, 1));
      }

      const r = (KIND_STEP[item.kind] || 200) + Math.min(n, 8) * 10;
      const id = idMap[item.tempId]!;
      positions.set(id, {
        x: parentPos.x + Math.cos(ang) * r,
        y: parentPos.y + Math.sin(ang) * r,
      });
      const kids = childrenOf.get(item.tempId) ?? [];
      if (kids.length) placeKids(kids, id, ang);
    });
  };

  placeKids(roots, rootId, -Math.PI / 2);

  const nodes: MindNode[] = [
    {
      id: rootId,
      position: positions.get(rootId)!,
      data: {
        title: input.centralTitle.slice(0, 80) || "Tema central",
        kind: "hub",
        root: true,
        mastery: "nao-estudado" as Mastery,
        summary: "Tema central do mapa — ramifique artigos, conceitos e relações.",
      },
    },
  ];

  for (const item of input.nodes) {
    const id = idMap[item.tempId]!;
    nodes.push({
      id,
      position: positions.get(id) ?? { x: 200, y: 0 },
      data: {
        title: item.title.slice(0, 80),
        kind: item.kind,
        mastery: "nao-estudado",
        ...(item.summary ? { summary: item.summary.slice(0, 600) } : {}),
        ...(item.keywords.length ? { keywords: item.keywords.slice(0, 8) } : {}),
      },
    });
  }

  const links: MindLink[] = [];
  const seen = new Set<string>();

  for (const item of input.nodes) {
    const parentKey = item.parentTempId;
    const source = parentKey ? idMap[parentKey] : rootId;
    const target = idMap[item.tempId];
    if (!source || !target || source === target) continue;
    const key = `${source}->${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ id: uid("l"), source, target });
  }

  for (const l of input.links) {
    const source = idMap[l.sourceTempId];
    const target = idMap[l.targetTempId];
    if (!source || !target || source === target) continue;
    const key = `${source}->${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({
      id: uid("l"),
      source,
      target,
      ...(l.label?.trim() ? { label: l.label.trim().slice(0, 80) } : {}),
    });
  }

  return { nodes, links, idMap };
}

export function layoutOutline(input: {
  rootTitle: string;
  topics: { title: string; summary: string; children?: { title: string; summary: string }[] }[];
}): { nodes: MindNode[]; links: MindLink[] } {
  const packNodes: StudyPackNode[] = [];
  const links: StudyPackLink[] = [];
  input.topics.forEach((t, i) => {
    const tid = `t${i}`;
    packNodes.push({
      tempId: tid,
      title: t.title,
      kind: "topico",
      summary: t.summary,
      keywords: [],
      parentTempId: null,
    });
    (t.children ?? []).forEach((c, j) => {
      const cid = `t${i}c${j}`;
      packNodes.push({
        tempId: cid,
        title: c.title,
        kind: "conceito",
        summary: c.summary,
        keywords: [],
        parentTempId: tid,
      });
    });
  });
  const { nodes, links: built } = layoutStudyPack({
    centralTitle: input.rootTitle,
    nodes: packNodes,
    links,
  });
  return { nodes, links: built };
}
