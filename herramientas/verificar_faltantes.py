# -*- coding: utf-8 -*-
"""
LOLO SOBRE RUEDAS — Verificador de Productos Faltantes
=====================================================
Detecta qué productos no tienen fotos cargadas y/o no tienen
descripción (ni en el ERP ni enriquecida por la IA).

Muestra el resultado ordenado y claro en la consola de DOS.
"""

import os
import sys
import sqlite3

# Asegurar UTF-8 en la consola de Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_ERP = os.path.join(SCRIPT_DIR, "erp_profesional.db")
DB_AGENTE = os.path.join(SCRIPT_DIR, "agente_lolo.db")
DIR_IMAGENES = os.path.join(SCRIPT_DIR, "imagenes")
DIR_CAT_IMAGES = os.path.join(SCRIPT_DIR, "catalogo_web", "images")


def obtener_datos():
    if not os.path.exists(DB_ERP):
        print(f"\n[ERROR] No se encontró la base de datos: {DB_ERP}\n")
        return None

    conn = sqlite3.connect(DB_ERP)
    c = conn.cursor()

    # Todos los productos con stock activo (> 0)
    c.execute("""
        SELECT id, codigo, nombre, rubro, precio, cantidad 
        FROM productos 
        WHERE cantidad > 0
        ORDER BY rubro ASC, nombre ASC
    """)
    productos = c.fetchall()

    # Fotos registradas
    c.execute("SELECT producto_id, archivo FROM producto_fotos")
    fotos_db = c.fetchall()
    fotos_map = {}
    for pid, arch in fotos_db:
        if pid not in fotos_map:
            fotos_map[pid] = []
        fotos_map[pid].append(arch)

    # Descripciones manuales en ERP
    c.execute("SELECT producto_id, texto FROM producto_descripcion WHERE LENGTH(TRIM(COALESCE(texto, ''))) > 0")
    desc_erp_map = {r[0]: r[1].strip() for r in c.fetchall()}

    conn.close()

    # Descripciones IA (agente_lolo.db)
    desc_ia_map = {}
    if os.path.exists(DB_AGENTE):
        conn_ia = sqlite3.connect(DB_AGENTE)
        c_ia = conn_ia.cursor()
        c_ia.execute("SELECT id, descripcion_enriquecida FROM productos_enriquecidos WHERE LENGTH(TRIM(COALESCE(descripcion_enriquecida, ''))) > 0")
        desc_ia_map = {r[0]: r[1].strip() for r in c_ia.fetchall()}
        conn_ia.close()

    return productos, fotos_map, desc_erp_map, desc_ia_map


def existe_foto_en_disco(archivos):
    if not archivos:
        return False
    for arch in archivos:
        p1 = os.path.join(DIR_IMAGENES, arch)
        p2 = os.path.join(DIR_CAT_IMAGES, arch)
        if os.path.exists(p1) or os.path.exists(p2):
            return True
    return False


