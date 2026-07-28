# Dragon Bones

Jogo arcade de exploração em Canvas 2D, com um dragão esquelético inteiramente procedural.

## Destaques

- Dragão articulado que cresce conforme coleta ossos.
- Ossos, runas e relíquias ancestrais com valores e efeitos distintos.
- Sistema de combo, missões, recorde local e fogo espectral para aceleração.
- Jornada dos Três Selos, com contexto narrativo para cada missão.
- Cripta de personalização com quatro essências visuais persistentes.
- Cenário atmosférico procedural, partículas, minimapa e feedback de impacto.
- Controles por mouse, toque, setas ou WASD; pausa e som acessíveis pelo HUD e teclado.
- Multiplayer opcional via Supabase Realtime.
- Layout responsivo e suporte a `prefers-reduced-motion`.

## Controles

| Ação | Controle |
| --- | --- |
| Guiar | Mouse, toque, setas ou WASD |
| Acelerar | Segurar clique/toque ou Espaço |
| Pausar | P ou Esc |
| Som | M |

## Executar

Sirva esta pasta com qualquer servidor estático. Exemplo: `python3 -m http.server 8080`.

## Multiplayer

Preencha `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` em `config.js`. Sem essas chaves, o jogo funciona normalmente em modo solo. Use `?room=nome` na URL para criar uma sala específica.

## Login com Google

O login reutiliza o projeto Supabase configurado em `config.js`:

1. Em **Authentication > Providers > Google**, habilite o provedor com as credenciais do Google.
2. Em **Authentication > URL Configuration**, use a URL pública do jogo como Site URL e Redirect URL.
3. No Google Cloud Console, autorize a Callback URL exibida pelo Supabase.

A sessão persiste automaticamente; o cabeçalho mostra nome, foto e a opção de sair.

## Publicação

O projeto está pronto para hospedagem estática. Na Netlify, `netlify.toml` publica a raiz do repositório.
