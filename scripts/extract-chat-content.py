"""Read public PDF/image text and spreadsheet cells; never evaluate formulas."""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unicodedata


def clean(text):
    return unicodedata.normalize('NFKC', text).replace('\u200b', '').replace('\ufeff', '').strip()


def readable(text, lao):
    letters = [char for char in text if char.isalpha()]
    ratio = sum('\u0e80' <= char <= '\u0eff' for char in letters) / max(1, len(letters))
    return len(letters) >= 80 and (not lao or ratio >= 0.8)


def run(arguments, **kwargs):
    return subprocess.run(arguments, check=True, capture_output=True, timeout=120,
                          env={**os.environ, 'OMP_THREAD_LIMIT': '1'}, **kwargs)


def ocr(path, directory, mode='3'):
    output = str((Path(directory) / 'recognized').resolve())
    run(['tesseract', str(Path(path).resolve()), output, '-l', 'lao+eng', '--psm', mode, 'txt', 'tsv'])
    with open(output + '.tsv') as stream:
        words = [row for row in csv.DictReader(stream, delimiter='\t')
                 if row['text'].strip() and float(row['conf']) >= 0]
    length = sum(len(row['text']) for row in words)
    confidence = sum(float(row['conf']) * len(row['text']) for row in words) / max(1, length)
    text = clean(Path(output + '.txt').read_text())
    # Low-confidence pages remain empty so PDF page numbers stay accurate.
    return (text if confidence >= 55 and length >= 20 else ''), round(confidence, 1)


def extract(path, kind, use_ocr, lao):
    result = {'type': kind, 'pages': [], 'methods': [], 'confidence': [], 'labels': []}
    if kind == 'xlsx':
        import openpyxl
        workbook = openpyxl.load_workbook(path, read_only=True, data_only=False, keep_links=False)
        try:
            for sheet in workbook.worksheets:
                lines = [f'Sheet: {sheet.title}']
                for row in sheet.iter_rows():
                    cells = [f'{cell.coordinate}: {clean(str(cell.value))}' for cell in row if cell.value is not None]
                    if cells:
                        lines.append(' | '.join(cells))
                result['pages'].append('\n'.join(lines))
                result['methods'].append('spreadsheet')
                result['confidence'].append(100)
                result['labels'].append(sheet.title)
        finally:
            workbook.close()
        return result

    with tempfile.TemporaryDirectory(prefix='dpo-chat-') as temporary:
        if kind == 'image':
            text, confidence = ocr(path, temporary)
            result.update(pages=[text], methods=['ocr' if text else 'unreadable'], confidence=[confidence], labels=['Image'])
            return result
        native = run(['pdftotext', '-layout', str(path), '-'], text=True).stdout.split('\f')
        if native and not native[-1].strip():
            native.pop()
        for number, text in enumerate(native, 1):
            text = clean(text)
            method, confidence = 'text', 100
            if not readable(text, lao):
                text, method, confidence = '', 'unreadable', 0
                if use_ocr:
                    prefix = str(Path(temporary) / 'page')
                    run(['pdftoppm', '-f', str(number), '-l', str(number), '-singlefile', '-scale-to', '2600', '-png', str(path), prefix])
                    text, confidence = ocr(prefix + '.png', temporary)
                    method = 'ocr' if text else 'unreadable'
            result['pages'].append(text)
            result['methods'].append(method)
            result['confidence'].append(confidence)
            result['labels'].append(f'Page {number}')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('path', type=Path)
    parser.add_argument('--kind', choices=['pdf', 'xlsx', 'image'], required=True)
    parser.add_argument('--ocr', action='store_true')
    parser.add_argument('--lao', action='store_true')
    parser.add_argument('--cache', type=Path, required=True)
    args = parser.parse_args()
    args.path = args.path.resolve()
    if args.path.stat().st_size > 64 * 1024 * 1024:
        raise ValueError('Public file exceeds the 64 MB indexing limit')
    file_hash = hashlib.sha256(args.path.read_bytes()).hexdigest()
    key = hashlib.sha256(f'v1:{file_hash}:{args.kind}:{args.ocr}:{args.lao}'.encode()).hexdigest()
    args.cache.mkdir(parents=True, exist_ok=True)
    cache = args.cache / (key + '.json')
    result = json.loads(cache.read_text()) if cache.exists() else extract(args.path, args.kind, args.ocr, args.lao)
    if args.ocr and args.kind == 'pdf' and 'unreadable' in result['methods']:
        with tempfile.TemporaryDirectory(prefix='dpo-chat-retry-') as temporary:
            for index, method in enumerate(result['methods']):
                if method != 'unreadable':
                    continue
                prefix = str(Path(temporary) / 'page')
                run(['pdftoppm', '-f', str(index + 1), '-l', str(index + 1), '-singlefile', '-scale-to', '3000', '-png', str(args.path), prefix])
                text, confidence = ocr(prefix + '.png', temporary, '6')
                if text:
                    result['pages'][index], result['methods'][index], result['confidence'][index] = text, 'ocr', confidence
    result['fileHash'] = file_hash
    output = json.dumps(result, ensure_ascii=False)
    temporary = cache.with_suffix('.tmp')
    temporary.write_text(output)
    os.replace(temporary, cache)
    print(output)


if __name__ == '__main__':
    main()