def main():
    datos = obtener_datos()
    if not datos:
        return

    productos, fotos_map, desc_erp_map, desc_ia_map = datos
    total_activos = len(productos)

    sin_foto = []
    sin_desc = []
    sin_ambos = []

    for p in productos:
        pid, cod, nom, rub, precio, stock = p
        archivos = fotos_map.get(pid, [])
        tiene_foto = bool(archivos) and existe_foto_en_disco(archivos)
        
        tiene_desc_erp = pid in desc_erp_map
        tiene_desc_ia = pid in desc_ia_map
        tiene_desc = tiene_desc_erp or tiene_desc_ia

        item = {
            "id": pid,
            "codigo": cod or "---",
            "nombre": nom,
            "rubro": rub or "Sin Rubro",
            "precio": precio or 0,
            "stock": stock or 0,
            "tiene_foto": tiene_foto,
            "tiene_desc": tiene_desc,
            "tiene_desc_erp": tiene_desc_erp,
            "tiene_desc_ia": tiene_desc_ia,
            "cant_fotos": len(archivos)
        }

        if not tiene_foto and not tiene_desc:
            sin_ambos.append(item)
        if not tiene_foto:
            sin_foto.append(item)
        if not tiene_desc:
            sin_desc.append(item)

    print("=" * 105)
    print("           LOLO SOBRE RUEDAS — AUDITORÍA DE PRODUCTOS (FOTOS Y DESCRIPCIONES)")
    print("=" * 105)
    print(f" Total de productos activos (con stock): {total_activos}")
    print(f" - Productos a los que les falta FOTO:           {len(sin_foto):>3}")
    print(f" - Productos a los que les falta DESCRIPCIÓN:    {len(sin_desc):>3}")
    print(f" - Productos a los que les falta TODO (AMBOS):   {len(sin_ambos):>3}")
    print("=" * 105)

    # 1. PRODUCTOS A LOS QUE LES FALTA TODO (FOTO Y DESCRIPCIÓN)
    if sin_ambos:
        print("\n" + "🔴" + " " * 2 + f"PRODUCTOS QUE NO TIENEN FOTO NI DESCRIPCIÓN ({len(sin_ambos)} productos)")
        print("-" * 105)
        print(f" {'ID':<6} {'CÓDIGO':<12} {'RUBRO':<14} {'STOCK':<6} {'PRECIO':<10} {'NOMBRE DEL PRODUCTO'}")
        print("-" * 105)
        for it in sin_ambos:
            nom = it['nombre'][:50]
            print(f" {it['id']:<6} {it['codigo']:<12} {it['rubro'][:13]:<14} {it['stock']:<6} ${it['precio']:<9,.0f} {nom}")
        print("-" * 105)

    # 2. PRODUCTOS QUE NO TIENEN FOTO (pero pueden tener descripción)
    solo_sin_foto = [x for x in sin_foto if x not in sin_ambos]
    if solo_sin_foto:
        print("\n" + "📷" + " " * 2 + f"PRODUCTOS SIN FOTO (Tienen descripción pero falta cargar imagen) ({len(solo_sin_foto)} productos)")
        print("-" * 105)
        print(f" {'ID':<6} {'CÓDIGO':<12} {'RUBRO':<14} {'STOCK':<6} {'PRECIO':<10} {'NOMBRE DEL PRODUCTO'}")
        print("-" * 105)
        for it in solo_sin_foto:
            nom = it['nombre'][:50]
            print(f" {it['id']:<6} {it['codigo']:<12} {it['rubro'][:13]:<14} {it['stock']:<6} ${it['precio']:<9,.0f} {nom}")
        print("-" * 105)

    # 3. PRODUCTOS QUE TIENEN FOTO PERO NO TIENEN DESCRIPCIÓN
    solo_sin_desc = [x for x in sin_desc if x not in sin_ambos]
    if solo_sin_desc:
        print("\n" + "📝" + " " * 2 + f"PRODUCTOS CON FOTO PERO SIN DESCRIPCIÓN ({len(solo_sin_desc)} productos)")
        print("    (Podés correr 'enriquecedor.bat' para que la IA los describa automáticamente)")
        print("-" * 105)
        print(f" {'ID':<6} {'CÓDIGO':<12} {'RUBRO':<14} {'STOCK':<6} {'FOTOS':<6} {'NOMBRE DEL PRODUCTO'}")
        print("-" * 105)
        for it in solo_sin_desc:
            nom = it['nombre'][:50]
            print(f" {it['id']:<6} {it['codigo']:<12} {it['rubro'][:13]:<14} {it['stock']:<6} {it['cant_fotos']:<6} {nom}")
        print("-" * 105)

    if not sin_foto and not sin_desc:
        print("\n✨ ¡FELICITACIONES! Todos los productos activos tienen foto y descripción cargada.")

    print("\n" + "=" * 105)
    print(" RESUMEN DE ACCIONES RECOMENDADAS:")
    if sin_ambos or solo_sin_foto:
        print(f" 1. Cargar las fotos de los {len(sin_foto)} producto(s) desde el ERP profesional.")
    if sin_desc:
        print(f" 2. Para los {len(sin_desc)} producto(s) sin descripción, podés ejecutar:")
        print("    -> enriquecedor.bat  (para que Gemini IA redacte la ficha técnica y comercial)")
    print("=" * 105 + "\n")


if __name__ == "__main__":
    main()
