# degoog-plugins

Meine [degoog](https://github.com/degoog-org/degoog) Extensions — datenschutzfreundliche Plugins für ein selbst gehostetes Homelab.

## Als Store-Repo hinzufügen

In degoog: **Settings → Store → Add** und diese Repo-URL einfügen:

```
https://github.com/<dein-github-user>/degoog-plugins.git
```

Danach lassen sich die Plugins direkt aus dem Store-Tab installieren, aktualisieren und deinstallieren.

## Plugins

### Spell Check (LanguageTool)

Fängt Suchanfragen ab und korrigiert Tippfehler über [LanguageTool](https://languagetool.org) — eine datenschutzfreundliche, nicht-russische Alternative zum offiziellen Yandex-Speller-Plugin. Funktioniert wie die Google-Autokorrektur: Bei einer Query mit Tippfehler zeigt degoog „Showing results for … / Search instead for …".

**Einstellungen (Settings → Plugins):**

- **LanguageTool API endpoint** — Standard ist die öffentliche API (`https://api.languagetool.org/v2/check`). Für volle Privatsphäre auf eine selbst gehostete LanguageTool-Instanz zeigen lassen, z. B. `http://10.20.11.2:8010/v2/check`. Dann verlässt keine Suchanfrage das eigene Netz.
- **Language** — Sprachcode (`en-US`, `de-DE`) oder `auto` für automatische Erkennung.

Korrekturen greifen nur bei Queries mit mindestens zwei Wörtern; Bang-Commands (`!…`) werden ignoriert.

## Lizenz

AGPL-3.0
