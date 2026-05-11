# DMW Seal Optimizer

App de optimización de sellos para **Digital Masters World** (server privado).

Basada en el Seal Optimizer de GDMO, adaptada para DMW.

## Diferencias vs GDMO
- Atributo extra: **SK [Skill Damage]**
- localStorage keys separadas (`dmw-*`) — no colisiona con GDMO

## Setup

```bash
npm install
npm run dev
```

## Actualizar datos de sellos

1. Guardar el HTML de https://digitalmastersworld.wiki.gg/wiki/Seal_Master como `seal_master.html`
2. Correr el scraper:
   ```bash
   cd C:\PROGRAMACION\dmw
   python scrape_dmw_seals.py seal_master.html
   ```
3. Copiar el JSON generado:
   ```
   copy dmw_seals_data.json sealoptimize\public\seals_data.json
   ```
4. Rebuild:
   ```bash
   npm run build
   ```

## Deploy

El proyecto es un Vite + React estático, deployable en Vercel, Netlify, o cualquier hosting estático.
