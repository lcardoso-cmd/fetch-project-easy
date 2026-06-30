"""Gera tests/fixtures/sample-case.pdf — petição fictícia usada nos testes E2E.

Uso:
    pip install reportlab
    python3 tests/fixtures/generate-sample-pdf.py
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer


OUTPUT = Path(__file__).with_name("sample-case.pdf")


def build() -> None:
    doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4)
    styles = getSampleStyleSheet()
    story = [
        Paragraph("PETIÇÃO INICIAL", styles["Title"]),
        Spacer(1, 12),
        Paragraph(
            "EXCELENTÍSSIMO SENHOR DOUTOR JUIZ DE DIREITO DA 3ª VARA CÍVEL "
            "DA COMARCA DE SÃO PAULO - TJSP",
            styles["Heading3"],
        ),
        Spacer(1, 12),
        Paragraph("Processo nº 1023456-78.2025.8.26.0100", styles["Heading4"]),
        Spacer(1, 12),
        Paragraph(
            "MARIA DA SILVA SANTOS, brasileira, autora, vem respeitosamente à "
            "presença de Vossa Excelência propor a presente AÇÃO DE INDENIZAÇÃO "
            "POR DANOS MORAIS em face de BANCO XYZ S.A., réu, pessoa jurídica "
            "de direito privado, pelos fatos e fundamentos a seguir expostos.",
            styles["BodyText"],
        ),
        Spacer(1, 8),
        Paragraph(
            "DOS FATOS: A autora teve seu nome inscrito indevidamente nos "
            "cadastros de proteção ao crédito pelo banco réu, em virtude de "
            "cobrança de dívida já quitada, conforme comprovantes anexos. "
            "Trata-se de matéria cível, especialmente de relação de consumo, "
            "sendo competente a vara cível desta comarca.",
            styles["BodyText"],
        ),
        Spacer(1, 8),
        Paragraph(
            "DOS PEDIDOS: Requer-se a condenação do réu ao pagamento de "
            "indenização por danos morais no valor de R$ 20.000,00, bem como "
            "a imediata exclusão do nome da autora dos cadastros restritivos.",
            styles["BodyText"],
        ),
        Spacer(1, 12),
        Paragraph("São Paulo, 15 de janeiro de 2026.", styles["BodyText"]),
        Paragraph("Dra. Patrícia Advogada — OAB/SP 123.456", styles["BodyText"]),
    ]
    doc.build(story)
    print(f"wrote {OUTPUT}")


if __name__ == "__main__":
    build()
