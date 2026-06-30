"""Gera tests/fixtures/incomplete-case.pdf — documento vago usado no teste E2E
de revisão: SEM número CNJ, SEM cliente identificável, SEM vara, sem partes
nominais. Força a IA a devolver vários campos como `missing`.

Uso:
    pip install reportlab
    python3 tests/fixtures/generate-incomplete-pdf.py
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


OUTPUT = Path(__file__).with_name("incomplete-case.pdf")


def build() -> None:
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("MEMORANDO INTERNO", styles["Title"]),
        Spacer(1, 12),
        Paragraph("Assunto: análise preliminar de demanda", styles["Heading3"]),
        Spacer(1, 12),
        Paragraph(
            "Trata-se de breve apontamento sobre possível discussão judicial "
            "envolvendo questão contratual ainda em estudo. Não há, neste "
            "momento, número de processo distribuído, tampouco indicação "
            "expressa de cliente, partes adversas ou juízo competente.",
            styles["BodyText"],
        ),
        Spacer(1, 8),
        Paragraph(
            "Aguardamos documentação complementar para identificar as partes, "
            "definir a vara competente e formalizar o protocolo. O presente "
            "memorando NÃO contém número CNJ, nome do cliente, comarca ou "
            "tipo de ação consolidados.",
            styles["BodyText"],
        ),
        Spacer(1, 8),
        Paragraph(
            "Próximos passos: reunir contratos, identificar a contraparte e "
            "elaborar minuta para revisão interna.",
            styles["BodyText"],
        ),
        Spacer(1, 12),
        Paragraph("— Documento de trabalho —", styles["BodyText"]),
    ]
    doc.build(story)
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    build()
