"""
Extrai as figuras/tabelas/prints das provas oficiais TJSP (PDF original) e
vincula cada uma à questão — ao enunciado ou à alternativa certa.

Por que existe: o import (scripts/import-tjsp-official-provas.mjs) converte o
PDF em TEXTO; tudo que era desenho/print/planilha sumia. A questão dizia
"conforme a imagem a seguir" e o aluno não via imagem nenhuma (TJ Quest,
simulados, Mais cobradas).

Saída:
  public/provas-media/<id>-<n>.png          (recortes a 170 dpi)
  src/data/tjsp-official-media.json        (id → { statement[], alternatives{} })

Uso (requer PyMuPDF: pip install pymupdf):
  python scripts/extract-tjsp-official-media.py "C:/Users/<você>/Downloads/Provas tjsp"
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
_ARGS = [a for a in sys.argv[1:] if not a.startswith("--")]
SRC = Path(_ARGS[0]) if _ARGS else Path.home() / "Downloads" / "Provas tjsp"
OUT_PNG = ROOT / "public" / "provas-media"
OUT_JSON = ROOT / "src" / "data" / "tjsp-official-media.json"
DATA = ROOT / "src" / "data" / "tjsp-official-provas.json"

FILES = {
    2018: "2018/escrevente_tecnico_judiciario2018.pdf",
    2021: "2021/escrevente_tecnico_judiciario2021.pdf",
    2023: "2023/escrevente_tecnico_judiciario2023.pdf",
    2024: "2024/escrevente_tecnico_judiciario2024.pdf",
    2025: "2025/escrevente_tecnico_judiciario2025.pdf",
}

# Revisão manual (pranchas de contato): o "desenho" é só a chave "{" de
# proposições que JÁ estão no texto — recortar cortaria frases ao meio.
SKIP_QUESTIONS = {"tjsp-oficial-2023-q099", "tjsp-oficial-2023-q100"}

# Alternativas desenhadas como vetor (frações), sem texto no PDF — lidas no
# caderno oficial e conferidas no recorte da página 19 da prova de 2021.
KNOWN_ALT_TEXT = {
    "tjsp-oficial-2021-q074": {"A": "1/5", "B": "1/2", "C": "1/4", "D": "1/6", "E": "1/3"},
}

Q_START = re.compile(r"^\s*(?:R\s*A\s*S\s*C\s*U\s*N\s*H\s*O\s*)?(\d{1,3})\s*\.\s")
ALT_LABEL = re.compile(r"^\s*\(([A-E])\)")
SECTION_HEADER = re.compile(
    r"^(CONHECIMENTOS|L[ÍI]NGUA PORTUGUESA|Direito (Penal|Processual|Constitucional|Administrativo)|"
    r"Legisla[çc][ãa]o|Normas da Corregedoria|Atualidades|Matem[áa]tica|Inform[áa]tica|Racioc[íi]nio)",
    re.I,
)


def is_two_columns(page):
    mid = page.rect.width / 2
    right = [b for b in page.get_text("blocks") if b[0] > mid + 5 and 45 < b[1] < page.rect.height - 70]
    return len(right) >= 3


def question_starts(doc):
    out = []
    for pno, page in enumerate(doc):
        if pno == 0:
            continue  # capa
        two = is_two_columns(page)
        mid = page.rect.width / 2
        for b in page.get_text("blocks"):
            m = Q_START.match(b[4])
            if not m:
                continue
            n = int(m.group(1))
            if not 1 <= n <= 100:
                continue
            col = 1 if (two and b[0] > mid - 10) else 0
            out.append((pno, col, b[1], n, two))
    seen, uniq = set(), []
    for s in sorted(out, key=lambda t: (t[0], t[1], t[2])):
        if s[3] in seen:
            continue
        seen.add(s[3])
        uniq.append(s)
    return uniq


def regions_for(doc, starts, number):
    idx = next((i for i, s in enumerate(starts) if s[3] == number), None)
    if idx is None:
        return []
    cur = starts[idx]
    nxt = starts[idx + 1] if idx + 1 < len(starts) else None
    regs = []
    pno, col, y0 = cur[0], cur[1], cur[2]
    while pno < len(doc) and len(regs) <= 4:
        page = doc[pno]
        w, h = page.rect.width, page.rect.height
        two = is_two_columns(page)
        cx0, cx1 = (0, w) if not two else ((0, w / 2) if col == 0 else (w / 2, w))
        end_here = nxt and nxt[0] == pno and (nxt[1] == col or not two)
        regs.append((pno, pymupdf.Rect(cx0, y0, cx1, nxt[2] if end_here else h)))
        if end_here or not nxt:
            break
        if two and col == 0:
            col, y0 = 1, 0
        else:
            pno, col, y0 = pno + 1, 0, 0
    return regs


def watermark_xrefs(doc):
    # Conta páginas que DESENHAM a imagem (get_image_info), não as que só a
    # declaram nos recursos: o PDF de 2021 declara a pintura da questão 67 em
    # 28 páginas, mas ela só aparece na página 17.
    count = {}
    for page in doc:
        for x in {info["xref"] for info in page.get_image_info(xrefs=True) if info.get("xref")}:
            count[x] = count.get(x, 0) + 1
    return {x for x, c in count.items() if c >= max(3, 0.3 * len(doc))}


def visual_rects(page, region, skip_xrefs):
    h = page.rect.height
    rects = []
    for info in page.get_image_info(xrefs=True):
        if info.get("xref") in skip_xrefs:
            continue
        r = pymupdf.Rect(info["bbox"])
        if r.width < 30 or r.height < 20:
            continue
        if region.intersects(r) and (r & region).get_area() > 0.5 * r.get_area():
            rects.append(("img", r))
    for d in page.get_drawings():
        r = d["rect"]
        if r.width < 2 and r.height < 2:
            continue
        if r.width > page.rect.width * 0.9 or r.height > h * 0.9:
            continue
        if r.y0 > h - 70 or r.y1 < 45:
            continue
        # tabela que atravessa o vão entre colunas: aceita se o centro está na região
        c = pymupdf.Point((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)
        if region.contains(r) or (region.contains(c) and r.width < page.rect.width * 0.7):
            rects.append(("vec", r))
    return rects


def cluster(rects, breaks, gap=8):
    """Agrupa por proximidade vertical, sem atravessar o início de uma alternativa."""
    def seg(y):
        return sum(1 for b in breaks if y >= b - 2)

    groups = []
    for kind, r in sorted(rects, key=lambda t: (t[1].y0, t[1].x0)):
        for g in groups:
            u = g["rect"]
            if seg(r.y0) == g["seg"] and r.y0 <= u.y1 + gap and r.y1 >= u.y0 - gap:
                g["rect"] = u | r
                g["kinds"].add(kind)
                g["n"] += 1
                break
        else:
            groups.append({"rect": pymupdf.Rect(r), "kinds": {kind}, "n": 1, "seg": seg(r.y0)})
    changed = True
    while changed:
        changed = False
        for i in range(len(groups)):
            for j in range(i + 1, len(groups)):
                a, b = groups[i], groups[j]
                if a["seg"] != b["seg"]:
                    continue
                if b["rect"].y0 <= a["rect"].y1 + gap and b["rect"].y1 >= a["rect"].y0 - gap:
                    a["rect"] |= b["rect"]
                    a["kinds"] |= b["kinds"]
                    a["n"] += b["n"]
                    del groups[j]
                    changed = True
                    break
            if changed:
                break
    def keep(g):
        # Dentro das alternativas a figura pode ser simples (1 heptágono + 1 seta).
        if g["seg"] > 0:
            return g["rect"].get_area() >= 400
        return g["rect"].get_area() >= 1500 and (g["n"] >= 3 or "img" in g["kinds"])

    return [g for g in groups if keep(g)]


def alt_labels(page, region):
    out = []
    for b in page.get_text("blocks"):
        m = ALT_LABEL.match(b[4])
        if m and region.contains(pymupdf.Point(b[0] + 1, b[1] + 1)):
            out.append((b[1], m.group(1)))
    return sorted(out)


def recover_alternatives(doc, regs):
    """Texto de cada alternativa lido do PDF, na ordem de leitura (A)…(E).

    Linhas de continuação vêm em blocos próprios (recuo maior) até o próximo
    rótulo. Alternativa que é só figura volta com texto vazio.
    """
    alts, cur, label_x = {}, None, 0.0
    for pno, reg in regs:
        page = doc[pno]
        blocks = [b for b in page.get_text("blocks") if reg.contains(pymupdf.Point(b[0] + 1, b[1] + 1))]
        for b in sorted(blocks, key=lambda t: (t[1], t[0])):
            text = re.sub(r"\s+", " ", b[4]).strip()
            m = ALT_LABEL.match(text)
            if m:
                cur, label_x = m.group(1), b[0]
                alts[cur] = text[m.end():].strip()
                continue
            if not cur or not text or Q_START.match(text):
                continue
            if re.search(r"pciconcursos|EscreventeT|Confidencial|^\d+$|R\s*A\s*S\s*C\s*U\s*N\s*H\s*O", text):
                continue
            # Título de bloco/matéria centralizado ("CONHECIMENTOS EM DIREITO",
            # "Direito Processual Penal"): fim das alternativas.
            if len(text) < 70 and SECTION_HEADER.match(text):
                cur = None
                continue
            # Continuação da alternativa vem RECUADA em relação ao "(A)"; texto
            # alinhado à esquerda ("Leia o texto para responder…") já é outra coisa.
            if b[0] >= label_x + 8:
                alts[cur] = (alts[cur] + " " + text).strip()
            elif b[0] < label_x - 4:
                cur = None
    # hifenização de fim de linha: "caracteriza- dos" → "caracterizados"
    return {k: dehyphen(v) for k, v in alts.items()}


def dehyphen(text):
    """Hifenização de fim de linha: "caracteriza- dos" → "caracterizados"."""
    text = text.replace("­", "")  # hífen invisível ("o­utrem", "d­ireito")
    return re.sub(r"(\w)- (\w)", lambda m: m.group(1) + m.group(2), text)


def broken_alternatives(q):
    alts = q.get("alternatives", [])
    if len(alts) != 5:
        return True
    return any(
        re.search(r"consulte o caderno|^\s*\([A-E]\)|\s\([A-E]\)\s", a["text"]) or not a["text"].strip()
        for a in alts
    )


def text_inside(page, rect):
    t = page.get_text("text", clip=rect)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:300]


SHARED_INSTR = re.compile(
    r"\b(?:Leia|Observe|Analise|Considere)\b[^.]{0,120}?para responder [àa]s? quest(?:ões|ão)"
    r"(?: de números?)? (\d{1,3})(?: (?:a|e) (\d{1,3}))?",
    re.I,
)


def shared_support(doc, starts, skip):
    """Figuras de apoio compartilhado: "Leia a tira para responder às questões
    de números 01 e 02." — a figura fica ENTRE a instrução e a questão 01, fora
    da região de qualquer questão (ou no fim da região da questão anterior).
    Devolve {número: [(page, rect)]} e a lista de áreas já atribuídas."""
    out, claimed = {}, []
    for pno, page in enumerate(doc):
        if pno == 0:
            continue
        two = is_two_columns(page)
        w, h = page.rect.width, page.rect.height
        for b in page.get_text("blocks"):
            m = SHARED_INSTR.search(re.sub(r"\s+", " ", b[4]))
            if not m:
                continue
            first = int(m.group(1))
            last = int(m.group(2) or first)
            col = 1 if (two and b[0] > w / 2 - 10) else 0
            nxt = next((s for s in starts if s[3] == first), None)
            cx0, cx1 = (0, w) if not two else ((0, w / 2) if col == 0 else (w / 2, w))
            y1 = nxt[2] if nxt and nxt[0] == pno and (nxt[1] == col or not two) else h
            area = pymupdf.Rect(cx0, b[1], cx1, y1)
            for g in cluster(visual_rects(page, area, skip), []):
                claimed.append((pno, g["rect"]))
                for n in range(first, min(last, first + 20) + 1):
                    out.setdefault(n, []).append((pno, g["rect"]))
    return out, claimed


def norm_cmp(s):
    import unicodedata

    return re.sub(r"[^a-z0-9]", "", unicodedata.normalize("NFD", dehyphen(s).lower()))


def main():
    apply = "--apply" in sys.argv
    data = json.loads(DATA.read_text(encoding="utf-8"))
    fixed_alts = 0
    figure_alts = 0
    OUT_PNG.mkdir(parents=True, exist_ok=True)
    for old in OUT_PNG.glob("tjsp-oficial-*.png"):
        old.unlink()
    media = {}
    docs = {}
    for prova in data["provas"]:
        year = prova["year"]
        if year not in docs:
            doc = pymupdf.open(SRC / FILES[year])
            starts = question_starts(doc)
            skip = watermark_xrefs(doc)
            docs[year] = (doc, starts, skip, *shared_support(doc, starts, skip))
        doc, starts, skip, shared, claimed = docs[year]
        shared_files = {}
        for q in prova["questions"]:
            qid = q["id"]
            if qid in SKIP_QUESTIONS:
                continue
            seq = 0
            entry = {"statement": [], "alternatives": {}}
            # Apoio compartilhado (tira/gráfico das questões N a M) vem primeiro.
            for pno, rect in shared.get(q["number"], []):
                key = (pno, tuple(round(v) for v in rect))
                if key not in shared_files:
                    page = doc[pno]
                    clip = (rect + (-6, -6, 6, 6)) & page.rect
                    name = f"tjsp-oficial-{year}-apoio-p{pno + 1}-{len(shared_files) + 1}.png"
                    page.get_pixmap(clip=clip, dpi=170).save(OUT_PNG / name)
                    shared_files[key] = {"src": f"/provas-media/{name}", "alt": text_inside(page, clip)}
                entry["statement"].append(shared_files[key])
            for pno, reg in regions_for(doc, starts, q["number"]):
                page = doc[pno]
                labels = alt_labels(page, reg)
                for g in cluster(visual_rects(page, reg, skip), [y for y, _ in labels]):
                    if any(p == pno and r.intersects(g["rect"]) for p, r in claimed):
                        continue  # figura de apoio de OUTRAS questões
                    seq += 1
                    rect = (g["rect"] + (-6, -6, 6, 6)) & page.rect
                    name = f"{qid}-{seq}.png"
                    page.get_pixmap(clip=rect, dpi=170).save(OUT_PNG / name)
                    item = {"src": f"/provas-media/{name}", "alt": text_inside(page, rect)}
                    owner = None
                    for y, letter in labels:
                        if g["rect"].y0 >= y - 4:
                            owner = letter
                    # figura entre o enunciado e (A) é do enunciado
                    if owner:
                        entry["alternatives"].setdefault(owner, []).append(item)
                    else:
                        entry["statement"].append(item)
            # Alternativas lidas direto do PDF corrigem o texto embaralhado do
            # import (ex.: 2018-q004 A = "(B) recíproco… reflexivo, possessivo…").
            recovered = recover_alternatives(doc, regions_for(doc, starts, q["number"]))
            recovered.update(KNOWN_ALT_TEXT.get(qid, {}))
            if len(recovered) == 5:
                for a in q["alternatives"]:
                    r = recovered.get(a["key"], "").strip()
                    if not r:
                        # Alternativa que é figura: texto vazio + mídia da letra.
                        if a["key"] in entry["alternatives"] and a["text"]:
                            a["text"] = ""
                            figure_alts += 1
                        continue
                    if norm_cmp(r) != norm_cmp(a["text"]):
                        a["text"] = r
                        fixed_alts += 1
            if entry["statement"] or entry["alternatives"]:
                if not entry["alternatives"]:
                    del entry["alternatives"]
                media[qid] = entry
    OUT_JSON.write_text(json.dumps(media, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    n_img = sum(len(e["statement"]) + sum(len(v) for v in e.get("alternatives", {}).values()) for e in media.values())
    print(f"{len(media)} questões com mídia, {n_img} recortes → {OUT_JSON.relative_to(ROOT)}")
    print(f"alternativas corrigidas pelo PDF: {fixed_alts}; alternativas que são figura: {figure_alts}")
    if apply:
        DATA.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"gravado em {DATA.relative_to(ROOT)}")
    else:
        print("(simulação — use --apply para gravar as alternativas corrigidas)")


if __name__ == "__main__":
    main()
