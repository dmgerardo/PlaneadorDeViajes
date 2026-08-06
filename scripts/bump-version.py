#!/usr/bin/env python3
"""Sube el número de versión (?v=N) en los <link>/<script> de los HTML,
y el APP_VERSION visible en js/version.js, si el commit que se está por
crear toca algún .css o .js.
Se invoca desde .githooks/pre-commit; no se ejecuta a mano normalmente.
"""
import re
import subprocess
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
HTML_FILES = ["index.html", "viaje.html", "historial.html"]
VERSION_JS = RAIZ / "js" / "app-version.js"
PATRON_VERSION = re.compile(r"(\?v=)(\d+)")
PATRON_APP_VERSION = re.compile(r'(APP_VERSION\s*=\s*")(\d+)(")')


def archivos_en_staging():
    salida = subprocess.run(
        ["git", "diff", "--cached", "--name-only"],
        cwd=RAIZ, capture_output=True, text=True, check=True
    ).stdout
    return salida.splitlines()


def toca_assets(archivos):
    return any(a.endswith(".css") or a.endswith(".js") for a in archivos)


def version_actual():
    texto = (RAIZ / "index.html").read_text(encoding="utf-8")
    m = PATRON_VERSION.search(texto)
    return int(m.group(2)) if m else 1


def aplicar_version(nueva):
    for nombre in HTML_FILES:
        ruta = RAIZ / nombre
        if not ruta.exists():
            continue
        texto = ruta.read_text(encoding="utf-8")
        nuevo_texto = PATRON_VERSION.sub(rf"\g<1>{nueva}", texto)
        if nuevo_texto != texto:
            ruta.write_text(nuevo_texto, encoding="utf-8")
            subprocess.run(["git", "add", nombre], cwd=RAIZ, check=True)

    if VERSION_JS.exists():
        texto = VERSION_JS.read_text(encoding="utf-8")
        nuevo_texto = PATRON_APP_VERSION.sub(rf"\g<1>{nueva}\g<3>", texto)
        if nuevo_texto != texto:
            VERSION_JS.write_text(nuevo_texto, encoding="utf-8")
            subprocess.run(["git", "add", "js/version.js"], cwd=RAIZ, check=True)


def main():
    archivos = archivos_en_staging()
    if not toca_assets(archivos):
        return 0
    actual = version_actual()
    aplicar_version(actual + 1)
    print(f"bump-version: assets modificados, ?v= subido a {actual + 1}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
