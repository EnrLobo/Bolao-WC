# Bolao Copa 2026

App estatico para criar parties de bolao da Copa do Mundo 2026, registrar palpites, lancar resultados e calcular ranking por pontuacao.

## O que ja vem pronto

- Sem Express e sem backend proprio.
- Modo local via `localStorage` para testar a interface imediatamente.
- Integracao preparada para Firebase Auth + Cloud Firestore.
- Importacao da tabela pelo JSON publico do OpenFootball, sem chave de API.
- Criacao e entrada em party por codigo.
- 104 jogos no modelo de 2026: fase de grupos e mata-mata.
- Ranking com pontos para placar exato, vencedor correto e erro.
- Edicao de selecoes e placares pelo dono da party.

O formato base segue o torneio de 48 selecoes, 12 grupos e round of 32 descrito pela FIFA: https://gpcustomersupportfwc2026.tickets.fifa.com/hc/en-gb/articles/28784798873117-7-What-is-the-format-for-the-FIFA-World-Cup-26-tournament

## Fonte da tabela

Ao criar uma party, o app tenta importar os 104 jogos de:

```text
https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json
```

Essa fonte traz fase de grupos, sedes, horarios e cruzamentos do mata-mata com placeholders como `1A`, `2B`, `3A/B/C/D/F`, `W74` e `L101`. Se a importacao falhar, o app usa o modelo interno e o dono da party pode tentar novamente pelo botao "Sincronizar tabela".

## Rodando localmente

Como o projeto e estatico, voce pode servir a pasta com qualquer servidor simples:

```powershell
python -m http.server 3000
```

Depois abra:

```text
http://127.0.0.1:3000
```

## Ligando o Firebase

1. Crie um projeto no Firebase.
2. Ative Authentication com provedor Email/Password.
3. Crie um banco Cloud Firestore.
4. Copie a configuracao Web App do Firebase para `src/firebase-config.js`.
5. Altere `useFirebase` para `true`.
6. Publique as regras de `firestore.rules` no console do Firestore.

Exemplo:

```js
export const useFirebase = true;

export const firebaseConfig = {
  apiKey: "sua-chave",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:abcdef",
};
```

## Deploy na Vercel

Nao precisa configurar server. Suba o repositorio no GitHub e importe na Vercel como projeto estatico. Se voce deixar sem build command, a Vercel servira o `index.html` e os arquivos de `src/`.

## Estrutura dos dados no Firestore

```text
partyCodes/{code}
parties/{partyId}
parties/{partyId}/members/{uid}
parties/{partyId}/matches/{matchId}
parties/{partyId}/predictions/{uid_matchId}
users/{uid}
users/{uid}/parties/{partyId}
```

O ranking e calculado no cliente a partir dos resultados fechados e dos palpites salvos.
