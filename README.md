# Dragon Bones Online — versão articulada

Jogo de navegador em Canvas 2D.

## O que mudou
- O dragão NÃO usa uma imagem pronta.
- Corpo esquelético desenhado proceduralmente.
- Coluna formada por vértebras articuladas.
- Caixa torácica, asas ósseas, pescoço e crânio acompanham o movimento.
- Mouse e toque controlam a direção.
- Ossos aparecem pelo mapa e fazem o dragão crescer.
- Efeitos sonoros simples via Web Audio.
- Multiplayer opcional via Supabase Realtime.
- Compatível com hospedagem estática na Netlify.

## Netlify
Envie o CONTEÚDO desta pasta para o deploy, de forma que `index.html` fique na raiz publicada.

## Multiplayer
Abra `config.js` e preencha:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Sem isso, o jogo continua funcionando em modo solo.
