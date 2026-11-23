"""Draw docs/assets/social_preview.png (1200 x 630), the image shown when the
site is shared. It is the same 40 x 25 haystack grid as the page, with the
broken squares in the same fixed-seed positions, and the headline numbers
read from docs/data/facts.json.

Run after src/export_web_data.py:

    python src/make_social_image.py
"""

from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFont

DOCS = Path(__file__).resolve().parent.parent / 'docs'
PAPER, INK, MUTE, SOFT, BROKEN = '#f4f3ef', '#1c1c1a', '#5f5d57', '#dfe3e3', '#c2410c'
COLUMNS, ROWS = 40, 25
FONT_DIR = Path('/usr/share/fonts/liberation-serif-fonts')
MONO_DIR = Path('/usr/share/fonts/liberation-mono-fonts')


def seeded_random(seed):
    """The same small generator as docs/js/data.js, so the squares land in the same places."""
    state = seed & 0xFFFFFFFF

    def imul(a, b):
        return (a * b) & 0xFFFFFFFF

    def next_value():
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = imul(t ^ (t >> 15), t | 1)
        t ^= (t + imul(t ^ (t >> 7), t | 61)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_value


def scattered_cells(count):
    """Same shuffle as scatteredCells() in docs/js/haystack.js."""
    random = seeded_random(42)
    cells = list(range(COLUMNS * ROWS))
    for j in range(count):
        pick = j + int(random() * (len(cells) - j))
        cells[j], cells[pick] = cells[pick], cells[j]
    return set(cells[:count])


def font(folder, name, size):
    try:
        return ImageFont.truetype(str(folder / name), size)
    except OSError:
        return ImageFont.load_default()


def main():
    facts = json.loads((DOCS / 'data' / 'facts.json').read_text())
    broken_count = round(facts['anomaly_ratio'] * COLUMNS * ROWS)
    broken = scattered_cells(broken_count)

    image = Image.new('RGB', (1200, 630), PAPER)
    draw = ImageDraw.Draw(image)
    cell, square = 13, 10
    left, top = 1200 - 64 - COLUMNS * cell, 630 - 64 - ROWS * cell
    for index in range(COLUMNS * ROWS):
        x = left + (index % COLUMNS) * cell
        y = top + (index // COLUMNS) * cell
        draw.rectangle([x, y, x + square, y + square], fill=BROKEN if index in broken else SOFT)

    serif_bold = font(FONT_DIR, 'LiberationSerif-Bold.ttf', 58)
    mono = font(MONO_DIR, 'LiberationMono-Regular.ttf', 22)
    draw.text((64, 64), 'HDFS INCIDENT RADAR', font=mono, fill=MUTE)
    draw.line([(64, 100), (1136, 100)], fill=INK, width=1)
    headline = [f"{facts['anomalous_blocks']:,} of", f"{facts['total_blocks']:,}", 'blocks', 'went wrong.']
    for row, line in enumerate(headline):
        draw.text((64, 128 + row * 70), line, font=serif_bold, fill=BROKEN if row == 0 else INK)
    draw.text((64, 566 - 22), f"1 square ≈ {round(facts['total_blocks'] / (COLUMNS * ROWS))} blocks",
              font=mono, fill=MUTE)

    output = DOCS / 'assets' / 'social_preview.png'
    image.save(output, optimize=True)
    print(f'wrote {output} ({output.stat().st_size:,} bytes), {broken_count} orange squares')


if __name__ == '__main__':
    main()
